-- 0021: عند موافقة الإدارة على طلب التفعيل يُعدّ البريد مؤكدًا تلقائيًا
-- السبب: إنشاء الحساب عبر التسجيل الذاتي يترك email_confirmed_at فارغًا،
-- وموافقة الإدارة (aal2 + صلاحية manage_users) هي التحقق المعتمد في هذا النظام،
-- فلا معنى لمنع الدخول برسالة «لم يتم تأكيد البريد الإلكتروني» بعد الموافقة.

create or replace function public.op_approve_signup(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $func$
declare
  v_actor uuid := auth.uid();
  v_req public.signup_requests%rowtype;
begin
  perform public.require_permission('manage_users');
  perform private.require_aal2();

  select * into v_req from public.signup_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'NOT_FOUND: الطلب غير موجود أو تمت معالجته' using errcode = 'P0002';
  end if;

  -- أنشئ الملف الشخصي إن لم يوجد ثم فعّله
  insert into public.users (id, full_name, email, phone, status, created_by)
  values (v_req.user_id, v_req.full_name, v_req.email, v_req.phone, 'active', v_actor)
  on conflict (id) do update
    set status = 'active', full_name = excluded.full_name, phone = excluded.phone, updated_at = now();

  -- إسناد الدور المطلوب (دون حذف أدوار قائمة)
  insert into public.user_roles (user_id, role_id, granted_by)
  select v_req.user_id, r.id, v_actor from public.roles r where r.code = v_req.requested_role
  on conflict do nothing;

  -- موافقة الإدارة = تأكيد البريد (حتى لا يُمنع الدخول برسالة تأكيد البريد)
  update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = v_req.user_id;

  update public.signup_requests
    set status = 'approved', decided_by = v_actor, decided_at = now()
    where id = p_request_id;

  perform private.append_audit_log(v_actor, 'approve_signup', 'user', v_req.user_id,
    jsonb_build_object('role', v_req.requested_role, 'email', v_req.email));
end;
$func$;

-- إصلاح فوري للحسابات التي وافقت عليها الإدارة سابقًا ولم يُؤكَّد بريدها
update auth.users u
  set email_confirmed_at = now()
  from public.signup_requests s
  where s.user_id = u.id
    and s.status = 'approved'
    and u.email_confirmed_at is null;
