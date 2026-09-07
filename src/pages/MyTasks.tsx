import { useState } from 'react';
import { useApi } from '../lib/useApi';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { ReportDetail } from './Reports';
import { useAuth } from '../context/AuthContext';
import { REPORT_STATUS_AR, PRIORITY_AR, formatDate } from '../lib/format';

interface TaskRow {
  id: string; report_number: string; status: string; priority: string;
  imei_masked: string; incident_at: string; incident_location?: string | null;
  assigned_at?: string | null;
}

function badgeFor(status: string): string {
  if (['active', 'assigned', 'verified'].includes(status)) return 'badge--danger';
  if (status === 'recovered') return 'badge--ok';
  if (status === 'closed' || status === 'rejected') return 'badge--info';
  return 'badge--warn';
}

/** شاشة «مهامي» للمندوب: البلاغات المُحالة إليه مع المتابعة ورفع الأدلة */
export function MyTasks() {
  const { profile } = useAuth();
  const list = useApi<TaskRow[]>('get-my-tasks', { limit: 50 });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>مهامي</h1>
          <p>البلاغات المُحالة إليك للمتابعة. حدّث حالتها، أضف متابعات، وارفُع الأدلة — وسجَّل كل ذلك في سجل التدقيق.</p>
        </div>
      </div>

      {openId ? (
        <ReportDetail
          id={openId}
          onChanged={list.reload}
          onClose={() => setOpenId(null)}
        />
      ) : null}

      <section className="card">
        <div className="card__head">
          <h2>البلاغات المُحالة ({profile?.full_name ? `إلى ${profile.full_name}` : 'إليك'})</h2>
        </div>
        <div className="card__body">
          {list.loading ? <LoadingState label="جارٍ تحميل مهامك…" /> : null}
          {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}
          {list.data && list.data.length === 0 ? (
            <EmptyState
              title="لا توجد مهام مُحالة"
              description="لا توجد بلاغات مُحالة إليك حاليًا. ستظهر هنا عندما يُحوَّل إليك بلاغ للمتابعة."
            />
          ) : null}
          {list.data && list.data.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">البلاغات المحالة إليك</caption>
                <thead>
                  <tr>
                    <th scope="col">رقم البلاغ</th><th scope="col">IMEI</th><th scope="col">الحالة</th>
                    <th scope="col">الأولوية</th><th scope="col">مكان الواقعة</th>
                    <th scope="col">تاريخ الإحالة</th><th scope="col">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.report_number}</td>
                      <td className="mono">{r.imei_masked}</td>
                      <td><span className={`badge ${badgeFor(r.status)}`}>{REPORT_STATUS_AR[r.status] ?? r.status}</span></td>
                      <td>{PRIORITY_AR[r.priority] ?? r.priority}</td>
                      <td>{r.incident_location ?? '—'}</td>
                      <td>{formatDate(r.assigned_at ?? r.incident_at)}</td>
                      <td>
                        <button type="button" className="btn btn--ghost btn--sm"
                          onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                          {openId === r.id ? 'إغلاق' : 'فتح المتابعة'}
                        </button>
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
