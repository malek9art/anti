// مُشغّل قاعدة بيانات حقيقية (PGlite) مع بدائل لمخططات auth/storage والأدوار
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

const PRELUDE = `
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists private;

-- بدائل الامتدادات غير المتاحة داخل PGlite
create or replace function extensions.gen_random_uuid() returns uuid
language sql volatile as $fn$ select gen_random_uuid() $fn$;

create or replace function extensions.digest(p_data text, p_type text) returns bytea
language sql immutable as $fn$
  -- بديل اختباري فقط: md5 مكرّر بطول 64 خانة (الإنتاج يستخدم pgcrypto/sha256)
  select decode(md5(p_data) || md5(md5(p_data) || p_type), 'hex')
$fn$;

-- بدائل auth
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid
language sql stable as $fn$
  select nullif(current_setting('test.user_id', true), '')::uuid
$fn$;

-- بدائل storage
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean not null default false);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text);

-- الأدوار
do $do$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $do$;
`;

export async function createTestDb() {
  const db = await new PGlite();
  await db.exec(PRELUDE);

  const migDir = join(root, 'supabase/migrations');
  for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) {
    let sql = readFileSync(join(migDir, f), 'utf8');
    // إسقاط أوامر إنشاء الامتدادات غير المتاحة (مُستبدلة ببدائل أعلاه)
    sql = sql.replace(/create extension[^;]+;/gi, '');
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`فشل تنفيذ ${f}: ${e.message}`);
    }
  }
  return db;
}

export async function asUser(db, userId) {
  await db.query(`select set_config('test.user_id', $1, false)`, [userId]);
}

export async function setAal(db, aal) {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ aal })]);
}

export async function makeUser(db, { name, email, roles = [], status = 'active' }) {
  const { rows } = await db.query(`insert into auth.users (email) values ($1) returning id`, [email]);
  const id = rows[0].id;
  await db.query(
    `insert into public.users (id, full_name, email, status) values ($1,$2,$3,$4::public.account_status)`,
    [id, name, email, status]);
  for (const r of roles) {
    await db.query(
      `insert into public.user_roles (user_id, role_id) select $1, id from public.roles where code = $2`,
      [id, r]);
  }
  return id;
}
