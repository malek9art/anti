import { useState, type FormEvent } from 'react';
import { callFunction, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MfaRequiredState } from '../components/States';
import { BrandingManager } from '../components/BrandingManager';

const KNOWN = [
  { key: 'mfa_required_for_sensitive', label: 'اشتراط AAL2 للعمليات الحساسة', hint: 'true أو false' },
  { key: 'rate_limit_per_minute', label: 'حد الطلبات في الدقيقة', hint: 'رقم صحيح مثل 60' },
  { key: 'platform_name', label: 'اسم المنصة', hint: 'نص بين علامتي تنصيص مزدوجة' },
];

export function Settings() {
  const { isAal2 } = useAuth();
  const [key, setKey] = useState(KNOWN[0].key);
  const [value, setValue] = useState('true');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(value); }
      catch { throw new Error('القيمة يجب أن تكون JSON صالحًا (مثال: true أو 60 أو "نص")'); }
      await callFunction('update-system-setting', { key, value: parsed });
      setMsg('تم حفظ الإعداد بنجاح.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
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

      {!isAal2 ? <MfaRequiredState /> : null}
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
        </div>
      </section>
    </>
  );
}
