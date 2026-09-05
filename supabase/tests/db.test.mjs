import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, asUser, setAal, makeUser } from '../../scripts/db-harness.mjs';

let db;
const ctx = {};
const VALID_IMEI = '490154203237518';
const BAD_IMEI = '490154203237519';
const IMEI_2 = '356938035643809';

beforeAll(async () => {
  db = await createTestDb();
  ctx.admin = await makeUser(db, { name: 'مدير النظام', email: 'admin@test.local', roles: ['system_admin'] });
  ctx.manager = await makeUser(db, { name: 'مدير محل', email: 'shop@test.local', roles: ['shop_manager'] });
  ctx.officer = await makeUser(db, { name: 'ضابط مخوّل', email: 'officer@test.local', roles: ['authorized_officer'] });
  ctx.investigator = await makeUser(db, { name: 'ضابط تحقيق', email: 'inv@test.local', roles: ['investigation_officer'] });
  ctx.nobody = await makeUser(db, { name: 'بلا صلاحيات', email: 'none@test.local', roles: [] });
}, 180000);

afterAll(async () => { await db?.close?.(); });

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

describe('انحدار: خوارزمية Luhn للـ IMEI', () => {
  it('يقبل IMEI صحيح ويرفض خانة تحقق خاطئة', async () => {
    const r = await one(`select public.is_valid_imei($1) a, public.is_valid_imei($2) b`, [VALID_IMEI, BAD_IMEI]);
    expect(r.a).toBe(true);
    expect(r.b).toBe(false);
  });
  it('يرفض غير الأرقام والأطوال الخاطئة', async () => {
    const r = await one(
      `select public.is_valid_imei('12345') a, public.is_valid_imei('49015420323751a') b, public.is_valid_imei(null) c`);
    expect(r.a).toBe(false); expect(r.b).toBe(false); expect(r.c).toBe(false);
  });
  it('لا تمرّ كل الأرقام الخمسة عشر (الحلقة تُنفَّذ فعليًا)', async () => {
    const { rows } = await db.query(
      `select count(*) filter (where public.is_valid_imei(i)) c
       from (select lpad(g::text, 15, '0') i from generate_series(100000, 100050) g) s`);
    expect(Number(rows[0].c)).toBeLessThan(41);
  });
});

describe('انحدار: RLS مفعّل على كل الجداول الحرجة', () => {
  it('كل جداول public عليها RLS مفعّل ومفروض', async () => {
    const { rows } = await db.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and (not c.relrowsecurity or not c.relforcerowsecurity)`);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
  it('لا صلاحيات لدور anon على الجداول', async () => {
    const { rows } = await db.query(
      `select table_name from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'`);
    expect(rows).toEqual([]);
  });
});

describe('انحدار: السجلات append-only', () => {
  it('يرفض حذف/تعديل سجل التدقيق', async () => {
    await asUser(db, ctx.admin);
    await db.query(`select private.append_audit_log($1,'test','entity',null,'{}'::jsonb)`, [ctx.admin]);
    await expect(db.query(`delete from public.audit_logs`)).rejects.toThrow(/APPEND_ONLY/);
    await expect(db.query(`update public.audit_logs set action = 'x'`)).rejects.toThrow(/APPEND_ONLY/);
  });
});

describe('انحدار: تسلسل سجل التدقيق (hash chain)', () => {
  it('كل القيود صالحة التجزئة', async () => {
    const { rows } = await db.query(`select * from public.verify_audit_chain(1000) where not is_valid`);
    expect(rows).toEqual([]);
  });
});

describe('انحدار: آلة حالات البلاغ', () => {
  it('تسمح بالانتقالات المعرّفة وترفض غيرها', async () => {
    const r = await one(`select
      public.is_allowed_report_transition('draft','submitted') a,
      public.is_allowed_report_transition('recovered','closed') b,
      public.is_allowed_report_transition('draft','closed') c,
      public.is_allowed_report_transition('closed','active') d`);
    expect(r.a).toBe(true); expect(r.b).toBe(true);
    expect(r.c).toBe(false); expect(r.d).toBe(false);
  });
});

