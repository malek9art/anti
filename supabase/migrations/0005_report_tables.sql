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
