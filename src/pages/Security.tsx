import { useState } from 'react';
import { useApi } from '../lib/useApi';
import { callFunction, errorMessage } from '../lib/api';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { formatDate } from '../lib/format';

interface EventRow {
  id: string; event_type: string; severity: string;
  details: Record<string, unknown>; resolved: boolean; created_at: string;
}

const SEVERITY_AR: Record<string, string> = { info: 'معلومة', important: 'مهم', critical: 'حرج' };

export function Security() {
  const { data, loading, error, reload } = useApi<EventRow[]>('get-security-events', { limit: 200 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function resolve(id: string) {
    setBusy(true); setActionError(null); setMsg(null);
    try {
      await callFunction('resolve-security-event', { id, note: 'تمت المعالجة' });
      setMsg('تم إغلاق الحدث الأمني'); reload();
    } catch (e) { setActionError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>الأحداث الأمنية</h1>
          <p>محاولات الوصول المرفوضة، عمليات على أجهزة مبلّغ عنها، وأحداث المصادقة.</p>
        </div>
      </div>

      {msg ? <div className="alert alert--ok" role="status">{msg}</div> : null}
      {actionError ? <div className="alert alert--error" role="alert">{actionError}</div> : null}

      <section className="card">
        <div className="card__head"><h2>الأحداث</h2></div>
        <div className="card__body">
          {loading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} onRetry={reload} /> : null}
          {data && data.length === 0 ? <EmptyState title="لا توجد أحداث أمنية" description="لم يُسجَّل أي حدث حتى الآن." /> : null}
          {data && data.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">الأحداث الأمنية</caption>
                <thead>
                  <tr>
                    <th scope="col">نوع الحدث</th><th scope="col">الخطورة</th>
                    <th scope="col">الحالة</th><th scope="col">التاريخ</th><th scope="col">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((e) => (
                    <tr key={e.id}>
                      <td>{e.event_type}</td>
                      <td>
                        <span className={`badge ${e.severity === 'critical' ? 'badge--danger' : e.severity === 'important' ? 'badge--warn' : 'badge--info'}`}>
                          {SEVERITY_AR[e.severity] ?? e.severity}
                        </span>
                      </td>
                      <td>{e.resolved ? 'مغلق' : 'مفتوح'}</td>
                      <td>{formatDate(e.created_at)}</td>
                      <td>
                        {!e.resolved ? (
                          <button type="button" className="btn btn--ghost btn--sm" disabled={busy}
                            onClick={() => void resolve(e.id)}>إغلاق</button>
                        ) : '—'}
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
