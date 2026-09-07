#!/usr/bin/env node
// فحص ناتج البناء: PWA، manifest، service worker، config.js، مسار نسبي، صفحة الإنقاذ
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const docs = join(root, 'docs');
const errors = [];
const need = ['index.html', 'manifest.webmanifest', 'sw.js', 'config.js', '.nojekyll', 'logo.png', 'reset.html'];
for (const f of need) if (!existsSync(join(docs, f))) errors.push(`ملف مفقود: docs/${f}`);

if (existsSync(join(docs, 'index.html'))) {
  const html = readFileSync(join(docs, 'index.html'), 'utf8');
  if (!/dir="rtl"/.test(html)) errors.push('index.html: خاصية dir="rtl" مفقودة');
  if (!/lang="ar"/.test(html)) errors.push('index.html: خاصية lang="ar" مفقودة');
  if (!/manifest\.webmanifest/.test(html)) errors.push('index.html: رابط manifest مفقود');

  // فحص 4: must contain __himayaRecover و id="boot"
  if (!/__himayaRecover/.test(html)) errors.push('index.html: حارس الإقلاع __himayaRecover مفقود');
  if (!/id="boot"/.test(html)) errors.push('index.html: عنصر شاشة الإقلاع id="boot" مفقود');

  // فحص 1: لا مسارات مطلقة في index.html (استثناء // protocol-relative)
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]*)"/g)) {
    const p = m[1];
    if (p.startsWith('//')) continue; // روابط protocol-relative مقبولة
    errors.push(`index.html: مسار مطلق ظهر: "${p}" — يجب أن يكون نسبيًا (./) حتى يعمل النشر تحت أي مسار`);
  }

  const cfg = html.indexOf('config.js');
  const mod = html.indexOf('type="module"');
  if (cfg === -1) errors.push('index.html: config.js غير محمّل');
  else if (mod !== -1 && cfg > mod) errors.push('index.html: config.js يجب أن يُحمّل قبل وحدة التطبيق');
}

if (existsSync(join(docs, 'config.js'))) {
  const cfg = readFileSync(join(docs, 'config.js'), 'utf8');
  if (!/__HIMAYA_CONFIG__/.test(cfg)) errors.push('config.js: window.__HIMAYA_CONFIG__ مفقود');
  for (const jwt of cfg.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
    let role = '';
    try { role = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString()).role; } catch { /* تجاهل */ }
    if (role && role !== 'anon') errors.push(`config.js: مفتاح بدور "${role}" — يُسمح بمفتاح anon فقط!`);
  }
}

if (existsSync(join(docs, 'sw.js'))) {
  const sw = readFileSync(join(docs, 'sw.js'), 'utf8');

  // فحص 3: يجب أن يحوي navigate و SKIP_WAITING
  if (!/navigate/.test(sw)) errors.push('sw.js: لا يتضمن معالجة navigate (network-first للمستند)');
  if (!/SKIP_WAITING/.test(sw)) errors.push('sw.js: لا يتضمن رسالة SKIP_WAITING');

  // فحص 2: PRECACHE يجب ألّا يحوي index.html أو './' أو config.js
  const m = sw.match(/const\s+PRECACHE\s*=\s*\[([^\]]*)\]/);
  if (!m) {
    errors.push('sw.js: مصفوفة PRECACHE مفقودة');
  } else {
    const body = m[1];
    if (/index\.html/.test(body)) errors.push('sw.js: PRECACHE يحتوي index.html — ممنوع (سبب الشاشة البيضاء)');
    if (/['"]\.\/['"]\s*,|\[['"]\.\/['"]\]/.test(body) || /['"]\.\/['"]/.test(body)) errors.push('sw.js: PRECACHE يحتوي "./" — ممنوع');
    if (/config\.js/.test(body)) errors.push('sw.js: PRECACHE يحتوي config.js — ممنوع (يجب أن يمرّ عبر الشبكة دائمًا)');
  }
}

if (errors.length) { console.error('✗ فحص PWA/النشر فشل:'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log('✓ فحص PWA وناتج النشر نجح');
