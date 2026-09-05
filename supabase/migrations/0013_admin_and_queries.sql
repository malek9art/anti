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
