<div align="center">
  <img src="public/logo.png" alt="شعار حماية" width="120" />
  <h1>حماية | نظام مكافحة سرقة الأجهزة</h1>
  <p>منصة ويب عربية (RTL) لإدارة دورة حياة الأجهزة بالاعتماد على IMEI كمعرّف موثوق</p>
</div>

---

## نظرة عامة

منصة تربط الجهات المختصة بمحلات البيع والصيانة عبر معرّف **IMEI**:
تسجيل الأجهزة، البيع، الصيانة والفرمتة، بلاغات السرقة ومسار حالاتها حتى الاسترداد،
مع سجل تدقيق **تسلسلي التجزئة** غير قابل للعبث.

| المكوّن | التقنية |
|---|---|
| الواجهة | React 18 + TypeScript + Vite (PWA، RTL) |
| التوجيه | HashRouter (متوافق مع GitHub Pages) |
| الخلفية | Supabase: PostgreSQL + RLS + دوال SECURITY DEFINER |
| نقاط الدخول | 44 Edge Function (Deno) — الواجهة لا تلمس الجداول مباشرة |
| التخزين | دلاء خاصة + روابط موقّعة قصيرة العمر |
| المصادقة | Supabase Auth + MFA (TOTP) وفرض AAL2 خادميًا |

## التوثيق العربي الكامل

| المستند | المحتوى |
|---|---|
| [`docs-source/01-setup.md`](docs-source/01-setup.md) | الإعداد من المتصفح فقط |
| [`docs-source/02-database.md`](docs-source/02-database.md) | تشغيل SQL والتصفير |
| [`docs-source/03-backend.md`](docs-source/03-backend.md) | نشر دوال الحافة لمرة واحدة |
| [`docs-source/04-first-admin.md`](docs-source/04-first-admin.md) | إنشاء أول مدير |
| [`docs-source/05-deploy-pages.md`](docs-source/05-deploy-pages.md) | النشر على GitHub Pages |
| [`docs-source/06-security.md`](docs-source/06-security.md) | الثوابت الأمنية |
| [`docs-source/07-troubleshooting.md`](docs-source/07-troubleshooting.md) | استكشاف الأعطال |
| [`docs-source/workflows/README.md`](docs-source/workflows/README.md) | تفعيل أعمال GitHub Actions |

## أوامر سريعة

```bash
npm install
npm run dev        # تشغيل محلي
npm run verify     # بوابة الجودة الكاملة
npm run sql:bundle # دمج migrations في supabase/schema.sql
```

## بوابة الجودة `npm run verify`

1. فحص الأسرار (يرفض أي مفتاح خدمة سري أو سر خادمي).
2. فحص توازن أقواس SQL.
3. تزامن `supabase/schema.sql` مع `supabase/migrations/`.
4. `tsc --noEmit`.
5. اختبارات على **PostgreSQL حقيقي** (PGlite) تشمل دورة الحياة الكاملة واختبارات الانحدار.
6. بناء الإنتاج + فحص PWA/manifest/service worker/`config.js`.

## الأمان

- لا مفتاح خدمة سري ولا كلمة مرور قاعدة ولا مفاتيح تشفير في المستودع أو أي متغير `VITE_*`.
- المتغيران العامّان المسموحان فقط: `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`.
- RLS "منع افتراضيًا" على كل جدول، والسجلات الحرجة append-only.
- تحقق IMEI بخوارزمية Luhn في الواجهة والخادم معًا.
- رقم IMEI **لا** يتيح تتبّع موقع الجهاز — المنصة لا تدّعي ذلك.

## الشعار

الشعار الرسمي في `public/logo.png` (PNG بخلفية شفافة)، ويُستخدم عبر مكوّن واحد
`src/components/Logo.tsx` في الهيدر وشاشة الدخول ولوحة التحكم والتقارير والطباعة.
ألوان الهوية: الأخضر الداكن `#0B3D2E` والذهبي `#C9A24D` والأبيض.
