# 1) الإعداد من المتصفح فقط

لا تحتاج إلى تثبيت أي أداة على جهازك. كل الخطوات تتم من المتصفح.

## ما تحتاجه

- حساب GitHub (تملك المستودع).
- حساب Supabase مع نفس المشروع القائم: `chgauqwrfcdjlpmrpjda`.

## القيم العامة

هاتان القيمتان عامّتان بطبيعتهما (مفتاح `anon`) وموجودتان في `public/config.js` و`docs/config.js`:

- `SUPABASE_URL` = `https://chgauqwrfcdjlpmrpjda.supabase.co`
- `SUPABASE_ANON_KEY` = مفتاح `anon` العام.

> ⚠️ ممنوع منعًا باتًا وضع مفتاح الخدمة السري أو كلمة مرور قاعدة البيانات أو مفاتيح
> التشفير في هذه الملفات أو في أي متغير يبدأ بـ `VITE_`. مكانها **GitHub Secrets** فقط.

## ترتيب التنفيذ

1. **تصفير قاعدة البيانات** ← [`02-database.md`](02-database.md)
2. **تشغيل المخطط** ← [`02-database.md`](02-database.md)
3. **نشر دوال الحافة لمرة واحدة** ← [`03-backend.md`](03-backend.md)
4. **تفعيل GitHub Pages من `/docs`** ← [`05-deploy-pages.md`](05-deploy-pages.md)
5. **إنشاء أول مدير** ← [`04-first-admin.md`](04-first-admin.md)

## أسرار GitHub المطلوبة (للخطوة 3 فقط)

من `Settings → Secrets and variables → Actions`:

| السر | من أين تحصل عليه |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens |
| `SUPABASE_PROJECT_ID` | `chgauqwrfcdjlpmrpjda` |
| `SUPABASE_DB_PASSWORD` | Supabase → Project Settings → Database |

لا تضع هذه القيم في أي ملف داخل المستودع، ولا تشاركها في أي محادثة.
