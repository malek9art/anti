-- 0010: بذر الأدوار والصلاحيات (لا بيانات تجريبية ولا حسابات)
insert into public.roles (code, name_ar, description_ar) values
  ('system_admin','مدير النظام','صلاحية كاملة على النظام'),
  ('authorized_officer','ضابط مخوّل','مراجعة البلاغات والفحص الأمني'),
  ('investigation_officer','ضابط تحقيق','التحقيق ومتابعة القضايا'),
  ('delegate','مندوب','مندوب ميداني تابع لجهة'),
  ('shop_manager','مدير محل','إدارة محل ومبيعاته وموظفيه'),
  ('technician','فني','تنفيذ الصيانة والفرمتة'),
  ('auditor','مدقّق','الاطلاع على سجلات التدقيق')
on conflict (code) do update set name_ar = excluded.name_ar;

insert into public.permissions (code, name_ar, category) values
  ('view_device','عرض جهاز','devices'),
  ('view_all_devices','عرض كل الأجهزة','devices'),
  ('search_imei','فحص IMEI','devices'),
  ('create_device','تسجيل جهاز','devices'),
  ('create_sale','تسجيل بيع','commerce'),
  ('view_sales','عرض المبيعات','commerce'),
  ('create_repair','تسجيل صيانة','service'),
  ('create_format_record','تسجيل فرمتة','service'),
  ('view_customer','عرض العميل','commerce'),
  ('view_identity','عرض الهوية','sensitive'),
  ('view_sensitive_data','عرض البيانات الحساسة','sensitive'),
  ('create_stolen_report','إنشاء بلاغ سرقة','reports'),
  ('review_report','مراجعة البلاغ','reports'),
  ('view_all_reports','عرض كل البلاغات','reports'),
  ('assign_case','إحالة القضية','reports'),
  ('change_report_status','تغيير حالة البلاغ','reports'),
  ('update_follow_up','تحديث المتابعة','reports'),
  ('upload_evidence','رفع دليل','evidence'),
  ('view_evidence','عرض الأدلة','evidence'),
  ('view_audit_logs','عرض سجل التدقيق','governance'),
  ('manage_shops','إدارة المحلات','shops'),
  ('manage_shop_staff','إدارة موظفي المحل','shops'),
  ('approve_shop','اعتماد محل','shops'),
  ('suspend_shop','تعليق محل','shops'),
  ('manage_users','إدارة المستخدمين','identity'),
  ('manage_permissions','إدارة الصلاحيات','identity'),
  ('view_dashboard','عرض لوحة التحكم','general'),
  ('generate_reports','توليد التقارير','reports'),
  ('view_security_events','عرض الأحداث الأمنية','governance'),
  ('manage_system_settings','إدارة إعدادات النظام','governance'),
  ('correct_record','تصحيح سجل','governance')
on conflict (code) do update set name_ar = excluded.name_ar;

-- ربط الصلاحيات بالأدوار
with mapping(role_code, perm_code) as (
  select 'system_admin', p.code from public.permissions p
  union all select 'authorized_officer', c from unnest(array[
    'view_device','view_all_devices','search_imei','view_sales','view_customer','view_identity',
    'create_stolen_report','review_report','view_all_reports','change_report_status','update_follow_up',
    'view_evidence','upload_evidence','view_dashboard','generate_reports','approve_shop','suspend_shop','manage_shops']) c
  union all select 'investigation_officer', c from unnest(array[
    'view_device','view_all_devices','search_imei','view_all_reports','review_report','assign_case',
    'change_report_status','update_follow_up','upload_evidence','view_evidence','view_identity',
    'view_sensitive_data','view_dashboard','generate_reports']) c
  union all select 'delegate', c from unnest(array[
    'view_device','search_imei','create_stolen_report','update_follow_up','upload_evidence','view_dashboard']) c
  union all select 'shop_manager', c from unnest(array[
    'view_device','search_imei','create_device','create_sale','view_sales','create_repair',
    'create_format_record','view_customer','manage_shop_staff','view_dashboard','generate_reports']) c
  union all select 'technician', c from unnest(array[
    'view_device','search_imei','create_repair','create_format_record','view_dashboard']) c
  union all select 'auditor', c from unnest(array[
    'view_audit_logs','view_security_events','view_all_reports','view_all_devices','view_dashboard','generate_reports']) c
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from mapping m
join public.roles r on r.code = m.role_code
join public.permissions p on p.code = m.perm_code
on conflict do nothing;

insert into public.system_settings (key, value, description_ar) values
  ('mfa_required_for_sensitive', 'true'::jsonb, 'اشتراط AAL2 للعمليات الحساسة'),
  ('rate_limit_per_minute', '60'::jsonb, 'حد الطلبات في الدقيقة'),
  ('platform_name', '"حماية | نظام مكافحة سرقة الأجهزة"'::jsonb, 'اسم المنصة')
on conflict (key) do nothing;
