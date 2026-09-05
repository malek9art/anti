#!/usr/bin/env node
// فحص أسرار: يرفض service_role JWT أو أسرار خادمية في المستودع
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SKIP = new Set(['node_modules', '.git', 'dist', '.vite']);
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.sql', '.md', '.html', '.yml', '.yaml', '.env', '.example']);

const violations = [];
const rules = [
  { name: 'service_role JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    test: (m) => { try { return JSON.parse(Buffer.from(m.split('.')[1], 'base64').toString()).role === 'service_role'; } catch { return false; } } },
  { name: 'تعيين SERVICE_ROLE_KEY صريح', re: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'`][^"'`\s]{10,}/g },
  { name: 'متغير VITE_ يحمل سرًا', re: /VITE_[A-Z0-9_]*(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|ENCRYPTION)[A-Z0-9_]*/g },
  { name: 'كلمة مرور قاعدة البيانات', re: /(SUPABASE_DB_PASSWORD|DB_PASSWORD)\s*[:=]\s*["'`][^"'`\s$][^"'`\s]{4,}/g },
  { name: 'مفتاح خاص PEM', re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g },
];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (SCAN_EXT.has(extname(p)) || entry.startsWith('.env')) scan(p);
  }
}

function scan(p) {
  if (p.endsWith('scripts/check-secrets.mjs')) return;
  const text = readFileSync(p, 'utf8');
  for (const rule of rules) {
    for (const m of text.match(rule.re) || []) {
      if (rule.test && !rule.test(m)) continue;
      violations.push(`${p.replace(root, '')} → ${rule.name}`);
    }
  }
}

walk(root);
if (violations.length) {
  console.error('✗ فحص الأسرار فشل:');
  for (const v of [...new Set(violations)]) console.error('  - ' + v);
  process.exit(1);
}
console.log('✓ فحص الأسرار: لا أسرار خادمية في المستودع (مفتاح anon العام مسموح)');
