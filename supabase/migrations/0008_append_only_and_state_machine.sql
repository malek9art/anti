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
