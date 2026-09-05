# قوالب أعمال GitHub Actions

لم يُسمح للتطبيق المتصل بإنشاء ملفات داخل `.github/workflows/` تلقائيًا
(يتطلب صلاحية `workflows`). فعّلها بنفسك بأمر واحد:

```bash
mkdir -p .github/workflows
cp docs-source/workflows/verify.yml docs-source/workflows/deploy-backend.yml .github/workflows/
git add .github/workflows && git commit -m "تفعيل أعمال GitHub" && git push
```

أو أنشئهما من واجهة GitHub: **Actions → New workflow → set up a workflow yourself**،
والصق محتوى كل ملف.

| الملف | الغرض |
|---|---|
| `verify.yml` | بوابة الجودة على كل دفعة وكل PR (`npm run verify`) |
| `deploy-backend.yml` | نشر دوال الحافة يدويًا لمرة واحدة (workflow_dispatch) |
