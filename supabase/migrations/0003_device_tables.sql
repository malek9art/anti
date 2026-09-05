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
