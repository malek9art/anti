-- ============================================================================
-- ربط مستخدم الإدارة
-- ============================================================================
-- المستخدم: alahmdyalahmdyalahmdy13@gmail.com
-- المعرّف : e6088d05-c472-4059-9c0f-3660190bbcb0
--
-- شرط مسبق: يجب أن يكون هذا المستخدم موجودًا في auth.users
--            (سجّل الدخول/الحساب من شاشة التطبيق أولًا، أو أنشئه من
--             Supabase → Authentication → Users).
-- السكربت Idempotent: تشغيله أكثر من مرة آمن.
-- ============================================================================

do $$
declare
  v_id    uuid := 'e6088d05-c472-4059-9c0f-3660190bbcb0';
  v_email text := 'alahmdyalahmdyalahmdy13@gmail.com';
  v_role  uuid;
  v_found uuid;
begin
  -- 1) التأكد من وجود المستخدم في نظام المصادقة
  select id into v_found from auth.users where id = v_id;

  if v_found is null then
    select id into v_found from auth.users where lower(email) = lower(v_email);
    if v_found is null then
      raise exception using
        errcode = 'P0002',
        message = format('لم يُعثر على المستخدم %s في auth.users', v_email),
        hint    = 'أنشئ الحساب أولًا من شاشة الدخول في التطبيق أو من Supabase → Authentication → Users، ثم أعد تشغيل هذا السكربت.';
    end if;
    raise notice 'تنبيه: المعرّف المُدخل لا يطابق، سيُستخدم المعرّف الفعلي للبريد: %', v_found;
    v_id := v_found;
  end if;

  -- 2) إنشاء/تحديث ملف المستخدم في المنصة وتفعيله
  insert into public.users (id, full_name, email, status)
  values (v_id, 'مدير النظام', v_email, 'active')
  on conflict (id) do update
    set status = 'active',
        email  = excluded.email,
        updated_at = now();

  -- 3) إسناد دور مدير النظام (كامل الصلاحيات الـ31)
  select id into v_role from public.roles where code = 'system_admin';
  if v_role is null then
    raise exception 'لم يُعثر على الدور system_admin — نفّذ ملف المخطط الكامل أولًا.'
      using errcode = 'P0002';
  end if;

  insert into public.user_roles (user_id, role_id)
  values (v_id, v_role)
  on conflict do nothing;

  raise notice '========================================';
  raise notice 'تم ربط مدير النظام بنجاح';
  raise notice 'البريد : %', v_email;
  raise notice 'المعرّف: %', v_id;
  raise notice 'الدور  : system_admin (31 صلاحية)';
  raise notice '========================================';
  raise notice 'الخطوة التالية: سجّل الدخول ثم فعّل المصادقة الثنائية';
  raise notice 'من صفحة «حسابي والأمان» — بدونها تُرفض العمليات الحساسة.';
end $$;

-- التحقق من النتيجة
select
  u.email                                   as "البريد",
  u.full_name                               as "الاسم",
  u.status                                  as "الحالة",
  string_agg(r.code, ', ')                  as "الأدوار",
  (select count(*)
     from public.user_roles ur2
     join public.role_permissions rp on rp.role_id = ur2.role_id
    where ur2.user_id = u.id)               as "عدد الصلاحيات"
from public.users u
left join public.user_roles ur on ur.user_id = u.id
left join public.roles r on r.id = ur.role_id
where u.id = 'e6088d05-c472-4059-9c0f-3660190bbcb0'
   or lower(u.email) = 'alahmdyalahmdyalahmdy13@gmail.com'
group by u.id, u.email, u.full_name, u.status;
