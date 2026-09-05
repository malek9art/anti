import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';

/** شاشة تحدي MFA — تظهر عند وجود عامل TOTP مُفعّل والجلسة ما زالت AAL1 */
export function MfaChallenge() {
  const { refresh, signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find((f) => f.status === 'verified');
      setFactorId(verified?.id ?? null);
    });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true); setError(null);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId, challengeId: challenge.id, code: code.trim(),
      });
      if (vErr) throw new Error('رمز التحقق غير صحيح أو منتهي الصلاحية');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل التحقق');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <Logo size={80} />
          <h1>التحقق بخطوتين</h1>
          <p>أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة</p>
          <div className="auth-card__rule" />
        </div>
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="code">رمز التحقق (TOTP)</label>
            <input id="code" className="mono" inputMode="numeric" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required />
          </div>
          <button type="submit" className="btn btn--block" disabled={busy || code.length !== 6}>
            {busy ? 'جارٍ التحقق…' : 'تحقّق'}
          </button>
        </form>
        <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 10 }}
          onClick={() => void signOut()}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
