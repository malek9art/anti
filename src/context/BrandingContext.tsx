import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { callFunction } from '../lib/api';
import { SUPABASE_URL } from '../lib/config';

const FALLBACK_LOGO = `${import.meta.env.BASE_URL}logo.png`;

export interface Branding {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  isCustom: boolean;
  reload: () => void;
}

interface BrandingPayload {
  logo_path: string;
  logo_version: string;
  primary_color: string;
  accent_color: string;
}

const BrandingContext = createContext<Branding | null>(null);

export function buildLogoUrl(path: string, version: string): string {
  if (!path) return FALLBACK_LOGO;
  // دلو branding عام، لذا يمكن بناء رابط مباشر مع كسر التخزين المؤقت
  return `${SUPABASE_URL}/storage/v1/object/public/branding/${path}?v=${version}`;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<BrandingPayload | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    callFunction<BrandingPayload>('get-branding')
      .then((res) => { if (alive) setPayload(res); })
      .catch(() => { if (alive) setPayload(null); });
    return () => { alive = false; };
  }, [tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo<Branding>(() => {
    const path = payload?.logo_path ?? '';
    return {
      logoUrl: buildLogoUrl(path, payload?.logo_version ?? '0'),
      primaryColor: payload?.primary_color || '#0B3D2E',
      accentColor: payload?.accent_color || '#C9A24D',
      isCustom: Boolean(path),
      reload,
    };
  }, [payload, reload]);

  useEffect(() => {
    document.documentElement.style.setProperty('--green-800', value.primaryColor);
    document.documentElement.style.setProperty('--gold-500', value.accentColor);
  }, [value.primaryColor, value.accentColor]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): Branding {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      logoUrl: FALLBACK_LOGO, primaryColor: '#0B3D2E', accentColor: '#C9A24D',
      isCustom: false, reload: () => undefined,
    };
  }
  return ctx;
}
