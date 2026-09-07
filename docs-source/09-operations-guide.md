# دليل التشغيل الكامل وتهيئة قاعدة البيانات

> **حماية | نظام مكافحة سرقة الأجهزة** — دليل من الصفر حتى التشغيل الكامل،
> مع تهيئة قاعدة البيانات ونشر دوال الحافة ونشر GitHub Pages وتهيئة الأدوار.

---

## ١) المتطلبات المسبقة

| العنصر | التفصيل |
|---|---|
| **Supabase** | مشروع حي (URL + `anon` key). مفتاح `service_role` يُستخدم **خادميًا فقط** في دوال الحافة ولا يدخل الواجهة أو المستودع. |
| **Node.js** | ≥ 20 (موجود في CI). |
| **npm** | لإدارة الاعتماديات. |
| **GitHub** | مستودع، مع تفعيل GitHub Pages من `/docs`. |
| **دوال الحافة** | يجب نشرها (انظر §٤) — **بدونها لا يكتمل تسجيل الدخول**. |

المتغيرات المسموح بها في `.env`/`.env.example` (لا أسرار خادمية):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
VITE_ROUTER_MODE=hash
VITE_BASE_PATH=./        # نسبي — لا تضبطه بقيمة مطلقة مثل /anti/
```

> ⚠️ قاعدة ذهبية: لا `SUPABASE_SERVICE_ROLE_KEY` في أي ملف. يُقرأ تلقائيًا داخل
> دوال الحافة من بيئة Supabase. مفتاح `anon` عام بطبيعته.

---

## ٢) تهيئة قاعدة البيانات (من الصفر)

### الطريقة الموصى بها: ملف `supabase/SETUP.sql` (مولَّد آليًا)

`supabase/SETUP.sql` ملف **idempotent** (يُشغَّل أكثر من مرة بأمان) يضم:
كل migrations المرقّمة + ربط مستخدم الإدارة + استعلام تحقّق نهائي.

**الخطوات:**

1. افتح **Supabase → SQL Editor → New query**.
2. الصق محتوى `supabase/SETUP.sql` بالكامل.
3. اضغط **Run**.
4. اقرأ نتائج استعلام «التحقق النهائي»؛ المتوقع:

| الفحص | المتوقع |
|---|---|
| خوارزمية Luhn — رقم صحيح | `true` |
| خوارزمية Luhn — رقم خاطئ | `false` |
| عدد الأدوار | `7` |
| عدد الصلاحيات | `31` |
| جداول بلا RLS | `0` |
| صلاحيات ممنوحة لـ `anon` | `0` |
| دلاء التخزين (`device-media`, `evidence`, `branding`) | `3` |
| مدراء النظام المرتبطون | `1 أو أكثر` |

> **شرط مسبق:** مستخدم الإدارة (الافتراضي `alahmdyalahmdyalahmdy13@gmail.com`)
> يجب أن يكون **موجودًا في `auth.users`** قبل تشغيل `SETUP.sql` (من شاشة التسجيل
> في التطبيق، أو من Supabase → Authentication → Users). إن لم يؤكَّد البريد وفرضت
> المنصة التأكيد، أكّده من اللوحة أو من رابط التأكيد.

### بديل: تشغيل migrations يدويًا

```bash
npm install
npm run sql:setup      # توليد supabase/SETUP.sql (تلقائيًا بعد التعديل)
npm run sql:bundle     # توليد supabase/schema.sql
```

ثم شغّل `supabase/SETUP.sql` كما أعلاه.

### إعادة التهيئة من الصفر (اختياري، لبيئة تطوير فقط)

```sql
-- في SQL Editor — يحذف كل كائنات public ثم يعيد إنشاءها من SETUP.sql
supabase/scripts/reset_all_objects.sql
```

---

## ٣) ربط مستخدم الإدارة (أول مدير)

`supabase/scripts/link_admin_user.sql` يربط مستخدمًا معيّنًا بدور `system_admin`
(31 صلاحية) ويضبط حالته `active`. يمكنك تعديل البريد/المعرّف داخله.

إن أردت ربط أي بريد آخر، انسخ السكربت و/أو عدّل السطرين في أعلاه:

```sql
v_id    uuid := '<uuid>';
v_email text := 'بريد@مثال.com';
```

التحقق من الربط:

```sql
select u.email, u.status,
       string_agg(r.code, ', ') as roles,
       (select count(*) from public.user_roles ur
          join public.role_permissions rp on rp.role_id = ur.role_id
         where ur.user_id = u.id) as permissions
