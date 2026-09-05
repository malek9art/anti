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
