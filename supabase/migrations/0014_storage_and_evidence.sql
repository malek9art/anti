-- 0014: التخزين الخاص والأدلة
insert into storage.buckets (id, name, public)
values ('device-media','device-media', false), ('evidence','evidence', false)
on conflict (id) do update set public = false;

-- لا سياسات مباشرة للمتصفح: كل الوصول عبر روابط موقّعة من دوال الحافة
drop policy if exists p_no_direct_objects on storage.objects;

create or replace function public.op_register_device_media(
  p_device_id uuid, p_path text, p_media_type public.media_type, p_caption text)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  perform public.require_permission('create_device');
  insert into public.device_media (device_id, storage_path, media_type, caption, uploaded_by)
  values (p_device_id, p_path, p_media_type, p_caption, v_actor) returning id into v_id;
  insert into public.device_events (device_id, event_type, description_ar, actor_id)
  values (p_device_id, 'media', 'إضافة وسائط للجهاز', v_actor);
  perform private.append_audit_log(v_actor, 'register_device_media', 'device_media', v_id, '{}'::jsonb);
  return v_id;
end $$;

create or replace function public.op_register_evidence(
  p_report_id uuid, p_path text, p_media_type public.media_type,
  p_description text, p_access_level public.access_level, p_checksum text)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  perform public.require_permission('upload_evidence');
  perform private.require_aal2();
  insert into public.evidence (report_id, storage_path, media_type, description, access_level, checksum, uploaded_by)
  values (p_report_id, p_path, p_media_type, p_description, coalesce(p_access_level,'restricted'), p_checksum, v_actor)
  returning id into v_id;
  perform private.append_audit_log(v_actor, 'upload_evidence', 'evidence', v_id,
    jsonb_build_object('report_id', p_report_id));
  return v_id;
end $$;

-- التحقق قبل إصدار رابط موقّع + تسجيل الوصول
create or replace function public.op_authorize_evidence_download(p_evidence_id uuid, p_purpose text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid(); v_row record;
begin
  perform public.require_permission('view_evidence');
  perform private.require_aal2();
  select e.*, r.assigned_to, r.reporter_id into v_row
  from public.evidence e join public.stolen_reports r on r.id = e.report_id
  where e.id = p_evidence_id;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  if v_row.access_level in ('confidential','secret')
     and not (public.has_permission('view_all_reports') or v_row.assigned_to = v_actor) then
    raise exception 'PERMISSION_DENIED: مستوى وصول غير كافٍ' using errcode = '42501';
  end if;

  insert into public.evidence_access_logs (evidence_id, accessed_by, purpose)
  values (p_evidence_id, v_actor, p_purpose);
  perform private.append_audit_log(v_actor, 'download_evidence', 'evidence', p_evidence_id, '{}'::jsonb);
  return jsonb_build_object('bucket', 'evidence', 'path', v_row.storage_path);
end $$;

create or replace function public.op_authorize_device_media_download(p_media_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid(); v_row record;
begin
  perform public.require_permission('view_device');
  select * into v_row from public.device_media where id = p_media_id;
  if v_row.id is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform private.append_audit_log(v_actor, 'download_device_media', 'device_media', p_media_id, '{}'::jsonb);
  return jsonb_build_object('bucket', 'device-media', 'path', v_row.storage_path);
end $$;

create or replace function public.op_ingest_auth_event(p_event text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  insert into public.security_events (event_type, severity, actor_id, details)
  values (p_event,
    case when p_event in ('login_failed','mfa_failed') then 'important'::public.notification_severity
         else 'info'::public.notification_severity end,
    v_actor, p_details);
  if p_event = 'mfa_enrolled' and v_actor is not null then
    update public.users set mfa_enrolled = true where id = v_actor;
  end if;
end $$;

grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema public from anon;
