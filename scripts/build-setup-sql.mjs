#!/usr/bin/env node
// يولّد ملف تهيئة واحد جاهز للصق في Supabase SQL Editor:
// المخطط الكامل + ربط مستخدم الإدارة + تحقق نهائي
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const migDir = join(root, 'supabase/migrations');
const outFile = join(root, 'supabase/SETUP.sql');
const check = process.argv.includes('--check');

const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
const adminSql = readFileSync(join(root, 'supabase/scripts/link_admin_user.sql'), 'utf8');

const header = `-- ============================================================================
--  حماية | نظام مكافحة سرقة الأجهزة
--  ملف التهيئة الكامل لقاعدة البيانات — جاهز للتنفيذ اليدوي
-- ============================================================================
--  الاستخدام:
--    1. افتح Supabase → SQL Editor → New query
--    2. الصق هذا الملف بالكامل
--    3. اضغط Run
--
--  ملاحظات:
--    • السكربت Idempotent — تشغيله أكثر من مرة آمن.
--    • إن أردت البدء من الصفر، شغّل أولًا:
--      supabase/scripts/reset_all_objects.sql
--    • يربط تلقائيًا مستخدم الإدارة:
--      alahmdyalahmdyalahmdy13@gmail.com
--      (يجب أن يكون موجودًا في auth.users قبل التشغيل)
--
--  مولّد آليًا من supabase/migrations — لا تعدّله يدويًا.
--  لإعادة التوليد: npm run sql:setup
--  عدد ملفات المخطط المدمجة: ${files.length}
-- ============================================================================

`;

const schema = files
  .map((f) => `\n-- ==================== ${f} ====================\n${readFileSync(join(migDir, f), 'utf8').trim()}\n`)
  .join('');

const adminSection = `

-- ============================================================================
-- ==================== ربط مستخدم الإدارة ====================
-- ============================================================================
${adminSql.trim()}
`;

const verify = `

-- ============================================================================
-- ==================== التحقق النهائي ====================
-- ============================================================================
-- النتائج المتوقعة موضّحة في عمود "المتوقع".

select 'خوارزمية Luhn — رقم صحيح'  as "الفحص",
       public.is_valid_imei('490154203237518')::text as "النتيجة", 'true'  as "المتوقع"
union all
select 'خوارزمية Luhn — رقم خاطئ',
       public.is_valid_imei('490154203237519')::text, 'false'
union all
select 'عدد الأدوار',
       (select count(*)::text from public.roles), '7'
union all
select 'عدد الصلاحيات',
       (select count(*)::text from public.permissions), '31'
union all
select 'جداول بلا RLS (يجب أن يكون صفرًا)',
       (select count(*)::text from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), '0'
union all
select 'صلاحيات ممنوحة لدور anon (يجب أن يكون صفرًا)',
       (select count(*)::text from information_schema.role_table_grants
         where grantee = 'anon' and table_schema = 'public'), '0'
union all
select 'دلاء التخزين',
       (select count(*)::text from storage.buckets
         where id in ('device-media','evidence','branding')), '3'
union all
select 'مدراء النظام المرتبطون',
       (select count(*)::text from public.user_roles ur
          join public.roles r on r.id = ur.role_id
         where r.code = 'system_admin'), '1 أو أكثر';
`;

const bundle = header + schema + adminSection + verify;

if (check) {
  if (!existsSync(outFile) || readFileSync(outFile, 'utf8') !== bundle) {
    console.error('✗ supabase/SETUP.sql غير متزامن. شغّل npm run sql:setup');
    process.exit(1);
  }
  console.log('✓ ملف التهيئة SETUP.sql متزامن');
} else {
  writeFileSync(outFile, bundle);
  console.log(`✓ تم توليد supabase/SETUP.sql (${files.length} ملف مخطط + ربط المدير + تحقق)`);
}
