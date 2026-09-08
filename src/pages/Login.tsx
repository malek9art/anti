import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { callFunction } from '../lib/api';
import { Logo } from '../components/Logo';
import { APP_FULL_NAME } from '../lib/config';

type Tab = 'signin' | 'signup';

export function Login() {
  const [tab, setTab] = useState<Tab>('signin');
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      if (tab === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw new Error(mapAuthError(err.message));
        void callFunction('ingest-auth-event', { event: 'login_success' }).catch(() => undefined);
      } else {
        if (fullName.trim().length < 3) throw new Error('الاسم الكامل مطلوب (3 أحرف على الأقل)');
        if (password.length < 10) throw new Error('كلمة المرور يجب أن تكون 10 أحرف على الأقل');
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(), password, options: { data: { full_name: fullName.trim() } },
        });
        if (err) throw new Error(mapAuthError(err.message));
        setNotice('تم إنشاء الحساب. راجع بريدك للتأكيد إن لزم، ثم اطلب من مدير النظام تفعيل حسابك وإسناد الأدوار.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذّر تسجيل الدخول';
      setError(msg);
      void callFunction('ingest-auth-event', { event: 'login_failed', details: { reason: msg } }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(e: FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (err) throw new Error(mapAuthError(err.message));
      setNotice('إن كان البريد مسجلًا لدينا فستصلك رسالة تحتوي رابط إعادة التعيين. تحقق من بريدك.');
      setForgot(false);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'تعذّر إرسال رابط الاستعادة');
    } finally {
      setBusy(false);
    }
  }

  if (forgot) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card__brand">
            <Logo size={92} />
            <h1>{APP_FULL_NAME}</h1>
            <p>استعادة كلمة المرور</p>
            <div className="auth-card__rule" />
          </div>

          {error ? <div className="alert alert--error" role="alert">{error}</div> : null}

          <form onSubmit={submitForgot} noValidate>
            <div className="field">
              <label htmlFor="forgotEmail">البريد الإلكتروني</label>
              <input id="forgotEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" dir="ltr" required />
              <div className="hint">سنرسل لك رابطًا آمنًا لتعيين كلمة مرور جديدة.</div>
            </div>
            <button type="submit" className="btn btn--block" disabled={busy}>
              {busy ? 'جارٍ الإرسال…' : 'إرسال رابط الاستعادة'}
            </button>
            <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }}
              onClick={() => { setForgot(false); setError(null); }}>
              العودة لتسجيل الدخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <Logo size={92} />
          <h1>{APP_FULL_NAME}</h1>
          <p>منصة رسمية لإدارة دورة حياة الأجهزة ومكافحة سرقتها</p>
          <div className="auth-card__rule" />
        </div>

        <div className="auth-tabs" role="tablist" aria-label="نوع العملية">
          <button type="button" role="tab" aria-selected={tab === 'signin'} onClick={() => setTab('signin')}>
            تسجيل الدخول
          </button>
          <button type="button" role="tab" aria-selected={tab === 'signup'} onClick={() => setTab('signup')}>
            حساب جديد
          </button>
        </div>

        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        {notice ? <div className="alert alert--ok" role="status">{notice}</div> : null}

        <form onSubmit={submit} noValidate>
          {tab === 'signup' ? (
            <div className="field">
              <label htmlFor="fullName">الاسم الكامل</label>
              <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)}
                autoComplete="name" required />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="email">البريد الإلكتروني</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" dir="ltr" required />
          </div>

          <div className="field">
            <label htmlFor="password">كلمة المرور</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} required />
            {tab === 'signup' ? <div className="hint">10 أحرف على الأقل، ويفضّل مزيج أحرف وأرقام ورموز.</div> : null}
          </div>

          <button type="submit" className="btn btn--block" disabled={busy}>
            {busy ? 'جارٍ المعالجة…' : tab === 'signin' ? 'دخول' : 'إنشاء الحساب'}
          </button>
          {tab === 'signin' ? (
            <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }}
              onClick={() => { setForgot(true); setError(null); setNotice(null); }}>
              نسيت كلمة المرور؟
            </button>
          ) : null}
        </form>

        <p className="auth-foot">
          العمليات الحساسة تتطلب مصادقة ثنائية (TOTP). جميع الأنشطة مسجَّلة في سجل تدقيق غير قابل للعبث.
        </p>
      </div>
    </div>
  );
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'بيانات الدخول غير صحيحة';
  if (m.includes('email not confirmed')) return 'لم يتم تأكيد البريد الإلكتروني بعد';
  if (m.includes('already registered')) return 'هذا البريد مسجّل مسبقًا';
  if (m.includes('rate limit')) return 'عدد كبير من المحاولات، حاول لاحقًا';
  return message;
}
