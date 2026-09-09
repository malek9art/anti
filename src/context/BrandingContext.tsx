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
  // رابط مطلق (مثل Edge Function) يُستخدم كما هو مع كسر التخزين المؤقت
  if (/^https?:\/\//i.test(path)) {
    return `${path}${path.includes('?') ? '&' : '?'}v=${version}`;
  }
  // دلو branding عام، لذا يمكن بناء رابط مباشر مع كسر التخزين المؤقت
  return `${SUPABASE_URL}/storage/v1/object/public/branding/${path}?v=${version}`;
}
