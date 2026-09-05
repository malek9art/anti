import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { callFunction } from '../lib/api';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  status: string;
  mfa_enrolled: boolean;
}

interface BootstrapResult {
  registered: boolean;
  user?: Profile;
  roles?: string[];
  permissions?: string[];
}

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  permissions: string[];
  aal: string;
  loading: boolean;
  error: string | null;
  registered: boolean;
  can: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  isAal2: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [aal, setAal] = useState('aal1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (current: Session | null) => {
    if (!current) {
      setProfile(null); setRoles([]); setPermissions([]); setRegistered(false);
      setAal('aal1'); setLoading(false); return;
    }
    try {
      setError(null);
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setAal(data?.currentLevel ?? 'aal1');
      const result = await callFunction<BootstrapResult>('bootstrap');
      if (!mounted.current) return;
      setRegistered(Boolean(result?.registered));
      setProfile(result?.user ?? null);
      setRoles(result?.roles ?? []);
      setPermissions(result?.permissions ?? []);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'تعذّر تحميل بيانات الحساب');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void load(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(true);
      void load(next);
    });
    return () => { mounted.current = false; sub.subscription.unsubscribe(); };
  }, [load]);

  const value = useMemo<AuthValue>(() => ({
    session, profile, roles, permissions, aal, loading, error, registered,
    can: (p: string) => permissions.includes(p),
    hasRole: (r: string) => roles.includes(r),
    isAal2: aal === 'aal2',
    refresh: async () => { const { data } = await supabase.auth.getSession(); await load(data.session); },
    signOut: async () => { await supabase.auth.signOut(); },
  }), [session, profile, roles, permissions, aal, loading, error, registered, load]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider');
  return ctx;
}
