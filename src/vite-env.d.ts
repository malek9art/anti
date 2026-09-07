/// <reference types="vite/client" />

interface HimayaConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

interface Window {
  __HIMAYA_CONFIG__?: HimayaConfig;
  __HIMAYA_BOOTED__?: boolean;
}
