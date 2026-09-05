#!/usr/bin/env node
// فحص توازن الأقواس والكتل في ملفات SQL
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dirs = ['supabase/migrations', 'supabase/scripts', 'supabase/tests'];
let failed = false;

function stripped(sql) {
  // إزالة التعليقات والسلاسل النصية ودوال $$ حتى لا تُحسب أقواسها
  return sql
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''");
}

for (const d of dirs) {
  let files = [];
  try { files = readdirSync(join(root, d)).filter((f) => f.endsWith('.sql')); } catch { continue; }
  for (const f of files) {
    const raw = readFileSync(join(root, d, f), 'utf8');
    const s = stripped(raw);
    let depth = 0, line = 1, bad = 0;
    for (const ch of s) {
      if (ch === '\n') line++;
      else if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth < 0 && !bad) bad = line; }
    }
    const dollars = (raw.match(/\$\$/g) || []).length;
    if (depth !== 0 || bad || dollars % 2 !== 0) {
      failed = true;
      console.error(`✗ ${d}/${f}: اختلال أقواس (الفارق ${depth}${bad ? `، إغلاق زائد عند السطر ${bad}` : ''})${dollars % 2 ? '، عدد $$ فردي' : ''}`);
    }
  }
}
if (failed) process.exit(1);
console.log('✓ فحص توازن أقواس SQL نجح');
