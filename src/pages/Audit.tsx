import { useApi } from '../lib/useApi';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { formatDate } from '../lib/format';

interface AuditRow {
  sequence_number: number; action: string; entity_type: string;
  entity_id: string | null; entry_hash: string; previous_hash: string | null; created_at: string;
}

export function Audit() {
  const { data, loading, error, reload } = useApi<AuditRow[]>('get-audit-logs', { limit: 200 });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>سجل التدقيق</h1>
          <p>سجل تسلسلي التجزئة (hash chain) غير قابل للحذف أو التعديل — أي عبث يكسر السلسلة.</p>
        </div>
      </div>
      <section className="card">
        <div className="card__head"><h2>آخر القيود</h2></div>
        <div className="card__body">
          {loading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} onRetry={reload} /> : null}
          {data && data.length === 0 ? <EmptyState title="السجل فارغ" description="لم تُسجَّل أي عملية بعد." /> : null}
          {data && data.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">قيود سجل التدقيق</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th><th scope="col">العملية</th><th scope="col">الكيان</th>
                    <th scope="col">بصمة القيد</th><th scope="col">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr key={r.sequence_number}>
                      <td className="mono">{r.sequence_number}</td>
                      <td>{r.action}</td>
                      <td>{r.entity_type}</td>
                      <td className="mono" title={r.entry_hash}>{r.entry_hash.slice(0, 16)}…</td>
                      <td>{formatDate(r.created_at)}</td>
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
