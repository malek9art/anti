import { useState, type FormEvent } from 'react';
import { callFunction, errorMessage } from '../lib/api';
import { LoadingState } from '../components/States';
import { Logo } from '../components/Logo';
import { formatNumber, formatMoney, SHOP_STATUS_AR } from '../lib/format';

const KINDS: Record<string, string> = {
  sales: 'المبيعات', repairs: 'الصيانة', formats: 'الفرمتة', reports: 'البلاغات',
  compliance: 'امتثال المحلات',
};

interface Result { kind: string; from: string; to: string; data: Record<string, number> }

interface ComplianceRow {
  shop_id: string; name_ar: string; license_number: string; status: string;
  sales: number; repairs: number; formats: number;
}

const LABELS: Record<string, string> = {
  count: 'عدد العمليات', total: 'إجمالي المبالغ', total_cost: 'إجمالي التكلفة',
  recovered: 'المستردة', active: 'النشطة',
};

export function Analytics() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [kind, setKind] = useState('sales');
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [compliance, setCompliance] = useState<ComplianceRow[] | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null); setCompliance(null);
    try {
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(`${to}T23:59:59`).toISOString();
      if (kind === 'compliance') {
        setCompliance(await callFunction<ComplianceRow[]>('get-shop-compliance', { from: fromIso, to: toIso }));
      } else {
        setResult(await callFunction<Result>('generate-report', { kind, from: fromIso, to: toIso }));
      }
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  function exportCsv() {
    if (!result) return;
    const rows = [['المؤشر', 'القيمة'], ...Object.entries(result.data).map(([k, v]) => [LABELS[k] ?? k, String(v)])];
    const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `himaya-${result.kind}-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>التقارير</h1>
          <p>ملخصات ضمن حدود صلاحياتك، قابلة للتصدير والطباعة بترويسة رسمية.</p>
        </div>
        {result ? (
          <div className="page-head__actions">
            <button type="button" className="btn btn--ghost" onClick={exportCsv}>⬇️ تصدير CSV</button>
            <button type="button" className="btn btn--gold" onClick={() => window.print()}>🖨️ طباعة / PDF</button>
          </div>
        ) : null}
      </div>

      <section className="card" style={{ marginBottom: 16, maxWidth: 700 }}>
        <div className="card__body">
          <form onSubmit={submit} noValidate>
            <div className="row">
              <div className="field">
                <label htmlFor="a-kind">نوع التقرير</label>
                <select id="a-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="a-from">من تاريخ</label>
                <input id="a-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="a-to">إلى تاريخ</label>
                <input id="a-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="btn" disabled={busy}>{busy ? 'جارٍ التوليد…' : 'توليد التقرير'}</button>
          </form>
        </div>
      </section>

      {busy ? <LoadingState label="جارٍ توليد التقرير…" /> : null}
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}

      {result ? (
        <section className="card">
          <div className="card__head">
            <Logo size={30} />
            <h2>تقرير {KINDS[result.kind]} — {from} إلى {to}</h2>
          </div>
          <div className="card__body">
            <div className="grid grid--stats">
              {Object.entries(result.data).map(([k, v]) => (
                <div key={k} className="stat stat--gold">
                  <p className="stat__label">{LABELS[k] ?? k}</p>
                  <div className="stat__value">
                    {k.includes('total') && k !== 'total_count' ? formatMoney(v) : formatNumber(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {compliance ? (
        <section className="card">
          <div className="card__head">
            <Logo size={30} />
            <h2>امتثال المحلات — {from} إلى {to}</h2>
          </div>
          <div className="card__body">
            <p className="hint" style={{ marginBottom: 12 }}>
              المحلات المعتمدة التي لم تُسجِّل أي عملية (بيع/صيانة/فرمتة) خلال الفترة تُعلَّم <span className="badge badge--danger">غير ملتزمة</span>.
            </p>
            {compliance.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>لا توجد محلات معتمدة ضمن هذه الفترة.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">تقرير امتثال المحلات</caption>
                  <thead>
                    <tr>
                      <th scope="col">المحل</th><th scope="col">رقم الرخصة</th><th scope="col">الحالة</th>
                      <th scope="col">مبيعات</th><th scope="col">صيانات</th><th scope="col">فرمتات</th>
                      <th scope="col">الإجمالي</th><th scope="col">الالتزام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.map((s) => {
                      const total = s.sales + s.repairs + s.formats;
                      const ok = total > 0;
                      return (
                        <tr key={s.shop_id}>
                          <td>{s.name_ar}</td>
                          <td className="mono">{s.license_number}</td>
                          <td>{SHOP_STATUS_AR[s.status] ?? s.status}</td>
                          <td>{formatNumber(s.sales)}</td>
                          <td>{formatNumber(s.repairs)}</td>
                          <td>{formatNumber(s.formats)}</td>
                          <td>{formatNumber(total)}</td>
                          <td>
                            <span className={`badge ${ok ? 'badge--ok' : 'badge--danger'}`}>
                              {ok ? 'ملتزمة' : 'غير ملتزمة'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
