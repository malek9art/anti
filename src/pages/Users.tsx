import { useState, type FormEvent } from 'react';
import { useApi } from '../lib/useApi';
import { callFunction, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { ACCOUNT_STATUS_AR, ROLE_AR, formatDate } from '../lib/format';

interface UserRow {
  id: string; full_name: string; email: string; status: string;
  mfa_enrolled: boolean; roles: string[]; created_at: string;
}

export function Users() {
  const { can } = useAuth();
  const list = useApi<UserRow[]>('get-users', { limit: 100 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);

  async function act(fn: string, body: Record<string, unknown>, success: string) {
    setBusy(true); setError(null); setMsg(null);
    try { await callFunction(fn, body); setMsg(success); list.reload(); setEditing(null); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>المستخدمون</h1>
          <p>تفعيل الحسابات وإسناد الأدوار. الصلاحيات تُفرض خادميًا دائمًا.</p>
        </div>
      </div>

      {msg ? <div className="alert alert--ok" role="status">{msg}</div> : null}
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}

      <CreateUserCard busy={busy} onCreate={async (payload) => {
        await act('create-user', payload, 'تم إنشاء المستخدم وتفعيله بنجاح');
      }} />

      <section className="card">
        <div className="card__head"><h2>قائمة المستخدمين</h2></div>
        <div className="card__body">
          {list.loading ? <LoadingState /> : null}
          {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}
          {list.data && list.data.length === 0 ? <EmptyState title="لا يوجد مستخدمون" /> : null}
          {list.data && list.data.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">قائمة المستخدمين</caption>
                <thead>
                  <tr>
                    <th scope="col">الاسم</th><th scope="col">البريد</th><th scope="col">الأدوار</th>
                    <th scope="col">الحالة</th><th scope="col">MFA</th>
                    <th scope="col">الإنشاء</th><th scope="col">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((u) => (
                    <tr key={u.id}>
                      <td>{u.full_name}</td>
                      <td dir="ltr" style={{ textAlign: 'right' }}>{u.email}</td>
                      <td>{u.roles.length ? u.roles.map((r) => ROLE_AR[r] ?? r).join('، ') : '—'}</td>
                      <td>
                        <span className={`badge ${u.status === 'active' ? 'badge--ok' : 'badge--warn'}`}>
                          {ACCOUNT_STATUS_AR[u.status] ?? u.status}
                        </span>
                      </td>
                      <td>{u.mfa_enrolled ? '🔐' : '—'}</td>
                      <td>{formatDate(u.created_at)}</td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {can('manage_permissions') ? (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(u)}>الأدوار</button>
                        ) : null}
                        {u.status !== 'active' ? (
                          <button type="button" className="btn btn--sm" disabled={busy}
                            onClick={() => void act('update-user-status', { user_id: u.id, status: 'active' }, 'تم تفعيل الحساب')}>تفعيل</button>
                        ) : (
                          <button type="button" className="btn btn--sm btn--danger" disabled={busy}
                            onClick={() => void act('update-user-status', { user_id: u.id, status: 'suspended' }, 'تم إيقاف الحساب')}>إيقاف</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      {editing ? (
        <RoleEditor user={editing} busy={busy} onCancel={() => setEditing(null)}
          onSave={(roles) => void act('set-user-roles', { user_id: editing.id, roles }, 'تم تحديث الأدوار')} />
      ) : null}
    </>
  );
}

function CreateUserCard({ busy, onCreate }: {
  busy: boolean;
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleRole = (r: string) =>
    setRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (fullName.trim().length < 3) { setFormError('الاسم الكامل مطلوب (3 أحرف على الأقل)'); return; }
    if (!email.trim().includes('@')) { setFormError('بريد إلكتروني غير صالح'); return; }
    if (password.length < 10) { setFormError('كلمة المرور يجب أن تكون 10 أحرف على الأقل'); return; }
    if (roles.length === 0) { setFormError('اختر دورًا واحدًا على الأقل'); return; }
    await onCreate({ full_name: fullName.trim(), email: email.trim(), password, roles });
    setFullName(''); setEmail(''); setPassword(''); setRoles([]); setOpen(false);
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card__head">
        <h2>إنشاء مستخدم جديد</h2>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen((v) => !v)}
          aria-expanded={open}>
          {open ? 'إخفاء النموذج' : '➕ مستخدم جديد'}
        </button>
      </div>
      {open ? (
        <div className="card__body">
          {formError ? <div className="alert alert--error" role="alert">{formError}</div> : null}
          <form onSubmit={(e) => void submit(e)} noValidate>
            <div className="row">
              <div className="field">
                <label htmlFor="cu-name">الاسم الكامل</label>
                <input id="cu-name" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  autoComplete="off" required />
              </div>
              <div className="field">
                <label htmlFor="cu-email">البريد الإلكتروني</label>
                <input id="cu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off" dir="ltr" required />
              </div>
              <div className="field">
                <label htmlFor="cu-pass">كلمة المرور المؤقتة</label>
                <input id="cu-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password" required />
                <div className="hint">10 أحرف على الأقل — يُنصح بأن يغيّرها المستخدم بعد أول دخول.</div>
              </div>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
              <legend style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>الأدوار</legend>
              <div className="row">
                {Object.entries(ROLE_AR).map(([code, label]) => (
                  <label key={code} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" style={{ width: 18 }} checked={roles.includes(code)}
                      onChange={() => toggleRole(code)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'جارٍ الإنشاء…' : 'إنشاء وتفعيل المستخدم'}
            </button>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
              يُنشأ الحساب مفعّلًا ببريد مؤكَّد فورًا لأن الإدارة هي من أنشأه، وتُسجَّل العملية في سجل التدقيق.
            </p>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function RoleEditor({ user, busy, onSave, onCancel }: {
  user: UserRow; busy: boolean; onSave: (roles: string[]) => void; onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(user.roles);
  const toggle = (r: string) =>
    setSelected((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));

  return (
    <section className="card" style={{ marginTop: 16, maxWidth: 520 }}>
      <div className="card__head">
        <h2>أدوار: {user.full_name}</h2>
      </div>
      <div className="card__body">
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">اختيار الأدوار</legend>
          {Object.entries(ROLE_AR).map(([code, label]) => (
            <label key={code} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="checkbox" style={{ width: 18 }} checked={selected.includes(code)} onChange={() => toggle(code)} />
              {label}
            </label>
          ))}
        </fieldset>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => onSave(selected)}>حفظ</button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>إلغاء</button>
        </div>
      </div>
    </section>
  );
}