from public.users u
left join public.user_roles ur on ur.user_id = u.id
left join public.roles r on r.id = ur.role_id
where lower(u.email) = 'بريد@مثال.com'
group by u.id;
```

المتوقع: `status = active`, `roles = system_admin`, `permissions = 31`.

---

## ٤) نشر دوال الحافة (إلزامي — 51 دالة)

دوال الحافة `supabase/functions/*` تشارك مجلد `_shared`، لذا **يُفضَّل النشر عبر
GitHub Actions أو Supabase CLI** (محرر اللوحة لا يدعم الملفات المشتركة).

### عبر GitHub Actions

1. فعّل القوالب: انسخ من `docs-source/workflows/` إلى `.github/workflows/`:
   ```bash
   mkdir -p .github/workflows
   cp docs-source/workflows/verify.yml docs-source/workflows/deploy-backend.yml .github/workflows/
   ```
   > يتطلب صلاحية `workflows`. إن رُفض الدفع، افتحها من واجهة GitHub (Actions → New workflow → set up a workflow yourself) والصق المحتوى.
2. أضف الأسرار (Settings → Secrets → Actions):
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_PROJECT_ID`
   - `SUPABASE_DB_PASSWORD`
3. **Actions → «نشر الخلفية (لمرة واحدة)» → Run workflow** ← ينشر الـ51 دالة.

### عبر Supabase CLI

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy --project-ref <project-ref>
```

### تحقق سريع

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://<project-ref>.supabase.co/functions/v1/bootstrap \
  -H "Content-Type: application/json" -d '{}'
```

- `200` → الدوال منشورة.
- `404` / `no function found` → لم تُنشر بعد؛ راجع أعلاه.

---

## ٥) النشر على GitHub Pages

1. **Settings → Pages → Source: `Deploy from a branch`** → الفرع `main` → **Folder: `/docs`**.
2. `docs/` هو ناتج البناء الجاهز (يحتوي `.nojekyll` و`assets/`). لا تستخدم `/ (root)`.
3. أعد البناء بعد أي تعديل:
   ```bash
   VITE_ROUTER_MODE=hash npm run build   # ينتج في docs/
   ```
   > لا تحقن `VITE_BASE_PATH=/anti/`. الحزمة مبنية بأصول نسبية `./` وتعمل تحت أي مسار.
4. ادفع `docs/` بالكامل (بما فيه `docs/.nojekyll` و`docs/assets/`).
5. افتح `https://<owner>.github.io/<repo>/`.

**فحص الجودة** قبل أي دفع:

```bash
npm run verify
```

يُفشل إذا: ظهر مسار مطلق في `docs/index.html`، أو `PRECACHE` يحوي
`index.html`/`'./'`/`config.js`، أو `sw.js` بلا `navigate`/`SKIP_WAITING`،
أو `index.html` بلا `__himayaRecover`/`id="boot"`.

---

## ٦) بعد النشر: تسجيل الدخول وتفعيل MFA

1. افتح الموقع واختر تبويب «حساب جديد» وسجّل بريدك وكلمة مرور قوية (≥ 10 أحرف).
2. أكّد البريد إن طلبت المنصة (إن فُرض «Confirm email»).
3. شغّل §٣ (ربط المدير) إن لم تشغّل `SETUP.sql` بعد.
4. اضغط «تحديث الحالة» → ستدخل بدور `system_admin`.
5. من **حسابي والأمان** فعّل **المصادقة الثنائية (TOTP)**:
   - اضغط «تفعيل»، امسح رمز QR في تطبيق مصادقة، أدخل الرمز المكوّن من 6 أرقام.
   - بعدها تصبح الجلسة `aal2` — **إلزامية** للعمليات الحساسة (بيع، بلاغ، تغيير حالة، رفع أدلة، شعار).

> **مهم:** دوال الحافة الـ51 **يجب أن تكون منشورة** حتى يكتمل `bootstrap` وتُحمَّل
> الأدوار. بدونها تظهر شاشة «حسابك بانتظار التفعيل» (خطأ شائع).

---

## ٧) دليل التشغيل حسب الدور

### ٧.١ صاحب المحل / مدير المحل (`shop_manager`)
- **تسجيل جهاز (الأجهزة → تسجيل جهاز):** أدخل الماركة/الموديل/اللون/الرقم التسلسلي
  + **IMEI الأساسي (إلزامي)** و**IMEI الثانوي (اختياري Dual-SIM)**، ثم بعد الإنشاء
  يمكنك **تصوير الجهاز** (يُخزَّن في دلو خاص برابط موقّع).
- **تسجيل بيع (المبيعات):** اختر محلًا وجهازًا، وأدخل **بيانات المشتري** (الاسم/الهاتف/الهوية).
  تُشفَّر البيانات قبل الإرسال ولا تُعرض كنص صريح. يتطلب `aal2`.
- **الصيانة والفرمتة:** IMEI ← فحص ← إن كان سليمًا سجّل صيانة أو فرمتة (بموافقة المالك؛
  الفرمتة تتطلب `aal2`).

### ٧.٢ فني الصيانة (`technician`)
- **استلام جهاز (الصيانة والفرمتة):**
  1. أدخل **IMEI** → «فحص الجهاز» (فحص خادمي).
  2. إن كان على الجهاز بلاغ → **🚨 يُمنع الاستلام** ويُسجَّل حدث أمني.
  3. إن كان سليمًا → سجّل العملية (بيع/صيانة/فرمتة).
  4. بعد الحفظ تظهر **بطاقة تأكيد**: اسم الفني، المحل، IMEI، التاريخ والوقت، رقم العملية.
- **لا يستطيع الفني حذف/تعديل السجل** (append-only في `audit_logs` و`record_corrections`).

### ٧.٣ البحث الجنائي / الضابط (`authorized_officer`, `investigation_officer`)
- **المحلات:** اعتماد محل، تعليق محل (`approve_shop`/`suspend_shop`).
- **البلاغات:** إنشاء بلاغ، مراجعة، إحالة (`assign_report`)، تغيير الحالة
  (`update-report-status`) بحسب آلة الحالات، إضافة متابعات.
- **الأدلة:** رفع/عرض الأدلة (يتطلب `aal2` + `upload_evidence`).
- **الفحص:** البحث بالـ IMEI ومشاهدة سجل الجهاز ومن باعه/أصلحه.
- **التقارير:** مبيعات/صيانة/فرمتة/بلاغات + **امتثال المحلات**.
- **التحكم:** إدارة المستخدمين والأدوار، الأحداث الأمنية، سجل التدقيق.

### ٧.٤ المندوب (`delegate`)
- **مهامي:** تعرض البلاغات **المُحالة إليك فقط** (قائمة + «فتح المتابعة»).
- داخل البلاغ: إضافة **متابعات** ورفع **أدلة** وتحديث الحالة ضمن صلاحياتك.
- لا يرى `change_report_status`/`assign_case` (مقيّد بالحد الأدنى من الصلاحية).
- **لا يظهر للمحل/المندوب العادي بيانات هوية المبلّغ أو الدولة** — تُعرض فقط عبر
  صلاحية `view_identity`/`view_sensitive_data` ويُسجَّل الوصول.

### ٧.٥ شاشة فحص الجهاز (أهم شاشة)
- أدخل IMEI (15 رقمًا، يُتحقق بـ **Luhn** محليًا وخادميًا).
- **سليم:** 🟢 لا توجد بلاغات نشطة.
- **مبلَّغ:** 🔴 رقم البلاغ، التاريخ، حالة البلاغ — **دون كشف هوية المبلّغ**.
- ملاحظة ثابتة: IMEI لا يتيح تتبّع موقع الجهاز؛ النتيجة حالة تسجيل وبلاغات فقط.

---

## ٨) الأمن (ثوابت غير قابلة للتفاوض)

1. **لا أسرار خادمية** في الواجهة/المستودع؛ استثناء فقط `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`.
2. **تنفيذ خادمي فقط:** RLS + دوال `SECURITY DEFINER`؛ الواجهة تُخفي الأزرار ولا تمنح صلاحية.
3. **RLS منع افتراضيًا** على كل جداول `public` (force) + `revoke all` من `anon/authenticated`.
4. **MFA (TOTP)** وفرض `aal2` على العمليات الحساسة (16+ عملية).
5. **دلاء خاصة** (`device-media`, `evidence`)؛ كل الوصول بروابط موقّعة قصيرة (120 ثانية).
6. **الهوية/بيانات المشتري مشفّرة** ولا تُعرض إلا للمخوّل مع تسجيل الوصول.
7. **سجل تدقيق** `audit_logs` بسلسلة تجزئة غير قابل للعبث + `record_corrections`.
8. **لا بيانات تجريبية ولا مدير ثابت** في البذور.
9. **مؤقّتات:** تنبيه لمحاولات الدخول المشبوهة (`security_events`).
10. **انتهاء جلسة** تلقائيًا عبر Supabase Auth (auto-refresh + persist session).

---

## ٩) استكشاف الأعطال السريع

| الأعراض | السبب/الحل |
|---|---|
| شاشة بيضاء «تخطٍّ إلى المحتوى الرئيسي» | افتح `/reset.html` أو زر «مسح الذاكرة المؤقتة»؛ لا تدخل `index.html`/باث مطلق في `PRECACHE` |
| «حسابك بانتظار التفعيل» | دوال الحافة غير منشورة، أو الحساب غير مربوط/غير نشط/بلا دور → §٣ + §٤ |
| «إعدادات الاتصال مفقودة» | `config.js` يجب أن يُحمَّل **قبل** وحدة التطبيق |
| «هذه العملية تتطلب مصادقة ثنائية» | فعّل TOTP من «حسابي والأمان» ثم أعد الدخول |
| «لا تملك الصلاحية اللازمة» | حسابك بلا دور مناسب → من `system_admin` عيّن الأدوار |
| استدعاءات الدوال ترجع 404 | دوال الحافة لم تُنشر → §٤ |
| «رقم IMEI غير صالح» | فشل Luhn؛ للاختبار استخدم `490154203237518` |

---

## ١٠) أوامر سريعة

```bash
npm install            # الاعتماديات
npm run dev            # تشغيل محلي (Vite) — يعرض المعاينة الحية
npm run verify         # بوابة الجودة الكاملة (اختبارات + بناء + فحص PWA)
npm run typecheck      # فحص أنواع TS
npm run test           # اختبارات (29)
npm run build          # بناء إنتاج -> docs/
npm run sql:setup      # توليد supabase/SETUP.sql
npm run sql:bundle     # دمج migrations -> supabase/schema.sql
npm run check:pwa      # فحص PWA والنشر
```

---

## ١١) متغيرات المسار والبناء

| المتغير | القيمة | السبب |
|---|---|---|
| `VITE_ROUTER_MODE` | `hash` | GitHub Pages لا يعيد كتابة مسارات BrowserRouter |
| `VITE_BASE_PATH` | (اختياري، الافتراضي `./`) | مسارات نسبية تعمل تحت أي مسار أساس؛ **لا** تضبطه مطلًقًا (`/anti/`) |

---

*آخر تحديث: استنادًا إلى الكود الحالي (51 دالة حافة، 7 أدوار، 31 صلاحية، RLS مفروض، MFA إلزامي للعمليات الحساسة).*
