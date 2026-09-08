import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { callFunction, errorMessage } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { MfaRequiredState } from '../components/States';
import { BrandingManager } from '../components/BrandingManager';

const KNOWN = [
  { key: 'mfa_required_for_sensitive', label: 'اشتراط AAL2 للعمليات الحساسة', hint: 'true أو false' },
  { key: 'rate_limit_per_minute', label: 'حد الطلبات في الدقيقة', hint: 'رقم صحيح مثل 60' },
  { key: 'platform_name', label: 'اسم المنصة', hint: 'نص بين علامتي تنصيص مزدوجة' },
];

export function Settings() {
  const { isAal2, refresh } = useAuth();
  const [key, setKey] = useState(KNOWN[0].key);
  const [value, setValue] = useState('true');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // رفع الجلسة إلى AAL2 داخل الصفحة عند الحاجة
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [hasFactor, setHasFactor] = useState(true);
  const pending = useRef<{ key: string; value: unknown } | null>(null);

  async function saveSetting(k: string, v: unknown) {
    await callFunction('update-system-setting', { key: k, value: v });
    setMsg('تم حفظ الإعداد بنجاح.');
  }

  async function verifyMfa() {
    setBusy(true); setError(null);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = (data?.totp ?? []).find((f) => f.status === 'verified');
      if (!factor) { setHasFactor(false); return; }
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (cErr) throw new Error(cErr.message);
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: factor.id, challengeId: ch.id, code: mfaCode.trim(),
      });
      if (vErr) throw new Error('رمز التحقق غير صحيح أو منتهي، أدخل الرمز الحالي من تطبيق المصادقة');
      setNeedsMfa(false); setMfaCode('');
      await refresh();
      const p = pending.current;
      pending.current = null;
      if (p) await saveSetting(p.key, p.value);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(value); }
      catch { throw new Error('القيمة يجب أن تكون JSON صالحًا (مثال: true أو 60 أو "نص")'); }
      try {
        await saveSetting(key, parsed);
      } catch (e2) {
        if (errorMessage(e2).includes('المصادقة الثنائية')) {
          pending.current = { key, value: parsed };
          const { data } = await supabase.auth.mfa.listFactors();
          setHasFactor((data?.totp ?? []).some((f) => f.status === 'verified'));
          setNeedsMfa(true);
        } else {
          throw e2;
        }
      }
    } catch (e3) { setError(errorMessage(e3)); } finally { setBusy(false); }
  }

  const current = KNOWN.find((k) => k.key === key);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>إعدادات النظام</h1>
          <p>كل تغيير يُسجَّل في سجل التدقيق ويتطلب مصادقة ثنائية.</p>
        </div>
      </div>

      {!isAal2 && !needsMfa ? <MfaRequiredState /> : null}
      {msg ? <div className="alert alert--ok" role="status">{msg}</div> : null}
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}

      <div style={{ marginBottom: 16 }}>
        <BrandingManager />
      </div>

      <section className="card" style={{ maxWidth: 560 }}>
        <div className="card__body">
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="set-key">الإعداد</label>
              <select id="set-key" value={key} onChange={(e) => setKey(e.target.value)}>
                {KNOWN.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="set-val">القيمة (JSON)</label>
              <input id="set-val" dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} required />
              <div className="hint">{current?.hint}</div>
            </div>
            <button type="submit" className="btn" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ الإعداد'}</button>
          </form>

          {needsMfa ? (
            <div className="alert alert--warn" style={{ marginTop: 14, marginBottom: 0 }} role="alert">
              {hasFactor ? (
                <>
                  <strong>خطوة أمان مطلوبة:</strong> أدخل رمز التحقق الحالي من تطبيق المصادقة لإتمام الحفظ.
                  <div className="field" style={{ marginTop: 10, maxWidth: 260 }}>
                    <label htmlFor="set-mfa-code">رمز التحقق</label>
                    <input id="set-mfa-code" className="mono" inputMode="numeric" maxLength={6}
                      value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} autoComplete="one-time-code" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn--sm" disabled={busy || mfaCode.trim().length !== 6}
                      onClick={() => void verifyMfa()}>
                      {busy ? 'جارٍ التحقق…' : 'تحقق وأكمل الحفظ'}
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" disabled={busy}
                      onClick={() => { setNeedsMfa(false); setMfaCode(''); pending.current = null; }}>
                      إلغاء
                    </button>
                  </div>
                </>
              ) : (
                <>
                  لم تُفعّل المصادقة الثنائية بعد. فعّلها أولًا من{' '}
                  <Link to="/account">صفحة الأمان</Link> ثم أعد المحاولة.
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
