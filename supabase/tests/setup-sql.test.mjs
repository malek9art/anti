import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const ADMIN_ID = 'e6088d05-c472-4059-9c0f-3660190bbcb0';
const ADMIN_EMAIL = 'alahmdyalahmdyalahmdy13@gmail.com';

const PRELUDE = `
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists private;
create or replace function extensions.gen_random_uuid() returns uuid
  language sql volatile as $fn$ select gen_random_uuid() $fn$;
create or replace function extensions.digest(p_data text, p_type text) returns bytea
  language sql immutable as $fn$ select decode(md5(p_data) || md5(md5(p_data) || p_type), 'hex') $fn$;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), email text unique,
  created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable
  as $fn$ select nullif(current_setting('test.user_id', true), '')::uuid $fn$;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean not null default false);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text);
do $do$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $do$;
`;

let db;

beforeAll(async () => {
  db = await new PGlite();
  await db.exec(PRELUDE);
  // المستخدم موجود مسبقًا في auth.users كما هو الحال في المشروع الفعلي
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [ADMIN_ID, ADMIN_EMAIL]);

  const sql = readFileSync(new URL('../SETUP.sql', import.meta.url), 'utf8')
    .replace(/create extension[^;]+;/gi, '');
  await db.exec(sql);
}, 300000);

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

describe('ملف التهيئة SETUP.sql', () => {
  it('ينفَّذ بالكامل دفعة واحدة دون أخطاء', async () => {
    expect(Number((await one(`select count(*) c from public.permissions`)).c)).toBe(31);
    expect(Number((await one(`select count(*) c from public.roles`)).c)).toBe(7);
  });

  it('يربط مستخدم الإدارة المحدد بدور system_admin', async () => {
    const row = await one(
      `select u.email, u.status, r.code
         from public.users u
         join public.user_roles ur on ur.user_id = u.id
         join public.roles r on r.id = ur.role_id
        where u.id = $1`, [ADMIN_ID]);
    expect(row.email).toBe(ADMIN_EMAIL);
    expect(row.status).toBe('active');
    expect(row.code).toBe('system_admin');
  });

  it('يمنح مدير النظام كل الصلاحيات الـ31', async () => {
    const { rows } = await db.query(
      `select count(distinct p.code) c
         from public.user_roles ur
         join public.role_permissions rp on rp.role_id = ur.role_id
         join public.permissions p on p.id = rp.permission_id
        where ur.user_id = $1`, [ADMIN_ID]);
    expect(Number(rows[0].c)).toBe(31);
  });

  it('إعادة التشغيل آمنة (Idempotent) ولا تُكرر الأدوار', async () => {
    const sql = readFileSync(new URL('../SETUP.sql', import.meta.url), 'utf8')
      .replace(/create extension[^;]+;/gi, '');
    await db.exec(sql);
    const { rows } = await db.query(
      `select count(*) c from public.user_roles where user_id = $1`, [ADMIN_ID]);
    expect(Number(rows[0].c)).toBe(1);
    expect(Number((await one(`select count(*) c from public.permissions`)).c)).toBe(31);
  }, 300000);

  it('ينشئ دلاء التخزين الثلاثة، وbranding وحده عام', async () => {
    const { rows } = await db.query(
      `select id, public from storage.buckets order by id`);
    const map = Object.fromEntries(rows.map((r) => [r.id, r.public]));
    expect(map['branding']).toBe(true);
    expect(map['device-media']).toBe(false);
    expect(map['evidence']).toBe(false);
  });
});

describe('إدارة الشعار من لوحة الإدارة', () => {
  it('op_get_branding يعمل قبل تسجيل الدخول ويعيد الافتراضي', async () => {
    await db.query(`select set_config('test.user_id', '', false)`);
    const b = (await one(`select public.op_get_branding() j`)).j;
    expect(b.logo_path).toBe('');
    expect(b.primary_color).toBe('#0B3D2E');
    expect(b.accent_color).toBe('#C9A24D');
  });

  it('يرفض تغيير الشعار بلا صلاحية', async () => {
    const { rows } = await db.query(`insert into auth.users (email) values ('nobody@test.local') returning id`);
    const id = rows[0].id;
    await db.query(
      `insert into public.users (id, full_name, email, status) values ($1,'بلا صلاحيات','nobody@test.local','active')`, [id]);
    await db.query(`select set_config('test.user_id', $1, false)`, [id]);
    await db.query(`select set_config('request.jwt.claims', '{"aal":"aal2"}', false)`);
    await expect(db.query(`select public.op_set_branding_logo('logo/x.png')`))
      .rejects.toThrow(/PERMISSION_DENIED/);
  });

  it('يرفض تغيير الشعار عند AAL1 حتى مع الصلاحية', async () => {
    await db.query(`select set_config('test.user_id', $1, false)`, [ADMIN_ID]);
    await db.query(`select set_config('request.jwt.claims', '{"aal":"aal1"}', false)`);
    await expect(db.query(`select public.op_set_branding_logo('logo/x.png')`))
      .rejects.toThrow(/MFA_REQUIRED/);
  });

  it('يحفظ الشعار ويرفع رقم الإصدار ويسجّل في التدقيق', async () => {
    await db.query(`select set_config('test.user_id', $1, false)`, [ADMIN_ID]);
    await db.query(`select set_config('request.jwt.claims', '{"aal":"aal2"}', false)`);

    const r1 = (await one(`select public.op_set_branding_logo('logo/a.png') j`)).j;
    expect(r1.logo_path).toBe('logo/a.png');
    expect(Number(r1.logo_version)).toBe(1);

    const r2 = (await one(`select public.op_set_branding_logo('logo/b.png') j`)).j;
    expect(Number(r2.logo_version)).toBe(2);

    const b = (await one(`select public.op_get_branding() j`)).j;
    expect(b.logo_path).toBe('logo/b.png');
    expect(b.logo_version).toBe('2');

    const audit = await one(
      `select count(*) c from public.audit_logs where action = 'set_branding_logo'`);
    expect(Number(audit.c)).toBe(2);
  });

  it('إعادة الافتراضي تُفرّغ المسار', async () => {
    await db.query(`select public.op_reset_branding_logo()`);
    const b = (await one(`select public.op_get_branding() j`)).j;
    expect(b.logo_path).toBe('');
  });

  it('سلسلة التدقيق تبقى سليمة بعد تغييرات الشعار', async () => {
    const { rows } = await db.query(`select * from public.verify_audit_chain(5000) where not is_valid`);
    expect(rows).toEqual([]);
  });
});
