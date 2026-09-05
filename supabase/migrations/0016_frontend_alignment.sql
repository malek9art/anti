-- 0016: ملاءمة الواجهات — وسائط الأجهزة وتقرير الامتثال
-- يُضيف: قائمة وسائط الجهاز (device_media) وأداة مراقبة التزام المحلات بالتسجيل.

create or replace function public.op_get_device_media(p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('view_device');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'media_type', q.media_type, 'caption', q.caption,
      'created_at', q.created_at) order by q.created_at desc)
    from (
      select m.id, m.media_type, m.caption, m.created_at
      from public.device_media m
      where m.device_id = p_device_id
      and exists (select 1 from public.devices d where d.id = m.device_id)
    ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.op_get_shop_compliance(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_actor uuid := auth.uid();
begin
  perform public.require_permission('generate_reports');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'shop_id', s.id, 'name_ar', s.name_ar, 'license_number', s.license_number,
      'status', s.status,
      'sales', coalesce((select count(*) from public.sales r where r.shop_id = s.id and r.sold_at between p_from and p_to), 0),
      'repairs', coalesce((select count(*) from public.repair_records r where r.shop_id = s.id and r.created_at between p_from and p_to), 0),
      'formats', coalesce((select count(*) from public.format_records r where r.shop_id = s.id and r.created_at between p_from and p_to), 0)
    ) order by s.name_ar)
    from public.shops s
    where s.status = 'approved'
  ), '[]'::jsonb);
end $$;

grant execute on all functions in schema public to authenticated;
