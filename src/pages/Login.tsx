import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { callFunction } from '../lib/api';
import { Logo } from '../components/Logo';
import { APP_FULL_NAME } from '../lib/config';

type Tab = 'signin' | 'signup';

/** الأدوار المتاحة للتسجيل الذاتي — بقية الأدوار تُنشأ من الإدارة فقط */
const SELF_ROLES: Array<{ code: string; icon: string; title: string; desc: string }> = [
  { code: 'shop_manager', icon: '🏪', title: 'مدير محل', desc: 'تسجيل الأجهزة والمبيعات واستلام الصيانة لمحلك' },
  { code: 'technician', icon: '🛠️', title: 'فني صيانة', desc: 'فحص الأجهزة وتنفيذ الصيانة والفرمتة' },
  { code: 'delegate', icon: '🧭', title: 'مندوب ميداني', desc: 'متابعة المهام الميدانية والبلاغات المحالة' },
];

const PAYLOAD_LABELS: Record<string, string> = {
  shop_name: 'اسم المحل', shop_address: 'عنوان المحل', commercial_register: 'رقم السجل التجاري',
  workplace: 'اسم المحل الذي تعمل لديه', agency: 'اسم الجهة / الوكالة',
};

export function Login() {
  const [tab, setTab] = useState<Tab>('signin');
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submitSignin(e: FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw new Error(mapAuthError(err.message));
      void callFunction('ingest-auth-event', { event: 'login_success' }).catch(() => undefined);
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : 'تعذّر تسجيل الدخول';
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

        {tab === 'signin' ? (
          <>
            {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
            {notice ? <div className="alert alert--ok" role="status">{notice}</div> : null}
            <form onSubmit={submitSignin} noValidate>
              <div className="field">
                <label htmlFor="email">البريد الإلكتروني</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email" dir="ltr" required />
              </div>
              <div className="field">
                <label htmlFor="password">كلمة المرور</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" required />
              </div>
              <button type="submit" className="btn btn--block" disabled={busy}>
                {busy ? 'جارٍ المعالجة…' : 'دخول'}
              </button>
              <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }}
                onClick={() => { setForgot(true); setError(null); setNotice(null); }}>
                نسيت كلمة المرور؟
              </button>
            </form>
          </>
        ) : (
          <SignupWizard onDone={(msg) => { setTab('signin'); setNotice(msg); }} />
        )}

        <p className="auth-foot">
          العمليات الحساسة تتطلب مصادقة ثنائية (TOTP). جميع الأنشطة مسجَّلة في سجل تدقيق غير قابل للعبث.
        </p>
      </div>
    </div>
  );
}

/** معالج إنشاء الحساب: الدور ← البيانات ← كلمة المرور ← طلب التفعيل */
function SignupWizard({ onDone }: { onDone: (msg: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleFields: Record<string, string[]> = {
    shop_manager: ['shop_name', 'shop_address', 'commercial_register'],
    technician: ['workplace'],
    delegate: ['agency'],
  };
  const fields = roleFields[role] ?? [];

  function validateStep2(): string | null {
    if (fullName.trim().length < 3) return 'الاسم الكامل مطلوب (3 أحرف على الأقل)';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'بريد إلكتروني غير صالح';
    if (phone.trim() && phone.trim().length < 8) return 'رقم الهاتف غير مكتمل';
    for (const f of fields) {
      if (!(payload[f] ?? '').trim()) return `${PAYLOAD_LABELS[f]} مطلوب`;
    }
    return null;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) { setError('كلمة المرور يجب أن تكون 10 أحرف على الأقل'); return; }
    if (password !== confirm) { setError('تأكيد كلمة المرور غير مطابق'); return; }
    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(), password, options: { data: { full_name: fullName.trim() } },
      });
      if (err) throw new Error(mapAuthError(err.message));
      if (!data.user) throw new Error('تعذّر إنشاء الحساب، حاول مجددًا');
      const cleanPayload: Record<string, string> = {};
      for (const f of fields) cleanPayload[f] = payload[f].trim();
      await callFunction('submit-signup-request', {
        user_id: data.user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role,
        payload: cleanPayload,
      });
      await supabase.auth.signOut().catch(() => undefined);
      onDone('✅ تم إرسال طلب التفعيل بنجاح. ستراجعه الإدارة، وبعد الموافقة يمكنك تسجيل الدخول ببريدك وكلمة مرورك.');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'تعذّر إرسال الطلب');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <div className="steps" aria-label={`الخطوة ${step} من 3`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`steps__dot${step === n ? ' steps__dot--active' : ''}`} />
        ))}
      </div>

      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}

      {step === 1 ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>١) اختر دورك في المنصة</legend>
          <div className="role-grid">
            {SELF_ROLES.map((r) => (
              <button key={r.code} type="button"
                className={`role-card${role === r.code ? ' role-card--active' : ''}`}
                onClick={() => { setRole(r.code); setPayload({}); setError(null); }}
                aria-pressed={role === r.code}>
                <span className="role-card__icon" aria-hidden>{r.icon}</span>
                <span className="role-card__title">{r.title}</span>
                <span className="role-card__desc">{r.desc}</span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
            حسابات الضباط ومدير النظام والمدقق تُنشأ من الإدارة مباشرةً.
          </p>
          <button type="button" className="btn btn--block" disabled={!role}
            onClick={() => setStep(2)}>متابعة</button>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>٢) بياناتك ({SELF_ROLES.find((r) => r.code === role)?.title})</p>
          <div className="field">
            <label htmlFor="su-name">الاسم الكامل</label>
            <input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)}
              autoComplete="name" required />
          </div>
          <div className="field">
            <label htmlFor="su-email">البريد الإلكتروني</label>
            <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" dir="ltr" required />
          </div>
          <div className="field">
            <label htmlFor="su-phone">رقم الهاتف (اختياري)</label>
            <input id="su-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel" dir="ltr" />
          </div>
          {fields.map((f) => (
            <div className="field" key={f}>
              <label htmlFor={`su-${f}`}>{PAYLOAD_LABELS[f]}</label>
              <input id={`su-${f}`} value={payload[f] ?? ''} autoComplete="off" required
                onChange={(e) => setPayload((p) => ({ ...p, [f]: e.target.value }))} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>رجوع</button>
            <button type="button" className="btn" style={{ flex: 1 }} onClick={() => {
              const err = validateStep2();
              if (err) { setError(err); return; }
              setError(null); setStep(3);
            }}>متابعة</button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>٣) كلمة المرور ثم إرسال الطلب</p>
          <div className="field">
            <label htmlFor="su-pass">كلمة المرور</label>
            <input id="su-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password" required />
            <div className="hint">10 أحرف على الأقل، ويفضّل مزيج أحرف وأرقام ورموز.</div>
          </div>
          <div className="field">
            <label htmlFor="su-pass2">تأكيد كلمة المرور</label>
            <input id="su-pass2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password" required />
          </div>
          <div className="alert alert--warn" role="note" style={{ fontSize: 13 }}>
            بعد الإرسال يبقى حسابك بانتظار موافقة الإدارة، ولن تتمكن من الدخول قبل الموافقة.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setStep(2)}>رجوع</button>
            <button type="submit" className="btn btn--gold" style={{ flex: 1 }} disabled={busy}>
              {busy ? 'جارٍ الإرسال…' : 'إرسال طلب التفعيل'}
            </button>
          </div>
        </>
      ) : null}
    </form>
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
