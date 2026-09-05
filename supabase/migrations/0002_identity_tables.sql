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
