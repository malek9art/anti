-- 0007: الدوال الأساسية (IMEI/Luhn، الصلاحيات، التدقيق المتسلسل)

-- التحقق من IMEI: 15 رقمًا + خوارزمية Luhn
create or replace function public.is_valid_imei(p_imei text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_sum int := 0;
  v_digit int;
  v_double boolean := false;
  i int;
begin
  if p_imei is null then return false; end if;
  if p_imei !~ '^[0-9]{15}$' then return false; end if;
  -- ملاحظة: يجب أن تكون الحلقة تنازلية reverse 15..1 وليست reverse 1..15
  for i in reverse 15..1 loop
    v_digit := substr(p_imei, i, 1)::int;
    if v_double then
      v_digit := v_digit * 2;
      if v_digit > 9 then v_digit := v_digit - 9; end if;
    end if;
    v_sum := v_sum + v_digit;
    v_double := not v_double;
  end loop;
  return (v_sum % 10) = 0;
end;
$$;

create or replace function public.current_app_user()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$ select auth.uid() $$;

create or replace function public.has_permission(p_permission text, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.users u on u.id = ur.user_id
    where ur.user_id = p_user
      and p.code = p_permission
      and u.status = 'active'
  );
$$;

create or replace function public.has_role(p_role text, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user and r.code = p_role
  );
$$;

create or replace function public.require_permission(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_permission) then
    raise exception 'PERMISSION_DENIED: %', p_permission using errcode = '42501';
  end if;
end;
$$;

-- سجل التدقيق المتسلسل (hash chain)
create or replace function private.append_audit_log(
  p_actor uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_prev text;
  v_hash text;
  v_id uuid;
  v_created timestamptz := now();
begin
  select entry_hash into v_prev
  from public.audit_logs
  order by sequence_number desc
  limit 1;

  v_hash := encode(
    extensions.digest(
      coalesce(v_prev, 'GENESIS') || '|' || coalesce(p_actor::text, 'system') || '|' || p_action || '|'
        || p_entity_type || '|' || coalesce(p_entity_id::text, '-') || '|' || p_payload::text || '|' || v_created::text,
      'sha256'),
    'hex');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, payload, previous_hash, entry_hash, created_at)
  values (p_actor, p_action, p_entity_type, p_entity_id, p_payload, v_prev, v_hash, v_created)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.verify_audit_chain(p_limit int default 1000)
returns table (sequence_number bigint, is_valid boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  r record;
  v_prev text := null;
  v_expected text;
  v_first boolean := true;
begin
  for r in
    select a.sequence_number, a.actor_id, a.action, a.entity_type, a.entity_id, a.payload,
           a.previous_hash, a.entry_hash, a.created_at
    from public.audit_logs a
    order by a.sequence_number asc
    limit p_limit
  loop
    v_expected := encode(
      extensions.digest(
        coalesce(case when v_first then r.previous_hash else v_prev end, 'GENESIS') || '|'
          || coalesce(r.actor_id::text, 'system') || '|' || r.action || '|' || r.entity_type || '|'
          || coalesce(r.entity_id::text, '-') || '|' || r.payload::text || '|' || r.created_at::text,
        'sha256'),
      'hex');
    sequence_number := r.sequence_number;
    is_valid := (v_expected = r.entry_hash);
    v_prev := r.entry_hash;
    v_first := false;
    return next;
  end loop;
end;
$$;

-- منع الحذف/التعديل على السجلات الحرجة (append-only)
create or replace function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'APPEND_ONLY: الجدول % لا يسمح بالتعديل أو الحذف', tg_table_name using errcode = '42501';
end;
$$;
