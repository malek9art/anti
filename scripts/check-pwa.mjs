#!/usr/bin/env node
// فحص ناتج البناء: PWA، manifest، service worker، config.js، مسار hash
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const docs = join(root, 'docs');
const errors = [];
const need = ['index.html', 'manifest.webmanifest', 'sw.js', 'config.js', '.nojekyll', 'logo.png'];
for (const f of need) if (!existsSync(join(docs, f))) errors.push(`ملف مفقود: docs/${f}`);

if (existsSync(join(docs, 'index.html'))) {
  const html = readFileSync(join(docs, 'index.html'), 'utf8');
  if (!/dir="rtl"/.test(html)) errors.push('index.html: خاصية dir="rtl" مفقودة');
  if (!/lang="ar"/.test(html)) errors.push('index.html: خاصية lang="ar" مفقودة');
  if (!/manifest\.webmanifest/.test(html)) errors.push('index.html: رابط manifest مفقود');
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

if (errors.length) { console.error('✗ فحص PWA/النشر فشل:'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log('✓ فحص PWA وناتج النشر نجح');
