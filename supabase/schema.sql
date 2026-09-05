-- ملف المخطط المدمج — مولّد آليًا من supabase/migrations
-- لا تعدّله يدويًا. شغّل: npm run sql:bundle
-- الملفات المدمجة: 14


-- ==================== 0001_extensions_and_enums.sql ====================
-- 0001: الامتدادات والأنواع المعدودة
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.device_status as enum ('registered','sold','in_repair','formatted','reported_stolen','under_alert','recovered','retired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('draft','submitted','under_review','verified','active','assigned','recovered','closed','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_priority as enum ('low','normal','high','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.evidence_status as enum ('pending','accepted','rejected','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('invited','active','suspended','disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.shop_status as enum ('pending','approved','suspended','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum ('device','report','shop','user','system','security');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_severity as enum ('info','important','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_type as enum ('image','document','video','audio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum ('unverified','pending','verified','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.access_level as enum ('public','restricted','confidential','secret');
exception when duplicate_object then null; end $$;


-- ==================== 0002_identity_tables.sql ====================
-- 0002: الهوية والصلاحيات والجهات والمحلات
create table if not exists public.roles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  description_ar text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  category text not null default 'general',
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.agencies (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default extensions.gen_random_uuid(),
  name_ar text not null,
  parent_id uuid references public.locations(id) on delete set null,
  level int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  national_id_hash text,
  agency_id uuid references public.agencies(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  status public.account_status not null default 'invited',
  mfa_enrolled boolean not null default false,
  last_login_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  granted_by uuid references public.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.delegates (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  badge_number text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default extensions.gen_random_uuid(),
  name_ar text not null,
  license_number text not null unique,
  owner_name text not null,
  contact_phone text not null,
  address text,
  location_id uuid references public.locations(id) on delete set null,
  status public.shop_status not null default 'pending',
  submitted_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_users (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role_in_shop text not null default 'staff',
  is_active boolean not null default true,
  linked_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create table if not exists public.technicians (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  certificate_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, shop_id)
);

create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_shop_users_user on public.shop_users(user_id);
create index if not exists idx_shops_status on public.shops(status);


-- ==================== 0003_device_tables.sql ====================
-- 0003: الأجهزة
create table if not exists public.devices (
  id uuid primary key default extensions.gen_random_uuid(),
  brand text not null,
  model text not null,
  color text,
  serial_number text,
  status public.device_status not null default 'registered',
  is_flagged boolean not null default false,
  flag_reason text,
  current_shop_id uuid references public.shops(id) on delete set null,
  registered_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.device_imeis (
  id uuid primary key default extensions.gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  imei text not null unique,
  slot smallint not null default 1 check (slot in (1,2)),
  verification public.verification_status not null default 'verified',
  created_at timestamptz not null default now(),
  unique (device_id, slot)
);

create table if not exists public.device_media (
  id uuid primary key default extensions.gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  storage_path text not null,
  media_type public.media_type not null default 'image',
  caption text,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.device_events (
  id uuid primary key default extensions.gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  event_type text not null,
  description_ar text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.device_status_transitions (
  id uuid primary key default extensions.gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  from_status public.device_status,
  to_status public.device_status not null,
  reason text,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_device_imeis_imei on public.device_imeis(imei);
create index if not exists idx_device_events_device on public.device_events(device_id, created_at desc);


-- ==================== 0004_commerce_tables.sql ====================
-- 0004: التجارة والصيانة
create table if not exists public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  display_reference text not null unique,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_sensitive_data (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  full_name_encrypted text not null,
  phone_encrypted text not null,
  national_id_encrypted text,
  full_name_hash text not null,
  phone_hash text not null,
  national_id_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_number text not null unique,
  shop_id uuid not null references public.shops(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  sold_by uuid not null references public.users(id) on delete restrict,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default extensions.gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete restrict,
  price numeric(14,2) not null check (price >= 0),
  warranty_months int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.repair_records (
  id uuid primary key default extensions.gen_random_uuid(),
  operation_number text not null unique,
  device_id uuid not null references public.devices(id) on delete restrict,
  shop_id uuid not null references public.shops(id) on delete restrict,
  technician_id uuid references public.technicians(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  fault_description text not null,
  actions_taken text,
  cost numeric(14,2) not null default 0 check (cost >= 0),
  security_check_passed boolean not null default true,
  received_at timestamptz not null default now(),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.format_records (
  id uuid primary key default extensions.gen_random_uuid(),
  operation_number text not null unique,
  device_id uuid not null references public.devices(id) on delete restrict,
  shop_id uuid not null references public.shops(id) on delete restrict,
  technician_id uuid references public.technicians(id) on delete set null,
  reason text not null,
  owner_consent boolean not null default false,
  security_check_passed boolean not null default true,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_sales_shop on public.sales(shop_id, sold_at desc);
create index if not exists idx_sale_items_device on public.sale_items(device_id);
create index if not exists idx_repair_device on public.repair_records(device_id);
create index if not exists idx_csd_phone_hash on public.customer_sensitive_data(phone_hash);
create index if not exists idx_csd_nid_hash on public.customer_sensitive_data(national_id_hash);


-- ==================== 0005_report_tables.sql ====================
-- 0005: بلاغات السرقة والأدلة
create table if not exists public.stolen_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  report_number text not null unique,
  device_id uuid references public.devices(id) on delete set null,
  imei text not null,
  status public.report_status not null default 'draft',
  priority public.report_priority not null default 'normal',
  incident_at timestamptz not null,
  incident_location text,
  narrative text not null,
  reporter_id uuid not null references public.users(id) on delete restrict,
  reporter_contact_encrypted text,
  assigned_to uuid references public.users(id) on delete set null,
  assigned_agency_id uuid references public.agencies(id) on delete set null,
  assigned_at timestamptz,
  recovered_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_status_history (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid not null references public.stolen_reports(id) on delete cascade,
  from_status public.report_status,
  to_status public.report_status not null,
  note text,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.report_status_transitions (
  from_status public.report_status not null,
  to_status public.report_status not null,
  required_permission text not null,
  primary key (from_status, to_status)
);

create table if not exists public.report_follow_ups (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid not null references public.stolen_reports(id) on delete cascade,
  body text not null,
  is_internal boolean not null default true,
  actor_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid not null references public.stolen_reports(id) on delete cascade,
  storage_path text not null,
  media_type public.media_type not null default 'image',
  description text,
  access_level public.access_level not null default 'restricted',
  status public.evidence_status not null default 'pending',
  checksum text,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_access_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  accessed_by uuid not null references public.users(id) on delete restrict,
  purpose text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_status on public.stolen_reports(status);
create index if not exists idx_reports_imei on public.stolen_reports(imei);
create index if not exists idx_reports_assigned on public.stolen_reports(assigned_to);


-- ==================== 0006_governance_tables.sql ====================
-- 0006: الرقابة والتدقيق
create table if not exists public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  sequence_number bigint generated always as identity,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  previous_hash text,
  entry_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_audit_sequence on public.audit_logs(sequence_number);

create table if not exists public.sensitive_data_access_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid not null references public.users(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  fields text[] not null default '{}',
  justification text,
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type text not null,
  severity public.notification_severity not null default 'info',
  actor_id uuid references public.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.record_corrections (
  id uuid primary key default extensions.gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  old_value text,
  new_value text,
  reason text not null,
  corrected_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  notification_type public.notification_type not null default 'system',
  severity public.notification_severity not null default 'info',
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description_ar text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.api_rate_limit_windows (
  id uuid primary key default extensions.gen_random_uuid(),
  subject_id uuid,
  subject_ip inet,
  endpoint text not null,
  window_start timestamptz not null,
  request_count int not null default 1
);
create unique index if not exists idx_rate_window on public.api_rate_limit_windows(coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), endpoint, window_start);


-- ==================== 0007_core_functions.sql ====================
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


-- ==================== 0008_append_only_and_state_machine.sql ====================
-- 0008: append-only وآلة حالات البلاغ

do $$
declare t text;
begin
  foreach t in array array[
    'audit_logs','device_events','device_status_transitions','report_status_history',
    'sensitive_data_access_logs','evidence_access_logs','record_corrections',
    'repair_records','format_records','sales','sale_items','report_follow_ups'
  ] loop
    execute format('drop trigger if exists trg_%1$s_append_only on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_append_only before update or delete on public.%1$s for each row execute function private.forbid_mutation()',
      t);
  end loop;
end $$;

-- خريطة الانتقالات المسموحة
insert into public.report_status_transitions (from_status, to_status, required_permission) values
  ('draft','submitted','create_stolen_report'),
  ('submitted','under_review','review_report'),
  ('submitted','rejected','review_report'),
  ('under_review','verified','review_report'),
  ('under_review','rejected','review_report'),
  ('verified','active','change_report_status'),
  ('active','assigned','assign_case'),
  ('assigned','active','assign_case'),
  ('active','recovered','change_report_status'),
  ('assigned','recovered','change_report_status'),
  ('recovered','closed','change_report_status'),
  ('rejected','closed','change_report_status')
on conflict (from_status, to_status) do update set required_permission = excluded.required_permission;

create or replace function public.is_allowed_report_transition(p_from public.report_status, p_to public.report_status)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.report_status_transitions t
    where t.from_status = p_from and t.to_status = p_to
  );
$$;

-- حارس: لا يُسمح بتغيير الحالة إلا عبر الدالة المخوّلة (علم جلسة)
create or replace function private.guard_report_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    if coalesce(current_setting('app.report_status_transition', true), 'off') <> 'on' then
      raise exception 'FORBIDDEN: تغيير حالة البلاغ يتم عبر الدالة المخوّلة فقط' using errcode = '42501';
    end if;
    if not public.is_allowed_report_transition(old.status, new.status) then
      raise exception 'INVALID_TRANSITION: % -> %', old.status, new.status using errcode = '23514';
    end if;
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    if coalesce(current_setting('app.report_assignment', true), 'off') <> 'on' then
      raise exception 'FORBIDDEN: الإحالة تتم عبر الدالة المخوّلة فقط' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_reports_guard on public.stolen_reports;
create trigger trg_reports_guard before update on public.stolen_reports
for each row execute function private.guard_report_update();

create or replace function private.forbid_report_delete()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'APPEND_ONLY: لا يمكن حذف البلاغات' using errcode = '42501';
end $$;

drop trigger if exists trg_reports_no_delete on public.stolen_reports;
create trigger trg_reports_no_delete before delete on public.stolen_reports
for each row execute function private.forbid_report_delete();

-- التحقق من IMEI عند الإدراج
create or replace function private.validate_imei_row()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not public.is_valid_imei(new.imei) then
    raise exception 'INVALID_IMEI: رقم IMEI غير صالح (خانة التحقق)' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_device_imeis_validate on public.device_imeis;
create trigger trg_device_imeis_validate before insert or update on public.device_imeis
for each row execute function private.validate_imei_row();

create or replace function private.validate_report_imei()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not public.is_valid_imei(new.imei) then
    raise exception 'INVALID_IMEI: رقم IMEI غير صالح (خانة التحقق)' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_reports_validate_imei on public.stolen_reports;
create trigger trg_reports_validate_imei before insert on public.stolen_reports
for each row execute function private.validate_report_imei();


-- ==================== 0009_rls.sql ====================
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


-- ==================== 0010_seed_roles_permissions.sql ====================
-- 0010: بذر الأدوار والصلاحيات (لا بيانات تجريبية ولا حسابات)
insert into public.roles (code, name_ar, description_ar) values
  ('system_admin','مدير النظام','صلاحية كاملة على النظام'),
  ('authorized_officer','ضابط مخوّل','مراجعة البلاغات والفحص الأمني'),
  ('investigation_officer','ضابط تحقيق','التحقيق ومتابعة القضايا'),
  ('delegate','مندوب','مندوب ميداني تابع لجهة'),
  ('shop_manager','مدير محل','إدارة محل ومبيعاته وموظفيه'),
  ('technician','فني','تنفيذ الصيانة والفرمتة'),
  ('auditor','مدقّق','الاطلاع على سجلات التدقيق')
on conflict (code) do update set name_ar = excluded.name_ar;

insert into public.permissions (code, name_ar, category) values
  ('view_device','عرض جهاز','devices'),
  ('view_all_devices','عرض كل الأجهزة','devices'),
  ('search_imei','فحص IMEI','devices'),
  ('create_device','تسجيل جهاز','devices'),
  ('create_sale','تسجيل بيع','commerce'),
  ('view_sales','عرض المبيعات','commerce'),
  ('create_repair','تسجيل صيانة','service'),
  ('create_format_record','تسجيل فرمتة','service'),
  ('view_customer','عرض العميل','commerce'),
  ('view_identity','عرض الهوية','sensitive'),
  ('view_sensitive_data','عرض البيانات الحساسة','sensitive'),
  ('create_stolen_report','إنشاء بلاغ سرقة','reports'),
  ('review_report','مراجعة البلاغ','reports'),
  ('view_all_reports','عرض كل البلاغات','reports'),
  ('assign_case','إحالة القضية','reports'),
  ('change_report_status','تغيير حالة البلاغ','reports'),
  ('update_follow_up','تحديث المتابعة','reports'),
  ('upload_evidence','رفع دليل','evidence'),
  ('view_evidence','عرض الأدلة','evidence'),
  ('view_audit_logs','عرض سجل التدقيق','governance'),
  ('manage_shops','إدارة المحلات','shops'),
  ('manage_shop_staff','إدارة موظفي المحل','shops'),
  ('approve_shop','اعتماد محل','shops'),
  ('suspend_shop','تعليق محل','shops'),
  ('manage_users','إدارة المستخدمين','identity'),
  ('manage_permissions','إدارة الصلاحيات','identity'),
  ('view_dashboard','عرض لوحة التحكم','general'),
  ('generate_reports','توليد التقارير','reports'),
  ('view_security_events','عرض الأحداث الأمنية','governance'),
  ('manage_system_settings','إدارة إعدادات النظام','governance'),
  ('correct_record','تصحيح سجل','governance')
on conflict (code) do update set name_ar = excluded.name_ar;

-- ربط الصلاحيات بالأدوار
with mapping(role_code, perm_code) as (
  select 'system_admin', p.code from public.permissions p
  union all select 'authorized_officer', c from unnest(array[
    'view_device','view_all_devices','search_imei','view_sales','view_customer','view_identity',
    'create_stolen_report','review_report','view_all_reports','change_report_status','update_follow_up',
    'view_evidence','upload_evidence','view_dashboard','generate_reports','approve_shop','suspend_shop','manage_shops']) c
  union all select 'investigation_officer', c from unnest(array[
    'view_device','view_all_devices','search_imei','view_all_reports','review_report','assign_case',
    'change_report_status','update_follow_up','upload_evidence','view_evidence','view_identity',
    'view_sensitive_data','view_dashboard','generate_reports']) c
  union all select 'delegate', c from unnest(array[
    'view_device','search_imei','create_stolen_report','update_follow_up','upload_evidence','view_dashboard']) c
  union all select 'shop_manager', c from unnest(array[
    'view_device','search_imei','create_device','create_sale','view_sales','create_repair',
    'create_format_record','view_customer','manage_shop_staff','view_dashboard','generate_reports']) c
  union all select 'technician', c from unnest(array[
    'view_device','search_imei','create_repair','create_format_record','view_dashboard']) c
  union all select 'auditor', c from unnest(array[
    'view_audit_logs','view_security_events','view_all_reports','view_all_devices','view_dashboard','generate_reports']) c
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from mapping m
join public.roles r on r.code = m.role_code
join public.permissions p on p.code = m.perm_code
on conflict do nothing;

insert into public.system_settings (key, value, description_ar) values
  ('mfa_required_for_sensitive', 'true'::jsonb, 'اشتراط AAL2 للعمليات الحساسة'),
  ('rate_limit_per_minute', '60'::jsonb, 'حد الطلبات في الدقيقة'),
  ('platform_name', '"حماية | نظام مكافحة سرقة الأجهزة"'::jsonb, 'اسم المنصة')
on conflict (key) do nothing;


-- ==================== 0011_operations.sql ====================
-- 0011: عمليات النظام (SECURITY DEFINER) — كل الكتابة تمر من هنا

create or replace function private.require_aal2()
returns void language plpgsql stable set search_path = public, pg_temp as $$
declare v_aal text;
begin
  v_aal := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'aal', 'aal1');
  if v_aal <> 'aal2' then
    raise exception 'MFA_REQUIRED: هذه العملية تتطلب مصادقة ثنائية (AAL2)' using errcode = '42501';
  end if;
end $$;

create or replace function private.next_number(p_prefix text)
returns text language sql volatile set search_path = public, extensions, pg_temp as $$
  select p_prefix || '-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,8));
$$;

create or replace function private.notify_user(
  p_user uuid, p_title text, p_body text,
  p_type public.notification_type, p_severity public.notification_severity,
  p_entity_type text default null, p_entity_id uuid default null)
returns void language sql volatile security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, title, body, notification_type, severity, entity_type, entity_id)
  values (p_user, p_title, p_body, p_type, p_severity, p_entity_type, p_entity_id);
$$;

-- تسجيل جهاز
create or replace function public.op_create_device(
  p_brand text, p_model text, p_color text, p_serial text,
  p_imei_primary text, p_imei_secondary text default null, p_shop_id uuid default null)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  perform public.require_permission('create_device');
  if not public.is_valid_imei(p_imei_primary) then
    raise exception 'INVALID_IMEI: رقم IMEI الأساسي غير صالح' using errcode = '23514';
  end if;
  if p_imei_secondary is not null and not public.is_valid_imei(p_imei_secondary) then
    raise exception 'INVALID_IMEI: رقم IMEI الثانوي غير صالح' using errcode = '23514';
  end if;

  insert into public.devices (brand, model, color, serial_number, registered_by, current_shop_id)
  values (p_brand, p_model, p_color, p_serial, v_actor, p_shop_id)
  returning id into v_id;

  insert into public.device_imeis (device_id, imei, slot) values (v_id, p_imei_primary, 1);
  if p_imei_secondary is not null then
    insert into public.device_imeis (device_id, imei, slot) values (v_id, p_imei_secondary, 2);
  end if;

  insert into public.device_events (device_id, event_type, description_ar, actor_id)
  values (v_id, 'registered', 'تم تسجيل الجهاز في المنصة', v_actor);
  insert into public.device_status_transitions (device_id, from_status, to_status, reason, actor_id)
  values (v_id, null, 'registered', 'تسجيل أولي', v_actor);

  perform private.append_audit_log(v_actor, 'create_device', 'device', v_id,
    jsonb_build_object('brand', p_brand, 'model', p_model));
  return v_id;
end $$;

-- فحص IMEI
create or replace function public.op_check_imei(p_imei text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_device record; v_report record; v_actor uuid := auth.uid(); v_result jsonb;
begin
  perform public.require_permission('search_imei');
  if not public.is_valid_imei(p_imei) then
    return jsonb_build_object('valid', false, 'reason', 'رقم IMEI غير صالح (فشل التحقق من خانة Luhn)');
  end if;

  select d.* into v_device
  from public.devices d join public.device_imeis di on di.device_id = d.id
  where di.imei = p_imei limit 1;

  select r.id, r.report_number, r.status, r.created_at into v_report
  from public.stolen_reports r
  where r.imei = p_imei and r.status in ('verified','active','assigned')
  order by r.created_at desc limit 1;

  v_result := jsonb_build_object(
    'valid', true,
    'registered', v_device.id is not null,
    'device', case when v_device.id is null then null else jsonb_build_object(
      'id', v_device.id, 'brand', v_device.brand, 'model', v_device.model,
      'status', v_device.status, 'is_flagged', v_device.is_flagged) end,
    'security_alert', v_report.id is not null,
    'alert', case when v_report.id is null then null else jsonb_build_object(
      'report_number', v_report.report_number, 'status', v_report.status, 'since', v_report.created_at) end
  );

  perform private.append_audit_log(v_actor, 'check_imei', 'imei', v_device.id,
    jsonb_build_object('imei_tail', right(p_imei, 4), 'alert', v_report.id is not null));

  if v_report.id is not null then
    insert into public.security_events (event_type, severity, actor_id, details)
    values ('flagged_imei_lookup', 'important'::public.notification_severity, v_actor,
      jsonb_build_object('report_number', v_report.report_number, 'imei_tail', right(p_imei,4)));
  end if;
  return v_result;
end $$;

-- تسجيل بيع مع تشفير بيانات المشتري
create or replace function public.op_register_sale(
  p_shop_id uuid, p_device_id uuid, p_price numeric, p_warranty_months int,
  p_name_encrypted text, p_phone_encrypted text, p_national_id_encrypted text,
  p_name_hash text, p_phone_hash text, p_national_id_hash text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_customer uuid; v_sale uuid; v_invoice text; v_actor uuid := auth.uid();
begin
  perform public.require_permission('create_sale');
  perform private.require_aal2();

  select cs.customer_id into v_customer
  from public.customer_sensitive_data cs where cs.phone_hash = p_phone_hash limit 1;

  if v_customer is null then
    insert into public.customers (display_reference, created_by)
    values (private.next_number('CUS'), v_actor) returning id into v_customer;
    insert into public.customer_sensitive_data (customer_id, full_name_encrypted, phone_encrypted,
      national_id_encrypted, full_name_hash, phone_hash, national_id_hash)
    values (v_customer, p_name_encrypted, p_phone_encrypted, p_national_id_encrypted,
      p_name_hash, p_phone_hash, p_national_id_hash);
  end if;

  v_invoice := private.next_number('INV');
  insert into public.sales (invoice_number, shop_id, customer_id, sold_by, total_amount)
  values (v_invoice, p_shop_id, v_customer, v_actor, p_price) returning id into v_sale;
  insert into public.sale_items (sale_id, device_id, price, warranty_months)
  values (v_sale, p_device_id, p_price, coalesce(p_warranty_months,0));

  update public.devices set status = 'sold', updated_at = now() where id = p_device_id;
  insert into public.device_status_transitions (device_id, from_status, to_status, reason, actor_id)
  values (p_device_id, 'registered', 'sold', 'عملية بيع ' || v_invoice, v_actor);
  insert into public.device_events (device_id, event_type, description_ar, actor_id, metadata)
  values (p_device_id, 'sold', 'تم بيع الجهاز بالفاتورة ' || v_invoice, v_actor,
    jsonb_build_object('sale_id', v_sale));

  perform private.append_audit_log(v_actor, 'register_sale', 'sale', v_sale,
    jsonb_build_object('invoice', v_invoice, 'device_id', p_device_id));
  return jsonb_build_object('sale_id', v_sale, 'invoice_number', v_invoice, 'customer_id', v_customer);
end $$;

-- صيانة
create or replace function public.op_create_repair(
  p_device_id uuid, p_shop_id uuid, p_technician_id uuid, p_fault text, p_actions text, p_cost numeric)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_num text; v_actor uuid := auth.uid(); v_imei text; v_alert boolean;
begin
  perform public.require_permission('create_repair');
  select di.imei into v_imei from public.device_imeis di where di.device_id = p_device_id order by di.slot limit 1;
  select exists (select 1 from public.stolen_reports r
    where r.imei = v_imei and r.status in ('verified','active','assigned')) into v_alert;
  if v_alert then
    insert into public.security_events (event_type, severity, actor_id, details)
    values ('repair_on_flagged_device', 'critical'::public.notification_severity, v_actor,
      jsonb_build_object('device_id', p_device_id));
    raise exception 'SECURITY_BLOCK: الجهاز مبلّغ عنه كمسروق — تم إخطار الجهة المختصة' using errcode = '42501';
  end if;

  v_num := private.next_number('REP');
  insert into public.repair_records (operation_number, device_id, shop_id, technician_id, fault_description, actions_taken, cost, created_by)
  values (v_num, p_device_id, p_shop_id, p_technician_id, p_fault, p_actions, coalesce(p_cost,0), v_actor)
  returning id into v_id;

  insert into public.device_events (device_id, event_type, description_ar, actor_id)
  values (p_device_id, 'repair', 'عملية صيانة رقم ' || v_num, v_actor);
  perform private.append_audit_log(v_actor, 'create_repair', 'repair_record', v_id, jsonb_build_object('operation', v_num));
  return jsonb_build_object('id', v_id, 'operation_number', v_num);
end $$;

-- فرمتة
create or replace function public.op_create_format_record(
  p_device_id uuid, p_shop_id uuid, p_technician_id uuid, p_reason text, p_consent boolean)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_num text; v_actor uuid := auth.uid(); v_imei text; v_alert boolean;
begin
  perform public.require_permission('create_format_record');
  perform private.require_aal2();
  if not coalesce(p_consent,false) then
    raise exception 'CONSENT_REQUIRED: موافقة المالك إلزامية للفرمتة' using errcode = '42501';
  end if;
  select di.imei into v_imei from public.device_imeis di where di.device_id = p_device_id order by di.slot limit 1;
  select exists (select 1 from public.stolen_reports r
    where r.imei = v_imei and r.status in ('verified','active','assigned')) into v_alert;
  if v_alert then
    insert into public.security_events (event_type, severity, actor_id, details)
    values ('format_on_flagged_device', 'critical'::public.notification_severity, v_actor,
      jsonb_build_object('device_id', p_device_id));
    raise exception 'SECURITY_BLOCK: لا يمكن فرمتة جهاز مبلّغ عنه' using errcode = '42501';
  end if;

  v_num := private.next_number('FMT');
  insert into public.format_records (operation_number, device_id, shop_id, technician_id, reason, owner_consent, created_by)
  values (v_num, p_device_id, p_shop_id, p_technician_id, p_reason, true, v_actor) returning id into v_id;

  update public.devices set status = 'formatted', updated_at = now() where id = p_device_id;
  insert into public.device_events (device_id, event_type, description_ar, actor_id)
  values (p_device_id, 'format', 'عملية فرمتة رقم ' || v_num, v_actor);
  perform private.append_audit_log(v_actor, 'create_format_record', 'format_record', v_id, jsonb_build_object('operation', v_num));
  return jsonb_build_object('id', v_id, 'operation_number', v_num);
end $$;


-- ==================== 0012_report_operations.sql ====================
-- 0012: عمليات البلاغات والإحالة والمتابعة

create or replace function public.op_create_stolen_report(
  p_imei text, p_incident_at timestamptz, p_location text, p_narrative text,
  p_priority public.report_priority default 'normal', p_contact_encrypted text default null)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_num text; v_device uuid; v_actor uuid := auth.uid();
begin
  perform public.require_permission('create_stolen_report');
  perform private.require_aal2();
  if not public.is_valid_imei(p_imei) then
    raise exception 'INVALID_IMEI: رقم IMEI غير صالح' using errcode = '23514';
  end if;

  select di.device_id into v_device from public.device_imeis di where di.imei = p_imei limit 1;
  v_num := private.next_number('RPT');

  insert into public.stolen_reports (report_number, device_id, imei, status, priority,
    incident_at, incident_location, narrative, reporter_id, reporter_contact_encrypted)
  values (v_num, v_device, p_imei, 'draft', p_priority, p_incident_at, p_location, p_narrative, v_actor, p_contact_encrypted)
  returning id into v_id;

  insert into public.report_status_history (report_id, from_status, to_status, note, actor_id)
  values (v_id, null, 'draft', 'إنشاء البلاغ', v_actor);

  perform private.append_audit_log(v_actor, 'create_stolen_report', 'stolen_report', v_id,
    jsonb_build_object('report_number', v_num, 'imei_tail', right(p_imei,4)));
  return jsonb_build_object('id', v_id, 'report_number', v_num, 'status', 'draft');
end $$;

create or replace function public.op_update_report_status(
  p_report_id uuid, p_to_status public.report_status, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_from public.report_status; v_perm text; v_actor uuid := auth.uid(); v_imei text; v_device uuid;
begin
  select r.status, r.imei, r.device_id into v_from, v_imei, v_device
  from public.stolen_reports r where r.id = p_report_id for update;
  if v_from is null then raise exception 'NOT_FOUND: البلاغ غير موجود' using errcode = 'P0002'; end if;

  select t.required_permission into v_perm from public.report_status_transitions t
  where t.from_status = v_from and t.to_status = p_to_status;
  if v_perm is null then
    raise exception 'INVALID_TRANSITION: الانتقال % -> % غير مسموح', v_from, p_to_status using errcode = '23514';
  end if;
  perform public.require_permission(v_perm);
  perform private.require_aal2();

  -- مهم: تصفير علم الإحالة لتفادي تسرب الأعلام بين العمليات في نفس الجلسة
  perform set_config('app.report_assignment', 'off', true);
  perform set_config('app.report_status_transition', 'on', true);

  update public.stolen_reports
  set status = p_to_status,
      recovered_at = case when p_to_status = 'recovered' then now() else recovered_at end,
      closed_at = case when p_to_status = 'closed' then now() else closed_at end
  where id = p_report_id;

  perform set_config('app.report_status_transition', 'off', true);

  insert into public.report_status_history (report_id, from_status, to_status, note, actor_id)
  values (p_report_id, v_from, p_to_status, p_note, v_actor);

  if v_device is not null then
    if p_to_status in ('verified','active','assigned') then
      update public.devices set status = 'reported_stolen', is_flagged = true,
        flag_reason = 'بلاغ سرقة نشط', updated_at = now() where id = v_device;
      insert into public.device_status_transitions (device_id, to_status, reason, actor_id)
      values (v_device, 'reported_stolen', 'رفع راية بلاغ سرقة', v_actor);
    elsif p_to_status = 'recovered' then
      update public.devices set status = 'recovered', is_flagged = false, flag_reason = null,
        updated_at = now() where id = v_device;
      insert into public.device_status_transitions (device_id, to_status, reason, actor_id)
      values (v_device, 'recovered', 'تم استرداد الجهاز', v_actor);
    elsif p_to_status = 'rejected' then
      update public.devices set is_flagged = false, flag_reason = null, updated_at = now() where id = v_device;
    end if;
    insert into public.device_events (device_id, event_type, description_ar, actor_id)
    values (v_device, 'report_status', 'تغيير حالة البلاغ إلى ' || p_to_status::text, v_actor);
  end if;

  perform private.append_audit_log(v_actor, 'update_report_status', 'stolen_report', p_report_id,
    jsonb_build_object('from', v_from, 'to', p_to_status));
  return jsonb_build_object('id', p_report_id, 'from', v_from, 'to', p_to_status);
end $$;

create or replace function public.op_assign_report(p_report_id uuid, p_assignee uuid, p_agency uuid default null)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid(); v_status public.report_status;
begin
  perform public.require_permission('assign_case');
  perform private.require_aal2();
  select status into v_status from public.stolen_reports where id = p_report_id for update;
  if v_status is null then raise exception 'NOT_FOUND: البلاغ غير موجود' using errcode = 'P0002'; end if;

  -- مهم: تصفير علم تغيير الحالة لتفادي التسرّب
  perform set_config('app.report_status_transition', 'off', true);
  perform set_config('app.report_assignment', 'on', true);

  update public.stolen_reports
  set assigned_to = p_assignee, assigned_agency_id = p_agency, assigned_at = now()
  where id = p_report_id;

  perform set_config('app.report_assignment', 'off', true);

  if v_status = 'active' then
    perform public.op_update_report_status(p_report_id, 'assigned'::public.report_status, 'إحالة القضية');
  end if;

  perform private.notify_user(p_assignee, 'إحالة قضية جديدة',
    'تمت إحالة بلاغ إليك للمتابعة', 'report'::public.notification_type,
    'important'::public.notification_severity, 'stolen_report', p_report_id);

  perform private.append_audit_log(v_actor, 'assign_report', 'stolen_report', p_report_id,
    jsonb_build_object('assignee', p_assignee));
  return jsonb_build_object('id', p_report_id, 'assigned_to', p_assignee);
end $$;

create or replace function public.op_add_report_follow_up(p_report_id uuid, p_body text, p_internal boolean default true)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  perform public.require_permission('update_follow_up');
  insert into public.report_follow_ups (report_id, body, is_internal, actor_id)
  values (p_report_id, p_body, p_internal, v_actor) returning id into v_id;
  perform private.append_audit_log(v_actor, 'add_follow_up', 'report_follow_up', v_id,
    jsonb_build_object('report_id', p_report_id));
  return v_id;
end $$;

-- تفاصيل بلاغ (مع jsonb_agg بأقواس صحيحة)
create or replace function public.op_get_report_detail(p_report_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid(); v_report jsonb; v_history jsonb; v_follow jsonb; v_evidence jsonb;
begin
  if not (public.has_permission('view_all_reports')
          or exists (select 1 from public.stolen_reports r
                     where r.id = p_report_id and (r.reporter_id = v_actor or r.assigned_to = v_actor))) then
    raise exception 'PERMISSION_DENIED: لا تملك صلاحية عرض هذا البلاغ' using errcode = '42501';
  end if;

  select to_jsonb(r) - 'reporter_contact_encrypted' into v_report
  from public.stolen_reports r where r.id = p_report_id;
  if v_report is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  v_history := coalesce((
    select jsonb_agg(jsonb_build_object(
      'from_status', q.from_status, 'to_status', q.to_status,
      'note', q.note, 'created_at', q.created_at) order by q.created_at desc)
    from (
      select h.from_status, h.to_status, h.note, h.created_at
      from public.report_status_history h
      where h.report_id = p_report_id
    ) q
  ), '[]'::jsonb);

  v_follow := coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'body', q.body, 'is_internal', q.is_internal, 'created_at', q.created_at) order by q.created_at desc)
    from (
      select f.id, f.body, f.is_internal, f.created_at
      from public.report_follow_ups f
      where f.report_id = p_report_id
    ) q
  ), '[]'::jsonb);

  v_evidence := coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'media_type', q.media_type, 'description', q.description,
      'status', q.status, 'created_at', q.created_at) order by q.created_at desc)
    from (
      select e.id, e.media_type, e.description, e.status, e.created_at
      from public.evidence e
      where e.report_id = p_report_id and public.has_permission('view_evidence')
    ) q
  ), '[]'::jsonb);

  perform private.append_audit_log(v_actor, 'view_report_detail', 'stolen_report', p_report_id, '{}'::jsonb);
  return jsonb_build_object('report', v_report, 'history', v_history, 'follow_ups', v_follow, 'evidence', v_evidence);
end $$;


-- ==================== 0013_admin_and_queries.sql ====================
-- 0013: الإدارة والاستعلامات والتخزين

create or replace function public.op_bootstrap_profile()
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid(); v_user record; v_perms text[]; v_roles text[];
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  select * into v_user from public.users where id = v_actor;
  if v_user.id is null then
    return jsonb_build_object('registered', false);
  end if;
  select coalesce(array_agg(distinct p.code), '{}') into v_perms
  from public.user_roles ur join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id where ur.user_id = v_actor;
  select coalesce(array_agg(distinct r.code), '{}') into v_roles
  from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = v_actor;

  update public.users set last_login_at = now() where id = v_actor;

  return jsonb_build_object('registered', true, 'user', jsonb_build_object(
    'id', v_user.id, 'full_name', v_user.full_name, 'email', v_user.email,
    'status', v_user.status, 'mfa_enrolled', v_user.mfa_enrolled),
    'roles', to_jsonb(v_roles), 'permissions', to_jsonb(v_perms));
end $$;

create or replace function public.op_get_dashboard()
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('view_dashboard');
  return jsonb_build_object(
    'devices_total', (select count(*) from public.devices),
    'devices_flagged', (select count(*) from public.devices where is_flagged),
    'reports_active', (select count(*) from public.stolen_reports where status in ('verified','active','assigned')),
    'reports_recovered', (select count(*) from public.stolen_reports where status = 'recovered'),
    'shops_pending', (select count(*) from public.shops where status = 'pending'),
    'sales_total', (select count(*) from public.sales),
    'repairs_total', (select count(*) from public.repair_records),
    'formats_total', (select count(*) from public.format_records),
    'my_assignments', (select count(*) from public.stolen_reports where assigned_to = v_actor and status <> 'closed'),
    'unread_notifications', (select count(*) from public.notifications where user_id = v_actor and not is_read)
  );
end $$;

create or replace function public.op_get_notifications(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title, 'body', q.body,
      'severity', q.severity, 'notification_type', q.notification_type,
      'entity_type', q.entity_type, 'entity_id', q.entity_id,
      'is_read', q.is_read, 'created_at', q.created_at) order by q.created_at desc)
    from (
      select n.id, n.title, n.body, n.severity, n.notification_type, n.entity_type,
             n.entity_id, n.is_read, n.created_at
      from public.notifications n
      where n.user_id = v_actor
      order by n.created_at desc
      limit p_limit
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_mark_notification_read(p_id uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.notifications set is_read = true, read_at = now()
  where id = p_id and user_id = auth.uid();
$$;

create or replace function public.op_get_devices(p_search text default null, p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_permission('view_device');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'brand', q.brand, 'model', q.model,
      'color', q.color, 'status', q.status, 'is_flagged', q.is_flagged,
      'imei_masked', q.imei_masked, 'created_at', q.created_at) order by q.created_at desc)
    from (
      select d.id, d.brand, d.model, d.color, d.status, d.is_flagged, d.created_at,
             '***********' || right(coalesce(di.imei,'0000'), 4) as imei_masked
      from public.devices d
      left join public.device_imeis di on di.device_id = d.id and di.slot = 1
      where (public.has_permission('view_all_devices') or d.registered_by = auth.uid())
        and (p_search is null or d.brand ilike '%'||p_search||'%' or d.model ilike '%'||p_search||'%'
             or di.imei = p_search)
      order by d.created_at desc
      limit p_limit
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_get_device_timeline(p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  perform public.require_permission('view_device');
  return coalesce((
    select jsonb_agg(jsonb_build_object('event_type', q.event_type, 'description_ar', q.description_ar,
      'metadata', q.metadata, 'created_at', q.created_at) order by q.created_at desc)
    from (
      select e.event_type, e.description_ar, e.metadata, e.created_at
      from public.device_events e
      where e.device_id = p_device_id
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_get_reports(p_status public.report_status default null, p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'report_number', q.report_number,
      'status', q.status, 'priority', q.priority, 'imei_masked', q.imei_masked,
      'incident_at', q.incident_at, 'created_at', q.created_at) order by q.created_at desc)
    from (
      select r.id, r.report_number, r.status, r.priority, r.incident_at, r.created_at,
             '***********' || right(r.imei, 4) as imei_masked
      from public.stolen_reports r
      where (public.has_permission('view_all_reports') or r.reporter_id = v_actor or r.assigned_to = v_actor)
        and (p_status is null or r.status = p_status)
      order by r.created_at desc
      limit p_limit
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_get_shops(p_status public.shop_status default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_permission('view_dashboard');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'name_ar', q.name_ar,
      'license_number', q.license_number, 'owner_name', q.owner_name,
      'status', q.status, 'created_at', q.created_at) order by q.created_at desc)
    from (
      select s.id, s.name_ar, s.license_number, s.owner_name, s.status, s.created_at
      from public.shops s
      where (p_status is null or s.status = p_status)
        and (public.has_permission('manage_shops')
             or exists (select 1 from public.shop_users su where su.shop_id = s.id and su.user_id = auth.uid()))
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_submit_shop(
  p_name text, p_license text, p_owner text, p_phone text, p_address text)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  insert into public.shops (name_ar, license_number, owner_name, contact_phone, address, submitted_by)
  values (p_name, p_license, p_owner, p_phone, p_address, v_actor) returning id into v_id;
  insert into public.notifications (user_id, title, body, notification_type, severity, entity_type, entity_id)
  select u.id, 'طلب اعتماد محل جديد', 'تم تقديم طلب اعتماد للمحل ' || p_name,
         'shop'::public.notification_type, 'important'::public.notification_severity, 'shop', v_id
  from public.users u where public.has_permission('approve_shop', u.id);
  perform private.append_audit_log(v_actor, 'submit_shop', 'shop', v_id, jsonb_build_object('license', p_license));
  return v_id;
end $$;

create or replace function public.op_approve_shop(p_shop_id uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('approve_shop');
  perform private.require_aal2();
  update public.shops set status = 'approved', approved_by = v_actor, approved_at = now(), updated_at = now()
  where id = p_shop_id;
  perform private.append_audit_log(v_actor, 'approve_shop', 'shop', p_shop_id, '{}'::jsonb);
end $$;

create or replace function public.op_suspend_shop(p_shop_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('suspend_shop');
  perform private.require_aal2();
  update public.shops set status = 'suspended', suspension_reason = p_reason, updated_at = now()
  where id = p_shop_id;
  perform private.append_audit_log(v_actor, 'suspend_shop', 'shop', p_shop_id, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.op_link_shop_user(p_shop_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('manage_shop_staff');
  insert into public.shop_users (shop_id, user_id, role_in_shop, linked_by)
  values (p_shop_id, p_user_id, coalesce(p_role,'staff'), v_actor)
  on conflict (shop_id, user_id) do update set role_in_shop = excluded.role_in_shop, is_active = true;
  perform private.append_audit_log(v_actor, 'link_shop_user', 'shop', p_shop_id, jsonb_build_object('user', p_user_id));
end $$;

create or replace function public.op_get_users(p_limit int default 100)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_permission('manage_users');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'full_name', q.full_name, 'email', q.email,
      'status', q.status, 'mfa_enrolled', q.mfa_enrolled, 'roles', q.roles,
      'created_at', q.created_at) order by q.created_at desc)
    from (
      select u.id, u.full_name, u.email, u.status, u.mfa_enrolled, u.created_at,
             coalesce((select jsonb_agg(r.code) from public.user_roles ur
                       join public.roles r on r.id = ur.role_id where ur.user_id = u.id), '[]'::jsonb) as roles
      from public.users u
      order by u.created_at desc
      limit p_limit
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_set_user_roles(p_user_id uuid, p_roles text[])
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('manage_permissions');
  perform private.require_aal2();
  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles (user_id, role_id, granted_by)
  select p_user_id, r.id, v_actor from public.roles r where r.code = any(p_roles);
  perform private.append_audit_log(v_actor, 'set_user_roles', 'user', p_user_id, jsonb_build_object('roles', to_jsonb(p_roles)));
end $$;

create or replace function public.op_update_user_status(p_user_id uuid, p_status public.account_status)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('manage_users');
  perform private.require_aal2();
  update public.users set status = p_status, updated_at = now() where id = p_user_id;
  perform private.append_audit_log(v_actor, 'update_user_status', 'user', p_user_id, jsonb_build_object('status', p_status));
end $$;

create or replace function public.op_get_audit_logs(p_limit int default 100)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_permission('view_audit_logs');
  return coalesce((
    select jsonb_agg(jsonb_build_object('sequence_number', q.sequence_number, 'action', q.action,
      'entity_type', q.entity_type, 'entity_id', q.entity_id, 'entry_hash', q.entry_hash,
      'previous_hash', q.previous_hash, 'created_at', q.created_at) order by q.sequence_number desc)
    from (
      select a.sequence_number, a.action, a.entity_type, a.entity_id, a.entry_hash, a.previous_hash, a.created_at
      from public.audit_logs a
      order by a.sequence_number desc
      limit p_limit
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_get_security_events(p_limit int default 100)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_permission('view_security_events');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'event_type', q.event_type, 'severity', q.severity,
      'details', q.details, 'resolved', q.resolved, 'created_at', q.created_at) order by q.created_at desc)
    from (
      select s.id, s.event_type, s.severity, s.details, s.resolved, s.created_at
      from public.security_events s
      order by s.created_at desc
      limit p_limit
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_resolve_security_event(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('view_security_events');
  update public.security_events set resolved = true, resolved_by = v_actor,
    resolved_at = now(), resolution_note = p_note where id = p_id;
  perform private.append_audit_log(v_actor, 'resolve_security_event', 'security_event', p_id, '{}'::jsonb);
end $$;

create or replace function public.op_access_sensitive_data(p_customer_id uuid, p_justification text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid(); v_row record;
begin
  perform public.require_permission('view_sensitive_data');
  perform private.require_aal2();
  if coalesce(length(trim(p_justification)),0) < 10 then
    raise exception 'JUSTIFICATION_REQUIRED: مبرر الوصول إلزامي (10 أحرف على الأقل)' using errcode = '42501';
  end if;
  select * into v_row from public.customer_sensitive_data where customer_id = p_customer_id;
  if v_row.customer_id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  insert into public.sensitive_data_access_logs (actor_id, entity_type, entity_id, fields, justification)
  values (v_actor, 'customer', p_customer_id, array['full_name','phone','national_id'], p_justification);
  perform private.append_audit_log(v_actor, 'access_sensitive_data', 'customer', p_customer_id,
    jsonb_build_object('justification', p_justification));

  return jsonb_build_object(
    'full_name_encrypted', v_row.full_name_encrypted,
    'phone_encrypted', v_row.phone_encrypted,
    'national_id_encrypted', v_row.national_id_encrypted);
end $$;

create or replace function public.op_search_sensitive_customer(p_hash text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('view_customer');
  perform private.append_audit_log(v_actor, 'search_sensitive_customer', 'customer', null, '{}'::jsonb);
  return coalesce((
    select jsonb_agg(jsonb_build_object('customer_id', q.customer_id, 'display_reference', q.display_reference))
    from (
      select c.id as customer_id, c.display_reference
      from public.customer_sensitive_data cs
      join public.customers c on c.id = cs.customer_id
      where cs.phone_hash = p_hash or cs.national_id_hash = p_hash or cs.full_name_hash = p_hash
      limit 25
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_update_system_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('manage_system_settings');
  perform private.require_aal2();
  insert into public.system_settings (key, value, updated_by, updated_at)
  values (p_key, p_value, v_actor, now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform private.append_audit_log(v_actor, 'update_system_setting', 'system_setting', null,
    jsonb_build_object('key', p_key));
end $$;

create or replace function public.op_generate_report(p_kind text, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid(); v_data jsonb;
begin
  perform public.require_permission('generate_reports');
  if p_kind = 'sales' then
    select jsonb_build_object('count', count(*), 'total', coalesce(sum(total_amount),0)) into v_data
    from public.sales where sold_at between p_from and p_to;
  elsif p_kind = 'repairs' then
    select jsonb_build_object('count', count(*), 'total_cost', coalesce(sum(cost),0)) into v_data
    from public.repair_records where created_at between p_from and p_to;
  elsif p_kind = 'formats' then
    select jsonb_build_object('count', count(*)) into v_data
    from public.format_records where created_at between p_from and p_to;
  elsif p_kind = 'reports' then
    select jsonb_build_object('count', count(*),
      'recovered', count(*) filter (where status = 'recovered'),
      'active', count(*) filter (where status in ('verified','active','assigned'))) into v_data
    from public.stolen_reports where created_at between p_from and p_to;
  else
    raise exception 'UNKNOWN_REPORT_KIND' using errcode = '22023';
  end if;
  perform private.append_audit_log(v_actor, 'generate_report', 'report', null, jsonb_build_object('kind', p_kind));
  return jsonb_build_object('kind', p_kind, 'from', p_from, 'to', p_to, 'data', v_data);
end $$;

create or replace function public.op_get_case_assignees()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_permission('assign_case');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'full_name', q.full_name))
    from (
      select u.id, u.full_name from public.users u
      where u.status = 'active'
        and (public.has_role('investigation_officer', u.id) or public.has_role('delegate', u.id))
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_correct_record(
  p_entity_type text, p_entity_id uuid, p_field text, p_old text, p_new text, p_reason text)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  perform public.require_permission('correct_record');
  perform private.require_aal2();
  insert into public.record_corrections (entity_type, entity_id, field_name, old_value, new_value, reason, corrected_by)
  values (p_entity_type, p_entity_id, p_field, p_old, p_new, p_reason, v_actor) returning id into v_id;
  perform private.append_audit_log(v_actor, 'correct_record', p_entity_type, p_entity_id,
    jsonb_build_object('field', p_field, 'reason', p_reason));
  return v_id;
end $$;

-- تحديد المعدل
create or replace function public.op_rate_limit(p_endpoint text, p_max int default 60)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_start timestamptz := date_trunc('minute', now()); v_count int;
begin
  insert into public.api_rate_limit_windows (subject_id, endpoint, window_start, request_count)
  values (auth.uid(), p_endpoint, v_start, 1)
  on conflict (coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), endpoint, window_start)
  do update set request_count = public.api_rate_limit_windows.request_count + 1
  returning request_count into v_count;
  return v_count <= p_max;
end $$;

grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema public from anon;


-- ==================== 0014_storage_and_evidence.sql ====================
-- 0014: التخزين الخاص والأدلة
insert into storage.buckets (id, name, public)
values ('device-media','device-media', false), ('evidence','evidence', false)
on conflict (id) do update set public = false;

-- لا سياسات مباشرة للمتصفح: كل الوصول عبر روابط موقّعة من دوال الحافة
drop policy if exists p_no_direct_objects on storage.objects;

create or replace function public.op_register_device_media(
  p_device_id uuid, p_path text, p_media_type public.media_type, p_caption text)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  perform public.require_permission('create_device');
  insert into public.device_media (device_id, storage_path, media_type, caption, uploaded_by)
  values (p_device_id, p_path, p_media_type, p_caption, v_actor) returning id into v_id;
  insert into public.device_events (device_id, event_type, description_ar, actor_id)
  values (p_device_id, 'media', 'إضافة وسائط للجهاز', v_actor);
  perform private.append_audit_log(v_actor, 'register_device_media', 'device_media', v_id, '{}'::jsonb);
  return v_id;
end $$;

create or replace function public.op_register_evidence(
  p_report_id uuid, p_path text, p_media_type public.media_type,
  p_description text, p_access_level public.access_level, p_checksum text)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  perform public.require_permission('upload_evidence');
  perform private.require_aal2();
  insert into public.evidence (report_id, storage_path, media_type, description, access_level, checksum, uploaded_by)
  values (p_report_id, p_path, p_media_type, p_description, coalesce(p_access_level,'restricted'), p_checksum, v_actor)
  returning id into v_id;
  perform private.append_audit_log(v_actor, 'upload_evidence', 'evidence', v_id,
    jsonb_build_object('report_id', p_report_id));
  return v_id;
end $$;

-- التحقق قبل إصدار رابط موقّع + تسجيل الوصول
create or replace function public.op_authorize_evidence_download(p_evidence_id uuid, p_purpose text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid(); v_row record;
begin
  perform public.require_permission('view_evidence');
  perform private.require_aal2();
  select e.*, r.assigned_to, r.reporter_id into v_row
  from public.evidence e join public.stolen_reports r on r.id = e.report_id
  where e.id = p_evidence_id;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  if v_row.access_level in ('confidential','secret')
     and not (public.has_permission('view_all_reports') or v_row.assigned_to = v_actor) then
    raise exception 'PERMISSION_DENIED: مستوى وصول غير كافٍ' using errcode = '42501';
  end if;

  insert into public.evidence_access_logs (evidence_id, accessed_by, purpose)
  values (p_evidence_id, v_actor, p_purpose);
  perform private.append_audit_log(v_actor, 'download_evidence', 'evidence', p_evidence_id, '{}'::jsonb);
  return jsonb_build_object('bucket', 'evidence', 'path', v_row.storage_path);
end $$;

create or replace function public.op_authorize_device_media_download(p_media_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid(); v_row record;
begin
  perform public.require_permission('view_device');
  select * into v_row from public.device_media where id = p_media_id;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform private.append_audit_log(v_actor, 'download_device_media', 'device_media', p_media_id, '{}'::jsonb);
  return jsonb_build_object('bucket', 'device-media', 'path', v_row.storage_path);
end $$;

create or replace function public.op_ingest_auth_event(p_event text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  insert into public.security_events (event_type, severity, actor_id, details)
  values (p_event,
    case when p_event in ('login_failed','mfa_failed') then 'important'::public.notification_severity
         else 'info'::public.notification_severity end,
    v_actor, p_details);
  if p_event = 'mfa_enrolled' and v_actor is not null then
    update public.users set mfa_enrolled = true where id = v_actor;
  end if;
end $$;

grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema public from anon;

