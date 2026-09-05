-- 0011: عمليات النظام (SECURITY DEFINER) — كل الكتابة تمر من هنا

create or replace function private.require_aal2()
returns void language plpgsql stable set search_path = public, pg_temp as $$
declare v_aal text;
begin
  v_aal := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'aal', 'aal1');
  if v_aal <> 'aal2' then
    raise exception 'MFA_REQUIRED: هذه العملية تتطلب مصادقة ثنائية (AAL2)' using errcode = '42501';
  end if;
end $$;

create or replace function private.next_number(p_prefix text)
returns text language sql volatile set search_path = public, extensions, pg_temp as $$
  select p_prefix || '-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(extensions.gen_random_uuid()::text,'-',''),1,8));
$$;

create or replace function private.notify_user(
  p_user uuid, p_title text, p_body text,
  p_type public.notification_type, p_severity public.notification_severity,
  p_entity_type text default null, p_entity_id uuid default null)
returns void language sql volatile security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, title, body, notification_type, severity, entity_type, entity_id)
  values (p_user, p_title, p_body, p_type, p_severity, p_entity_type, p_entity_id);
$$;

-- تسجيل جهاز
create or replace function public.op_create_device(
  p_brand text, p_model text, p_color text, p_serial text,
  p_imei_primary text, p_imei_secondary text default null, p_shop_id uuid default null)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  perform public.require_permission('create_device');
  if not public.is_valid_imei(p_imei_primary) then
    raise exception 'INVALID_IMEI: رقم IMEI الأساسي غير صالح' using errcode = '23514';
  end if;
  if p_imei_secondary is not null and not public.is_valid_imei(p_imei_secondary) then
    raise exception 'INVALID_IMEI: رقم IMEI الثانوي غير صالح' using errcode = '23514';
  end if;

  insert into public.devices (brand, model, color, serial_number, registered_by, current_shop_id)
  values (p_brand, p_model, p_color, p_serial, v_actor, p_shop_id)
  returning id into v_id;

  insert into public.device_imeis (device_id, imei, slot) values (v_id, p_imei_primary, 1);
  if p_imei_secondary is not null then
    insert into public.device_imeis (device_id, imei, slot) values (v_id, p_imei_secondary, 2);
  end if;

  insert into public.device_events (device_id, event_type, description_ar, actor_id)
  values (v_id, 'registered', 'تم تسجيل الجهاز في المنصة', v_actor);
  insert into public.device_status_transitions (device_id, from_status, to_status, reason, actor_id)
  values (v_id, null, 'registered', 'تسجيل أولي', v_actor);

  perform private.append_audit_log(v_actor, 'create_device', 'device', v_id,
    jsonb_build_object('brand', p_brand, 'model', p_model));
  return v_id;
end $$;

