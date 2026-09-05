-- 0009: تفعيل RLS بمبدأ المنع افتراضيًا
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- إلغاء أي منح مباشرة للأدوار العامة على الجداول
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- سياسات قراءة محدودة جدًا (كل الكتابة عبر SECURITY DEFINER)
drop policy if exists p_users_self_read on public.users;
create policy p_users_self_read on public.users
  for select to authenticated
  using (id = auth.uid() or public.has_permission('manage_users'));

drop policy if exists p_notifications_self on public.notifications;
create policy p_notifications_self on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists p_roles_read on public.roles;
create policy p_roles_read on public.roles for select to authenticated using (true);

drop policy if exists p_permissions_read on public.permissions;
create policy p_permissions_read on public.permissions for select to authenticated using (true);

drop policy if exists p_user_roles_self on public.user_roles;
create policy p_user_roles_self on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('manage_permissions'));

-- منح select فقط للجداول التي لها سياسات صريحة
grant select on public.users, public.notifications, public.roles, public.permissions, public.user_roles to authenticated;

-- لا شيء لـ anon
revoke all on all tables in schema public from anon;