describe('انحدار: فرض AAL2 على العمليات الحساسة', () => {
  it('يرفض إنشاء البلاغ عند AAL1 وينجح عند AAL2', async () => {
    await asUser(db, ctx.officer);
    await setAal(db, 'aal1');
    await expect(db.query(
      `select public.op_create_stolen_report($1, now(), 'الرياض', 'سرقة من مركبة')`, [IMEI_2]))
      .rejects.toThrow(/MFA_REQUIRED/);
    await setAal(db, 'aal2');
    const r = await one(`select public.op_create_stolen_report($1, now(), 'الرياض', 'سرقة من مركبة') j`, [IMEI_2]);
    expect(r.j.status).toBe('draft');
    ctx.tmpReport = r.j.id;
  });
});

describe('انحدار: رفض الصلاحيات', () => {
  it('مستخدم بلا صلاحيات لا يستطيع تسجيل جهاز', async () => {
    await asUser(db, ctx.nobody);
    await setAal(db, 'aal2');
    await expect(db.query(`select public.op_create_device('Apple','15','أسود','SN1',$1)`, [VALID_IMEI]))
      .rejects.toThrow(/PERMISSION_DENIED/);
  });
});

describe('دورة الحياة الكاملة', () => {
  it('محل ← جهاز ← بيع ← صيانة ← فرمتة ← بلاغ ← إحالة ← متابعة ← استرداد ← إغلاق ← تدقيق', async () => {
    // 1) طلب محل واعتماده
    await asUser(db, ctx.manager); await setAal(db, 'aal2');
    const shop = (await one(
      `select public.op_submit_shop('محل النور','LIC-1','سالم','0500000000','الرياض') id`)).id;
    await asUser(db, ctx.officer);
    await db.query(`select public.op_approve_shop($1)`, [shop]);
    expect((await one(`select status from public.shops where id=$1`, [shop])).status).toBe('approved');

    // 2) تسجيل جهاز
    await asUser(db, ctx.manager);
    const device = (await one(
      `select public.op_create_device('Samsung','S24','أخضر','SN-9',$1,null,$2) id`, [VALID_IMEI, shop])).id;
    expect((await one(`select status from public.devices where id=$1`, [device])).status).toBe('registered');

    // IMEI خاطئ يُرفض خادميًا
    await expect(db.query(`select public.op_create_device('X','Y',null,null,$1)`, [BAD_IMEI]))
      .rejects.toThrow(/INVALID_IMEI/);

    // 3) بيع مع بيانات مشفّرة
    const sale = (await one(
      `select public.op_register_sale($1,$2,3200,12,'ENC_NAME','ENC_PHONE','ENC_NID','H_NAME','H_PHONE','H_NID') j`,
      [shop, device])).j;
    expect(sale.invoice_number).toMatch(/^INV-/);
    expect((await one(`select status from public.devices where id=$1`, [device])).status).toBe('sold');
    // لا نص صريح في جدول البيانات الحساسة
    const csd = await one(`select * from public.customer_sensitive_data where customer_id=$1`, [sale.customer_id]);
    expect(csd.full_name_encrypted).toBe('ENC_NAME');
    expect(JSON.stringify(csd)).not.toContain('محمد');

    // 4) صيانة
    const rep = (await one(
      `select public.op_create_repair($1,$2,null,'شاشة مكسورة','تبديل الشاشة',450) j`, [device, shop])).j;
    expect(rep.operation_number).toMatch(/^REP-/);

    // 5) فرمتة (تتطلب موافقة المالك)
    await expect(db.query(`select public.op_create_format_record($1,$2,null,'إعادة ضبط',false)`, [device, shop]))
      .rejects.toThrow(/CONSENT_REQUIRED/);
    const fmt = (await one(
      `select public.op_create_format_record($1,$2,null,'إعادة ضبط',true) j`, [device, shop])).j;
    expect(fmt.operation_number).toMatch(/^FMT-/);

    // 6) بلاغ سرقة
    await asUser(db, ctx.officer);
    const report = (await one(
      `select public.op_create_stolen_report($1, now(), 'جدة', 'سُرق الجهاز من المتجر', 'high') j`, [VALID_IMEI])).j;

    // مسار الحالات
    await db.query(`select public.op_update_report_status($1,'submitted')`, [report.id]);
    await db.query(`select public.op_update_report_status($1,'under_review')`, [report.id]);
    await db.query(`select public.op_update_report_status($1,'verified')`, [report.id]);
    await db.query(`select public.op_update_report_status($1,'active')`, [report.id]);

    // الجهاز صار مبلّغًا عنه
    const flagged = await one(`select status, is_flagged from public.devices where id=$1`, [device]);
    expect(flagged.is_flagged).toBe(true);
    expect(flagged.status).toBe('reported_stolen');

    // انتقال غير مسموح
    await expect(db.query(`select public.op_update_report_status($1,'draft')`, [report.id]))
      .rejects.toThrow(/INVALID_TRANSITION/);

    // 7) الصيانة على جهاز مبلّغ تُمنع + حدث أمني
    await asUser(db, ctx.manager);
    await expect(db.query(`select public.op_create_repair($1,$2,null,'فحص',null,0)`, [device, shop]))
      .rejects.toThrow(/SECURITY_BLOCK/);

    // فحص IMEI يعطي تنبيهًا أمنيًا دون كشف المبلّغ
    const check = (await one(`select public.op_check_imei($1) j`, [VALID_IMEI])).j;
    expect(check.security_alert).toBe(true);
    expect(JSON.stringify(check)).not.toContain(ctx.officer);

    // 8) إحالة (تفادي تسرّب أعلام الجلسة)
    await asUser(db, ctx.investigator);
    await db.query(`select public.op_assign_report($1,$2)`, [report.id, ctx.investigator]);
    const assigned = await one(`select status, assigned_to from public.stolen_reports where id=$1`, [report.id]);
    expect(assigned.status).toBe('assigned');
    expect(assigned.assigned_to).toBe(ctx.investigator);

    // بعد الإحالة: تغيير الحالة ما زال يعمل (لا تسرّب علم)
    await db.query(`select public.op_add_report_follow_up($1,'تم تحديد موقع المشتبه به')`, [report.id]);
    await db.query(`select public.op_update_report_status($1,'recovered','تم استرداد الجهاز')`, [report.id]);
    // وتحديث الإحالة بعد تغيير الحالة يعمل أيضًا
    await db.query(`select public.op_assign_report($1,$2)`, [report.id, ctx.investigator]);

    const recovered = await one(`select status, is_flagged from public.devices where id=$1`, [device]);
    expect(recovered.status).toBe('recovered');
    expect(recovered.is_flagged).toBe(false);

    // 9) إغلاق
    await asUser(db, ctx.officer);
    await db.query(`select public.op_update_report_status($1,'closed','إغلاق بعد الاسترداد')`, [report.id]);
    expect((await one(`select status from public.stolen_reports where id=$1`, [report.id])).status).toBe('closed');

    // 10) تفاصيل البلاغ (اختبار أقواس jsonb_agg/coalesce)
    const detail = (await one(`select public.op_get_report_detail($1) j`, [report.id])).j;
    expect(Array.isArray(detail.history)).toBe(true);
    expect(detail.history.length).toBeGreaterThanOrEqual(5);
    expect(detail.follow_ups.length).toBe(1);
    expect(detail.report.reporter_contact_encrypted).toBeUndefined();

    // 11) الخط الزمني للجهاز
    const timeline = (await one(`select public.op_get_device_timeline($1) j`, [device])).j;
    expect(timeline.length).toBeGreaterThanOrEqual(5);

    // 12) سلسلة التدقيق سليمة بعد كل ذلك
    const broken = await db.query(`select * from public.verify_audit_chain(5000) where not is_valid`);
    expect(broken.rows).toEqual([]);

    // 13) لوحة التحكم والتقارير
    await asUser(db, ctx.admin);
    const dash = (await one(`select public.op_get_dashboard() j`)).j;
    expect(Number(dash.devices_total)).toBeGreaterThanOrEqual(1);
    expect(Number(dash.reports_recovered)).toBeGreaterThanOrEqual(0);
    const rpt = (await one(
      `select public.op_generate_report('sales', now() - interval '1 day', now() + interval '1 day') j`)).j;
    expect(Number(rpt.data.count)).toBe(1);
  }, 120000);
});

describe('انحدار: الوصول للبيانات الحساسة مسجَّل ومبرَّر', () => {
  it('يرفض بلا مبرر ويسجّل عند القبول', async () => {
    await asUser(db, ctx.investigator); await setAal(db, 'aal2');
    const cust = (await one(`select id from public.customers limit 1`)).id;
    await expect(db.query(`select public.op_access_sensitive_data($1,'قصير')`, [cust]))
      .rejects.toThrow(/JUSTIFICATION_REQUIRED/);
    await db.query(`select public.op_access_sensitive_data($1,'مطلوب لأغراض التحقيق في القضية رقم 12')`, [cust]);
    const { rows } = await db.query(
      `select count(*) c from public.sensitive_data_access_logs where entity_id = $1`, [cust]);
    expect(Number(rows[0].c)).toBe(1);
  });
});
