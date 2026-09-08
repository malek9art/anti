-- 0018: إنشاء مستخدم جديد من لوحة الإدارة (ملف شخصي + أدوار + تدقيق)
-- ملاحظة: إنشاء حساب auth يتم في Edge Function بمفتاح الخدمة،
-- وهذه الدالة تُنشئ الملف الشخصي وتسند الأدوار وتسجّل العملية بعد التحقق من الصلاحيات.

create or replace function public.op_create_user_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_roles text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $func$
declare
  v_actor uuid := auth.uid();
begin
  perform public.require_permission('manage_users');
  perform private.require_aal2();

  if p_user_id is null then
    raise exception 'INVALID_INPUT: معرّف المستخدم مطلوب' using errcode = '22023';
  end if;
  if coalesce(trim(p_full_name), '') = '' or length(trim(p_full_name)) < 3 then
    raise exception 'INVALID_INPUT: الاسم الكامل مطلوب (3 أحرف على الأقل)' using errcode = '22023';
  end if;
  if coalesce(trim(p_email), '') = '' or position('@' in p_email) = 0 then
    raise exception 'INVALID_INPUT: بريد إلكتروني غير صالح' using errcode = '22023';
  end if;
  if exists (select 1 from public.users where id = p_user_id) then
    raise exception 'DUPLICATE: هذا المستخدم مسجّل مسبقًا' using errcode = '23505';
  end if;

  -- ينشأ الحساب مفعّلًا مباشرة لأن الإدارة هي من أنشأه (اعتماد مسبق)
  insert into public.users (id, full_name, email, status, created_by)
  values (p_user_id, trim(p_full_name), lower(trim(p_email)), 'active', v_actor);

  if p_roles is not null and array_length(p_roles, 1) is not null then
    insert into public.user_roles (user_id, role_id, granted_by)
    select p_user_id, r.id, v_actor
    from public.roles r
    where r.code = any(p_roles);
  end if;

  perform private.append_audit_log(v_actor, 'create_user', 'user', p_user_id,
    jsonb_build_object('email', lower(trim(p_email)), 'roles', to_jsonb(coalesce(p_roles, '{}'))));

  return jsonb_build_object('id', p_user_id, 'email', lower(trim(p_email)));
end;
$func$;

grant execute on function public.op_create_user_profile to authenticated;
