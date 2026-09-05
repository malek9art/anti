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
