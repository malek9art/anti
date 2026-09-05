import { useState, type FormEvent } from 'react';
import { useApi } from '../lib/useApi';
import { callFunction, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { SHOP_STATUS_AR, formatDate } from '../lib/format';

interface Shop { id: string; name_ar: string; license_number: string; owner_name: string; status: string; created_at: string }

export function Shops() {
  const { can } = useAuth();
  const list = useApi<Shop[]>('get-shops', {});
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: string, body: Record<string, unknown>, success: string) {
    setBusy(true); setError(null); setMsg(null);
    try { await callFunction(fn, body); setMsg(success); list.reload(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>المحلات</h1>
          <p>طلبات الاعتماد وحالة المحلات المرتبطة بالمنصة.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn--gold" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'إغلاق' : '➕ طلب اعتماد محل'}
          </button>
        </div>
      </div>

      {msg ? <div className="alert alert--ok" role="status">{msg}</div> : null}
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {showForm ? <ShopForm onDone={() => { setShowForm(false); list.reload(); }} /> : null}

      <section className="card">
        <div className="card__head"><h2>قائمة المحلات</h2></div>
        <div className="card__body">
          {list.loading ? <LoadingState /> : null}
          {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}
          {list.data && list.data.length === 0 ? <EmptyState title="لا توجد محلات" description="لم تُقدَّم طلبات اعتماد بعد." /> : null}
          {list.data && list.data.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">قائمة المحلات</caption>
                <thead>
                  <tr>
                    <th scope="col">اسم المحل</th><th scope="col">رقم الرخصة</th><th scope="col">المالك</th>
                    <th scope="col">الحالة</th><th scope="col">تاريخ التقديم</th><th scope="col">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name_ar}</td>
                      <td className="mono">{s.license_number}</td>
                      <td>{s.owner_name}</td>
                      <td>
                        <span className={`badge ${s.status === 'approved' ? 'badge--ok' : s.status === 'suspended' ? 'badge--danger' : 'badge--warn'}`}>
                          {SHOP_STATUS_AR[s.status] ?? s.status}
                        </span>
                      </td>
                      <td>{formatDate(s.created_at)}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        {can('approve_shop') && s.status !== 'approved' ? (
                          <button type="button" className="btn btn--sm" disabled={busy}
                            onClick={() => void act('approve-shop', { shop_id: s.id }, 'تم اعتماد المحل')}>اعتماد</button>
                        ) : null}
                        {can('suspend_shop') && s.status === 'approved' ? (
                          <button type="button" className="btn btn--sm btn--danger" disabled={busy}
                            onClick={() => void act('suspend-shop', { shop_id: s.id, reason: 'تعليق إداري' }, 'تم تعليق المحل')}>تعليق</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function ShopForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: '', license: '', owner: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await callFunction('submit-shop', form); onDone(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card__head"><h2>طلب اعتماد محل</h2></div>
      <div className="card__body">
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        <form onSubmit={submit} noValidate>
          <div className="row">
            <div className="field"><label htmlFor="sh-n">اسم المحل</label>
              <input id="sh-n" value={form.name} onChange={set('name')} required /></div>
            <div className="field"><label htmlFor="sh-l">رقم الرخصة</label>
              <input id="sh-l" dir="ltr" value={form.license} onChange={set('license')} required /></div>
            <div className="field"><label htmlFor="sh-o">اسم المالك</label>
              <input id="sh-o" value={form.owner} onChange={set('owner')} required /></div>
            <div className="field"><label htmlFor="sh-p">رقم التواصل</label>
              <input id="sh-p" dir="ltr" value={form.phone} onChange={set('phone')} required /></div>
          </div>
          <div className="field"><label htmlFor="sh-a">العنوان</label>
            <input id="sh-a" value={form.address} onChange={set('address')} /></div>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'تقديم الطلب'}</button>
        </form>
      </div>
    </section>
  );
}
