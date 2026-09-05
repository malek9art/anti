import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { callFunction, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ROLE_AR } from '../lib/format';

export function Account() {
  const { profile, roles, permissions, isAal2, refresh, aal } = useAuth();
  const [factors, setFactors] = useState<Array<{ id: string; status: string }>>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []).map((f) => ({ id: f.id, status: f.status })));
  };
  useEffect(() => { void loadFactors(); }, []);

  async function startEnroll() {
    setBusy(true); setError(null); setMsg(null);
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `himaya-${Date.now()}` });
      if (err) throw err;
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  async function verifyEnroll(e: FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true); setError(null);
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enroll.id });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code: code.trim() });
      if (vErr) throw new Error('رمز التحقق غير صحيح');
      await callFunction('ingest-auth-event', { event: 'mfa_enrolled' }).catch(() => undefined);
      setEnroll(null); setCode(''); setMsg('تم تفعيل المصادقة الثنائية بنجاح — جلستك الآن AAL2.');
      await loadFactors(); await refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null);
    try {
      if (password.length < 10) throw new Error('كلمة المرور يجب أن تكون 10 أحرف على الأقل');
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setPassword(''); setMsg('تم تغيير كلمة المرور بنجاح.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  async function revokeOthers() {
    setBusy(true); setError(null); setMsg(null);
    try {
      await callFunction('revoke-other-sessions');
      setMsg('تم إلغاء جميع الجلسات الأخرى.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  const hasVerified = factors.some((f) => f.status === 'verified');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>حسابي والأمان</h1>
          <p>المصادقة الثنائية، كلمة المرور، والجلسات النشطة.</p>
        </div>
      </div>

      {msg ? <div className="alert alert--ok" role="status">{msg}</div> : null}
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}

      <div className="grid grid--2">
        <section className="card">
          <div className="card__head"><h2>بيانات الحساب</h2></div>
          <div className="card__body">
            <p><strong>الاسم:</strong> {profile?.full_name ?? '—'}</p>
            <p dir="auto"><strong>البريد:</strong> {profile?.email ?? '—'}</p>
            <p><strong>مستوى التوثيق:</strong> <span className={`badge ${isAal2 ? 'badge--ok' : 'badge--warn'}`}>{aal.toUpperCase()}</span></p>
            <p><strong>الأدوار:</strong> {roles.length ? roles.map((r) => ROLE_AR[r] ?? r).join('، ') : 'لا توجد'}</p>
            <p><strong>عدد الصلاحيات:</strong> {permissions.length}</p>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h2>المصادقة الثنائية (TOTP)</h2></div>
          <div className="card__body">
            {hasVerified ? (
              <div className="alert alert--ok">🔐 المصادقة الثنائية مفعّلة على هذا الحساب.</div>
            ) : (
              <>
                <div className="alert alert--warn">
                  المصادقة الثنائية غير مفعّلة. العمليات الحساسة ستُرفض خادميًا حتى تفعيلها.
                </div>
                {!enroll ? (
                  <button type="button" className="btn btn--gold" onClick={() => void startEnroll()} disabled={busy}>
                    تفعيل المصادقة الثنائية
                  </button>
                ) : (
                  <form onSubmit={verifyEnroll} noValidate>
                    <p>امسح رمز QR بتطبيق المصادقة، ثم أدخل الرمز:</p>
                    <img src={enroll.qr} alt="رمز QR لتفعيل المصادقة الثنائية" style={{ width: 190, height: 190 }} />
                    <p style={{ fontSize: 12 }} dir="ltr">{enroll.secret}</p>
                    <div className="field">
                      <label htmlFor="mfa-code">رمز التحقق</label>
                      <input id="mfa-code" className="mono" inputMode="numeric" maxLength={6} value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
                    </div>
                    <button type="submit" className="btn" disabled={busy || code.length !== 6}>تأكيد التفعيل</button>
                  </form>
                )}
              </>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h2>تغيير كلمة المرور</h2></div>
          <div className="card__body">
            <form onSubmit={changePassword} noValidate>
              <div className="field">
                <label htmlFor="new-pass">كلمة المرور الجديدة</label>
                <input id="new-pass" type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required />
                <div className="hint">10 أحرف على الأقل.</div>
              </div>
              <button type="submit" className="btn" disabled={busy}>تحديث كلمة المرور</button>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h2>الجلسات</h2></div>
          <div className="card__body">
            <p>إذا شككت في وصول غير مصرّح به، ألغِ جميع الجلسات الأخرى فورًا.</p>
            <button type="button" className="btn btn--danger" onClick={() => void revokeOthers()} disabled={busy}>
              إلغاء الجلسات الأخرى
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
