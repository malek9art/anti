-- 0015: الهوية البصرية (الشعار) — تُدار من لوحة الإدارة

-- دلو عام للشعار فقط: يجب أن يكون قابلًا للقراءة قبل تسجيل الدخول (شاشة الدخول)
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

insert into public.system_settings (key, value, description_ar) values
  ('branding_logo_path', '""'::jsonb, 'مسار ملف الشعار داخل دلو branding'),
  ('branding_logo_version', '0'::jsonb, 'رقم إصدار الشعار لكسر التخزين المؤقت'),
  ('branding_primary_color', '"#0B3D2E"'::jsonb, 'اللون الأساسي (الأخضر الداكن)'),
  ('branding_accent_color', '"#C9A24D"'::jsonb, 'اللون المساعد (الذهبي)')
on conflict (key) do nothing;

-- قراءة الهوية البصرية متاحة للجميع (بيانات عامة غير حساسة)
create or replace function public.op_get_branding()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'logo_path', coalesce((select value #>> '{}' from public.system_settings where key = 'branding_logo_path'), ''),
    'logo_version', coalesce((select value #>> '{}' from public.system_settings where key = 'branding_logo_version'), '0'),
    'primary_color', coalesce((select value #>> '{}' from public.system_settings where key = 'branding_primary_color'), '#0B3D2E'),
    'accent_color', coalesce((select value #>> '{}' from public.system_settings where key = 'branding_accent_color'), '#C9A24D')
  );
$$;

grant execute on function public.op_get_branding() to anon, authenticated;

-- تثبيت الشعار بعد الرفع (يتطلب صلاحية إدارة الإعدادات)
create or replace function public.op_set_branding_logo(p_path text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_version int;
begin
  perform public.require_permission('manage_system_settings');
  perform private.require_aal2();

  if coalesce(trim(p_path), '') = '' then
    raise exception 'INVALID_INPUT: مسار الشعار مطلوب' using errcode = '22023';
  end if;

  select coalesce((value #>> '{}')::int, 0) + 1 into v_version
  from public.system_settings where key = 'branding_logo_version';

  insert into public.system_settings (key, value, updated_by, updated_at)
  values ('branding_logo_path', to_jsonb(p_path), v_actor, now())
  on conflict (key) do update
    set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();

  insert into public.system_settings (key, value, updated_by, updated_at)
  values ('branding_logo_version', to_jsonb(coalesce(v_version, 1)), v_actor, now())
  on conflict (key) do update
    set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();

  perform private.append_audit_log(v_actor, 'set_branding_logo', 'system_setting', null,
    jsonb_build_object('path', p_path, 'version', v_version));

  return jsonb_build_object('logo_path', p_path, 'logo_version', v_version);
end;
$$;

-- إعادة الشعار إلى الافتراضي المرفق مع التطبيق
create or replace function public.op_reset_branding_logo()
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('manage_system_settings');
  perform private.require_aal2();
  update public.system_settings set value = '""'::jsonb, updated_by = v_actor, updated_at = now()
  where key = 'branding_logo_path';
  perform private.append_audit_log(v_actor, 'reset_branding_logo', 'system_setting', null, '{}'::jsonb);
end;
$$;

grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema public from anon;
grant execute on function public.op_get_branding() to anon;