-- فحص IMEI
create or replace function public.op_check_imei(p_imei text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_device record; v_report record; v_actor uuid := auth.uid(); v_result jsonb;
begin
  perform public.require_permission('search_imei');
  if not public.is_valid_imei(p_imei) then
    return jsonb_build_object('valid', false, 'reason', 'رقم IMEI غير صالح (فشل التحقق من خانة Luhn)');
  end if;

  select d.* into v_device
  from public.devices d join public.device_imeis di on di.device_id = d.id
  where di.imei = p_imei limit 1;

  select r.id, r.report_number, r.status, r.created_at into v_report
  from public.stolen_reports r
  where r.imei = p_imei and r.status in ('verified','active','assigned')
  order by r.created_at desc limit 1;

  v_result := jsonb_build_object(
    'valid', true,
    'registered', v_device.id is not null,
    'device', case when v_device.id is null then null else jsonb_build_object(
      'id', v_device.id, 'brand', v_device.brand, 'model', v_device.model,
      'status', v_device.status, 'is_flagged', v_device.is_flagged) end,
    'security_alert', v_report.id is not null,
    'alert', case when v_report.id is null then null else jsonb_build_object(
      'report_number', v_report.report_number, 'status', v_report.status, 'since', v_report.created_at) end
  );

  perform private.append_audit_log(v_actor, 'check_imei', 'imei', v_device.id,
    jsonb_build_object('imei_tail', right(p_imei, 4), 'alert', v_report.id is not null));

  if v_report.id is not null then
    insert into public.security_events (event_type, severity, actor_id, details)
    values ('flagged_imei_lookup', 'important'::public.notification_severity, v_actor,
      jsonb_build_object('report_number', v_report.report_number, 'imei_tail', right(p_imei,4)));
  end if;
  return v_result;
end $$;

-- تسجيل بيع مع تشفير بيانات المشتري
create or replace function public.op_register_sale(
  p_shop_id uuid, p_device_id uuid, p_price numeric, p_warranty_months int,
  p_name_encrypted text, p_phone_encrypted text, p_national_id_encrypted text,
  p_name_hash text, p_phone_hash text, p_national_id_hash text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_customer uuid; v_sale uuid; v_invoice text; v_actor uuid := auth.uid();
begin
  perform public.require_permission('create_sale');
  perform private.require_aal2();

  select cs.customer_id into v_customer
  from public.customer_sensitive_data cs where cs.phone_hash = p_phone_hash limit 1;

  if v_customer is null then
    insert into public.customers (display_reference, created_by)
    values (private.next_number('CUS'), v_actor) returning id into v_customer;
    insert into public.customer_sensitive_data (customer_id, full_name_encrypted, phone_encrypted,
      national_id_encrypted, full_name_hash, phone_hash, national_id_hash)
    values (v_customer, p_name_encrypted, p_phone_encrypted, p_national_id_encrypted,
      p_name_hash, p_phone_hash, p_national_id_hash);
  end if;

  v_invoice := private.next_number('INV');
  insert into public.sales (invoice_number, shop_id, customer_id, sold_by, total_amount)
  values (v_invoice, p_shop_id, v_customer, v_actor, p_price) returning id into v_sale;
  insert into public.sale_items (sale_id, device_id, price, warranty_months)
  values (v_sale, p_device_id, p_price, coalesce(p_warranty_months,0));

  update public.devices set status = 'sold', updated_at = now() where id = p_device_id;
  insert into public.device_status_transitions (device_id, from_status, to_status, reason, actor_id)
  values (p_device_id, 'registered', 'sold', 'عملية بيع ' || v_invoice, v_actor);
  insert into public.device_events (device_id, event_type, description_ar, actor_id, metadata)
  values (p_device_id, 'sold', 'تم بيع الجهاز بالفاتورة ' || v_invoice, v_actor,
    jsonb_build_object('sale_id', v_sale));

  perform private.append_audit_log(v_actor, 'register_sale', 'sale', v_sale,
    jsonb_build_object('invoice', v_invoice, 'device_id', p_device_id));
  return jsonb_build_object('sale_id', v_sale, 'invoice_number', v_invoice, 'customer_id', v_customer);
end $$;

-- صيانة
create or replace function public.op_create_repair(
  p_device_id uuid, p_shop_id uuid, p_technician_id uuid, p_fault text, p_actions text, p_cost numeric)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_num text; v_actor uuid := auth.uid(); v_imei text; v_alert boolean;
begin
  perform public.require_permission('create_repair');
  select di.imei into v_imei from public.device_imeis di where di.device_id = p_device_id order by di.slot limit 1;
  select exists (select 1 from public.stolen_reports r
    where r.imei = v_imei and r.status in ('verified','active','assigned')) into v_alert;
  if v_alert then
    insert into public.security_events (event_type, severity, actor_id, details)
    values ('repair_on_flagged_device', 'critical'::public.notification_severity, v_actor,
      jsonb_build_object('device_id', p_device_id));
    raise exception 'SECURITY_BLOCK: الجهاز مبلّغ عنه كمسروق — تم إخطار الجهة المختصة' using errcode = '42501';
  end if;

  v_num := private.next_number('REP');
  insert into public.repair_records (operation_number, device_id, shop_id, technician_id, fault_description, actions_taken, cost, created_by)
  values (v_num, p_device_id, p_shop_id, p_technician_id, p_fault, p_actions, coalesce(p_cost,0), v_actor)
  returning id into v_id;

  insert into public.device_events (device_id, event_type, description_ar, actor_id)
  values (p_device_id, 'repair', 'عملية صيانة رقم ' || v_num, v_actor);
  perform private.append_audit_log(v_actor, 'create_repair', 'repair_record', v_id, jsonb_build_object('operation', v_num));
  return jsonb_build_object('id', v_id, 'operation_number', v_num);
end $$;

-- فرمتة
create or replace function public.op_create_format_record(
  p_device_id uuid, p_shop_id uuid, p_technician_id uuid, p_reason text, p_consent boolean)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_id uuid; v_num text; v_actor uuid := auth.uid(); v_imei text; v_alert boolean;
begin
  perform public.require_permission('create_format_record');
  perform private.require_aal2();
  if not coalesce(p_consent,false) then
    raise exception 'CONSENT_REQUIRED: موافقة المالك إلزامية للفرمتة' using errcode = '42501';
  end if;
  select di.imei into v_imei from public.device_imeis di where di.device_id = p_device_id order by di.slot limit 1;
  select exists (select 1 from public.stolen_reports r
    where r.imei = v_imei and r.status in ('verified','active','assigned')) into v_alert;
  if v_alert then
    insert into public.security_events (event_type, severity, actor_id, details)
    values ('format_on_flagged_device', 'critical'::public.notification_severity, v_actor,
      jsonb_build_object('device_id', p_device_id));
    raise exception 'SECURITY_BLOCK: لا يمكن فرمتة جهاز مبلّغ عنه' using errcode = '42501';
  end if;

  v_num := private.next_number('FMT');
  insert into public.format_records (operation_number, device_id, shop_id, technician_id, reason, owner_consent, created_by)
  values (v_num, p_device_id, p_shop_id, p_technician_id, p_reason, true, v_actor) returning id into v_id;

  update public.devices set status = 'formatted', updated_at = now() where id = p_device_id;
  insert into public.device_events (device_id, event_type, description_ar, actor_id)
  values (p_device_id, 'format', 'عملية فرمتة رقم ' || v_num, v_actor);
  perform private.append_audit_log(v_actor, 'create_format_record', 'format_record', v_id, jsonb_build_object('operation', v_num));
  return jsonb_build_object('id', v_id, 'operation_number', v_num);
end $$;
