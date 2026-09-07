-- 0017: شاشة «مهامي» للمندوب — قائمة البلاغات المُحالة إلى المستخدم الحالي
create or replace function public.op_get_my_tasks(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'report_number', q.report_number, 'status', q.status,
      'priority', q.priority, 'imei_masked', q.imei_masked,
      'incident_at', q.incident_at, 'assigned_at', q.assigned_at,
      'incident_location', q.incident_location) order by q.assigned_at desc nulls last, q.created_at desc)
    from (
      select r.id, r.report_number, r.status, r.priority, r.incident_at,
             r.assigned_at, r.incident_location, r.created_at,
             '***********' || right(r.imei, 4) as imei_masked
      from public.stolen_reports r
      where r.assigned_to = v_actor
      order by r.assigned_at desc nulls last, r.created_at desc
      limit p_limit
    ) q
  ), '[]'::jsonb);
end $$;

grant execute on all functions in schema public to authenticated;
