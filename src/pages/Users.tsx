import { useState } from 'react';
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
