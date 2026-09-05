const runtime = typeof window !== 'undefined' ? window.__HIMAYA_CONFIG__ : undefined;

export const SUPABASE_URL = runtime?.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = runtime?.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const ROUTER_MODE = (import.meta.env.VITE_ROUTER_MODE as string) || 'hash';
export const APP_NAME = 'حماية';
export const APP_FULL_NAME = 'حماية | نظام مكافحة سرقة الأجهزة';

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
