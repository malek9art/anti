-- 0001: الامتدادات والأنواع المعدودة
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.device_status as enum ('registered','sold','in_repair','formatted','reported_stolen','under_alert','recovered','retired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('draft','submitted','under_review','verified','active','assigned','recovered','closed','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_priority as enum ('low','normal','high','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.evidence_status as enum ('pending','accepted','rejected','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('invited','active','suspended','disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.shop_status as enum ('pending','approved','suspended','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum ('device','report','shop','user','system','security');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_severity as enum ('info','important','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_type as enum ('image','document','video','audio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum ('unverified','pending','verified','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.access_level as enum ('public','restricted','confidential','secret');
exception when duplicate_object then null; end $$;
