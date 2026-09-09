-- مخزن أصول الهوية البصرية: يحفظ بايتات الشعار داخل قاعدة البيانات
-- لتُقدَّم عبر Edge Function عامة (get-branding-logo) لجميع المستخدمين.
create table if not exists public.branding_assets (
  name text primary key,
  data bytea not null default '',
  mime text not null default 'image/png',
  updated_at timestamptz not null default now()
);

alter table public.branding_assets enable row level security;
alter table public.branding_assets force row level security;

-- لا سياسات قراءة مباشرة: الوصول العام يتم حصريًا عبر Edge Function
-- (SECURITY DEFINER / service role داخل الدالة)، ولا يُضعف RLS.
