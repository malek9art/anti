-- 0019: طلبات تفعيل الحسابات — التسجيل الذاتي باختيار الدور ثم موافقة الإدارة
-- التدفق: المستخدم يختار دوره ← يدخل بياناته حسب الدور ← يُنشأ حساب «مدعو»
-- ← يظهر طلبه للإدارة ← عند الموافقة يُفعَّل ويُسند إليه الدور ← يستطيع الدخول.

create table if not exists public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  requested_role text not null references public.roles(code),
  payload jsonb not null default '{}'::jsonb,  -- بيانات إضافية تختلف حسب الدور (محل/جهة/تخصص…)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- لا وصول مباشر للجدول إطلاقًا؛ كل شيء عبر دوال SECURITY DEFINER أو عميل الخدمة
alter table public.signup_requests enable row level security;
alter table public.signup_requests force row level security;

create unique index if not exists signup_requests_pending_unique
  on public.signup_requests (user_id) where status = 'pending';

-- عرض طلبات التفعيل (للإدارة)
create or replace function public.op_get_signup_requests(p_limit int default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
begin
  perform public.require_permission('manage_users');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'full_name', q.full_name, 'email', q.email, 'phone', q.phone,
      'requested_role', q.requested_role, 'payload', q.payload, 'created_at', q.created_at
    ) order by q.created_at asc)
    from (
      select s.id, s.full_name, s.email, s.phone, s.requested_role, s.payload, s.created_at
      from public.signup_requests s
      where s.status = 'pending'
      order by s.created_at asc
      limit p_limit
    ) q
  ), '[]'::jsonb);
end;
$func$;

-- الموافقة على طلب: تفعيل الحساب + إسناد الدور المطلوب + تدقيق
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

  update public.signup_requests
    set status = 'approved', decided_by = v_actor, decided_at = now()
    where id = p_request_id;

  perform private.append_audit_log(v_actor, 'approve_signup', 'user', v_req.user_id,
    jsonb_build_object('role', v_req.requested_role, 'email', v_req.email));
end;
$func$;

-- رفض الطلب: تعطيل الحساب + تدقيق
create or replace function public.op_reject_signup(p_request_id uuid, p_reason text default null)
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

  update public.users set status = 'disabled', updated_at = now() where id = v_req.user_id;

  update public.signup_requests
    set status = 'rejected', decided_by = v_actor, decided_at = now(),
        payload = payload || jsonb_build_object('reject_reason', coalesce(p_reason, ''))
    where id = p_request_id;

  perform private.append_audit_log(v_actor, 'reject_signup', 'user', v_req.user_id,
    jsonb_build_object('email', v_req.email, 'reason', coalesce(p_reason, '')));
end;
$func$;

grant execute on function public.op_get_signup_requests to authenticated;
grant execute on function public.op_approve_signup to authenticated;
grant execute on function public.op_reject_signup to authenticated;
