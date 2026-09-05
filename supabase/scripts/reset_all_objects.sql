-- سكربت تصفير كامل (Idempotent) — يمسح كائنات البناء السابق فقط في public/private
-- ⚠️ تحذير: يحذف كل بيانات المنصة. لا يمس auth.users.
do $$
declare r record;
begin
  -- حذف المشغلات
  for r in
    select event_object_schema s, event_object_table t, trigger_name n
    from information_schema.triggers
    where event_object_schema in ('public')
  loop
    execute format('drop trigger if exists %I on %I.%I cascade', r.n, r.s, r.t);
  end loop;

  -- حذف الدوال
  for r in
    select n.nspname s, p.oid::regprocedure sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private')
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;

  -- حذف الجداول
  for r in select tablename t from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.t);
  end loop;
  for r in select tablename t from pg_tables where schemaname = 'private' loop
    execute format('drop table if exists private.%I cascade', r.t);
  end loop;

  -- حذف الأنواع
  for r in
    select t.typname n from pg_type t join pg_namespace ns on ns.oid = t.typnamespace
    where ns.nspname = 'public' and t.typtype = 'e'
  loop
    execute format('drop type if exists public.%I cascade', r.n);
  end loop;

  -- حذف الواجهات (views)
  for r in select viewname v from pg_views where schemaname = 'public' loop
    execute format('drop view if exists public.%I cascade', r.v);
  end loop;
end $$;

-- تنظيف كائنات التخزين الخاصة بالمنصة
delete from storage.objects where bucket_id in ('device-media','evidence');
delete from storage.buckets where id in ('device-media','evidence');

drop schema if exists private cascade;
