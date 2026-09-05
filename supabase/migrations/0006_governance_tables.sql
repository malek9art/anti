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
