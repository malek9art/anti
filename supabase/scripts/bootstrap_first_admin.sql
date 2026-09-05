-- إنشاء أول مدير — بعد تسجيل المستخدم عبر شاشة الدخول (Supabase Auth)
-- لا UUID ولا بريد ثابت: ضع بريد المستخدم الذي سجّلته أنت.
-- التشغيل في Supabase SQL Editor.

do $$
declare
  -- ✏️ غيّر البريد التالي إلى بريد الحساب الذي سجّلته من شاشة الدخول:
  v_email text := 'CHANGE_ME@example.com';
  v_auth_id uuid;
  v_role uuid;
begin
  select id into v_auth_id from auth.users where lower(email) = lower(v_email);
  if v_auth_id is null then
    raise exception 'لم يُعثر على مستخدم Auth بالبريد %. سجّل الدخول أولًا من التطبيق.', v_email;
  end if;

  insert into public.users (id, full_name, email, status)
  values (v_auth_id, coalesce(split_part(v_email,'@',1),'المدير'), v_email, 'active')
  on conflict (id) do update set status = 'active';

  select id into v_role from public.roles where code = 'system_admin';
  insert into public.user_roles (user_id, role_id) values (v_auth_id, v_role)
  on conflict do nothing;

  raise notice 'تم إنشاء المدير الأول: %', v_email;
end $$;
