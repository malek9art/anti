# 3) نشر دوال الحافة (لمرة واحدة)

## لماذا لا يمكن النشر من لوحة Supabase؟

دوال هذا المشروع تشارك مجلد `supabase/functions/_shared/` (المصادقة، معالجة الأخطاء،
تحديد المعدل، تحقق IMEI). محرر اللوحة لا يدعم الملفات المشتركة بشكل موثوق،
لذا يجب النشر عبر **GitHub Actions** أو **Supabase CLI**.

## الطريقة الموصى بها: GitHub Actions

1. أضف الأسرار الثلاثة (انظر [`01-setup.md`](01-setup.md)).
2. افتح تبويب **Actions** في المستودع.
3. اختر **«نشر الخلفية (لمرة واحدة)»** ← **Run workflow**.
4. انتظر اكتمال العمل (ينشر 44 دالة).

## البديل: Supabase CLI محليًا

```bash
supabase login
supabase link --project-ref chgauqwrfcdjlpmrpjda
supabase functions deploy --project-ref chgauqwrfcdjlpmrpjda
```

## ملاحظة على متغيرات البيئة

دوال الحافة تقرأ `SUPABASE_URL` و`SUPABASE_ANON_KEY` و`SUPABASE_SERVICE_ROLE_KEY`
من بيئة Supabase تلقائيًا — لا حاجة لتعريفها يدويًا ولا لوضعها في المستودع.

`SUPABASE_SERVICE_ROLE_KEY` يُستخدم **فقط** داخل الحافة لإصدار روابط تخزين موقّعة
بعد تحقق قاعدة البيانات وتسجيل الوصول، ولا يصل المتصفح أبدًا.

## متى تعيد النشر؟

عند أي تعديل على `supabase/functions/`. إعادة التشغيل آمنة ومتكررة.
