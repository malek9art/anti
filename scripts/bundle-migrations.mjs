#!/usr/bin/env node
// يدمج migrations المرقّمة في ملف واحد لتشغيله في Supabase SQL Editor
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const migDir = join(root, 'supabase/migrations');
const outFile = join(root, 'supabase/schema.sql');
const check = process.argv.includes('--check');

const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
if (files.length === 0) { console.error('لا توجد ملفات migrations'); process.exit(1); }

const header = `-- ملف المخطط المدمج — مولّد آليًا من supabase/migrations
-- لا تعدّله يدويًا. شغّل: npm run sql:bundle
-- الملفات المدمجة: ${files.length}
`;
const body = files.map((f) => `\n\n-- ==================== ${f} ====================\n${readFileSync(join(migDir, f), 'utf8').trim()}\n`).join('');
const bundle = header + body + '\n';

if (check) {
  if (!existsSync(outFile)) { console.error('✗ supabase/schema.sql مفقود. شغّل npm run sql:bundle'); process.exit(1); }
  if (readFileSync(outFile, 'utf8') !== bundle) {
    console.error('✗ supabase/schema.sql غير متزامن مع migrations. شغّل npm run sql:bundle');
    process.exit(1);
  }
  console.log('✓ المخطط المدمج متزامن مع migrations');
} else {
  writeFileSync(outFile, bundle);
  console.log(`✓ تم دمج ${files.length} ملف في supabase/schema.sql`);
}
