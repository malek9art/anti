# 5) النشر على GitHub Pages

## الإعداد (مرة واحدة)

1. **Settings → Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: فرع النشر (مثلًا `main`) — **Folder: `/docs`** ← ⚠️ وليس `/ (root)`
4. **Save**

## لماذا `/docs` وليس الجذر؟

الجذر يحتوي على ملفات المصدر لا الموقع المبني، وسيؤدي إلى **شاشة بيضاء**.
مجلد `docs/` هو ناتج البناء الجاهز، ويحتوي على `.nojekyll` لمنع Jekyll من تجاهل الأصول.

## إعادة البناء بعد أي تعديل

```bash
VITE_BASE_PATH=/<repo>/ VITE_ROUTER_MODE=hash npm run build
```

ثم ادفع مجلد `docs/`.

| المتغير | القيمة | السبب |
|---|---|---|
| `VITE_BASE_PATH` | `/<repo>/` | Pages يقدّم الموقع تحت مسار فرعي |
| `VITE_ROUTER_MODE` | `hash` | Pages لا يعيد كتابة مسارات BrowserRouter |

## ملف `config.js`

`docs/config.js` يُحمَّل عبر وسم `<script>` عادي **قبل** وحدة التطبيق،
ويعرّف `window.__HIMAYA_CONFIG__`. هذا يتيح تغيير عنوان Supabase دون إعادة بناء.

فحص `npm run check:pwa` يفشل إذا حُمّل `config.js` بعد وحدة التطبيق.

## التحقق

افتح `https://<owner>.github.io/<repo>/` — يجب أن تظهر شاشة الدخول بالشعار،
والتطبيق قابل للتثبيت كتطبيق (PWA) على الجوال.
