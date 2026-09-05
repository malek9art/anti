# 2) قاعدة البيانات: التصفير وتشغيل المخطط

## أ) التصفير (اختياري لكن موصى به قبل أول تشغيل)

> ⚠️ **تحذير:** يحذف كل بيانات المنصة وكائناتها. لا يمس `auth.users`.

1. افتح **Supabase → SQL Editor → New query**.
2. الصق كامل محتوى [`supabase/scripts/reset_all_objects.sql`](../supabase/scripts/reset_all_objects.sql).
3. اضغط **Run**. السكربت Idempotent — يمكن تكراره بأمان.

## ب) تشغيل المخطط

1. افتح **SQL Editor → New query**.
2. الصق كامل محتوى [`supabase/schema.sql`](../supabase/schema.sql)
   (ملف واحد مدمج آليًا من `supabase/migrations/`).
3. اضغط **Run**.

النتيجة المتوقعة: `Success. No rows returned`.

## ج) التحقق السريع

```sql
-- يجب أن يعيد true ثم false
select public.is_valid_imei('490154203237518') as should_be_true,
       public.is_valid_imei('490154203237519') as should_be_false;

-- يجب أن يعيد 7 أدوار و31 صلاحية
select (select count(*) from public.roles) as roles,
       (select count(*) from public.permissions) as permissions;

-- يجب ألا يعيد أي صف (كل الجداول عليها RLS)
select c.relname from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
```

## د) مصدر الحقيقة

`supabase/migrations/` هو المصدر. الملف المدمج يُولَّد بـ:

```bash
npm run sql:bundle
```

و`npm run verify` يفشل إذا كان الملف المدمج غير متزامن مع المجلد.
