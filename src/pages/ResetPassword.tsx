import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Logo';
import { APP_FULL_NAME } from '../lib/config';

/** تظهر عند وصول المستخدم عبر رابط استعادة كلمة المرور (حدث PASSWORD_RECOVERY) */
export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null);
    if (password.length < 10) { setError('كلمة المرور يجب أن تكون 10 أحرف على الأقل'); return; }
    if (password !== confirm) { setError('تأكيد كلمة المرور غير مطابق'); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setNotice('تم تحديث كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.');
      await supabase.auth.signOut();
      setTimeout(onDone, 1800);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'تعذّر تحديث كلمة المرور');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <Logo size={92} />
          <h1>{APP_FULL_NAME}</h1>
          <p>تعيين كلمة مرور جديدة</p>
          <div className="auth-card__rule" />
        </div>

        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        {notice ? <div className="alert alert--ok" role="status">{notice}</div> : null}

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="newPass">كلمة المرور الجديدة</label>
            <input id="newPass" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            <div className="hint">10 أحرف على الأقل، ويفضّل مزيج أحرف وأرقام ورموز.</div>
          </div>
          <div className="field">
            <label htmlFor="confirmPass">تأكيد كلمة المرور</label>
            <input id="confirmPass" type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>
          <button type="submit" className="btn btn--block" disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور الجديدة'}
          </button>
        </form>
      </div>
    </div>
  );
}
