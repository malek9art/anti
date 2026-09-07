import { useState, type FormEvent } from 'react';
import { useApi } from '../lib/useApi';
import { callFunction, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState, EmptyState, ErrorState, MfaRequiredState } from '../components/States';
import { MediaUploader } from '../components/MediaUploader';
import { MediaGallery } from '../components/MediaGallery';
import { imeiError } from '../lib/imei';
import { REPORT_STATUS_AR, PRIORITY_AR, formatDate } from '../lib/format';

interface ReportRow {
  id: string; report_number: string; status: string; priority: string;
  imei_masked: string; incident_at: string; created_at: string;
}

const NEXT_STATUSES: Record<string, string[]> = {
  draft: ['submitted'], submitted: ['under_review', 'rejected'],
  under_review: ['verified', 'rejected'], verified: ['active'],
  active: ['recovered'], assigned: ['recovered'], recovered: ['closed'], rejected: ['closed'],
};

export function Reports() {
  const { can, isAal2 } = useAuth();
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useApi<ReportRow[]>('get-reports', { status: filter || null, limit: 50 });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>بلاغات السرقة</h1>
          <p>إنشاء البلاغات ومتابعة مسار حالاتها حتى الاسترداد والإغلاق.</p>
        </div>
        {can('create_stolen_report') ? (
          <div className="page-head__actions">
            <button type="button" className="btn btn--gold" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'إغلاق النموذج' : '🚨 بلاغ جديد'}
            </button>
          </div>
        ) : null}
      </div>

      {!isAal2 ? <MfaRequiredState /> : null}
      {showForm ? <ReportForm onDone={() => { setShowForm(false); list.reload(); }} /> : null}

      <section className="card">
        <div className="card__head">
          <h2>البلاغات</h2>
          <div style={{ marginInlineStart: 'auto' }}>
            <label htmlFor="rf" className="sr-only">تصفية بالحالة</label>
            <select id="rf" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">كل الحالات</option>
              {Object.entries(REPORT_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="card__body">
          {list.loading ? <LoadingState label="جارٍ تحميل البلاغات…" /> : null}
          {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}
          {list.data && list.data.length === 0 ? (
            <EmptyState title="لا توجد بلاغات" description="لا توجد بلاغات مطابقة للتصفية الحالية." />
          ) : null}
          {list.data && list.data.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">قائمة بلاغات السرقة</caption>
                <thead>
                  <tr>
                    <th scope="col">رقم البلاغ</th><th scope="col">IMEI</th><th scope="col">الحالة</th>
                    <th scope="col">الأولوية</th><th scope="col">تاريخ الواقعة</th><th scope="col">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.report_number}</td>
                      <td className="mono">{r.imei_masked}</td>
                      <td><span className={`badge ${badgeFor(r.status)}`}>{REPORT_STATUS_AR[r.status] ?? r.status}</span></td>
                      <td>{PRIORITY_AR[r.priority] ?? r.priority}</td>
                      <td>{formatDate(r.incident_at)}</td>
                      <td>
                        <button type="button" className="btn btn--ghost btn--sm"
                          onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                          التفاصيل
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

      {openId ? <ReportDetail id={openId} onChanged={list.reload} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function badgeFor(status: string): string {
  if (['active', 'assigned', 'verified'].includes(status)) return 'badge--danger';
  if (status === 'recovered') return 'badge--ok';
  if (status === 'closed' || status === 'rejected') return 'badge--info';
  return 'badge--warn';
}

function ReportForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ imei: '', incident_at: '', location: '', narrative: '', priority: 'normal' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const err = form.imei ? imeiError(form.imei) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (err) return;
    setBusy(true); setError(null);
    try {
      await callFunction('create-stolen-report', {
        imei: form.imei, incident_at: new Date(form.incident_at).toISOString(),
        location: form.location || null, narrative: form.narrative, priority: form.priority,
      });
      onDone();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card__head"><h2>بلاغ سرقة جديد</h2></div>
      <div className="card__body">
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        <form onSubmit={submit} noValidate>
          <div className="row">
            <div className="field">
              <label htmlFor="r-imei">رقم IMEI</label>
              <input id="r-imei" className="mono" inputMode="numeric" maxLength={15} value={form.imei}
                onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value.replace(/\D/g, '') }))}
                aria-invalid={Boolean(err)} required />
              {err ? <div className="err" role="alert">{err}</div> : null}
            </div>
            <div className="field">
              <label htmlFor="r-at">تاريخ ووقت الواقعة</label>
              <input id="r-at" type="datetime-local" value={form.incident_at}
                onChange={(e) => setForm((f) => ({ ...f, incident_at: e.target.value }))} required />
            </div>
            <div className="field">
              <label htmlFor="r-loc">مكان الواقعة</label>
              <input id="r-loc" value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="r-pri">الأولوية</label>
              <select id="r-pri" value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {Object.entries(PRIORITY_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="r-nar">وصف الواقعة</label>
            <textarea id="r-nar" value={form.narrative}
              onChange={(e) => setForm((f) => ({ ...f, narrative: e.target.value }))} required />
          </div>
          <button type="submit" className="btn" disabled={busy || Boolean(err)}>
            {busy ? 'جارٍ الإرسال…' : 'إنشاء البلاغ'}
          </button>
        </form>
      </div>
    </section>
  );
}

interface Detail {
  report: Record<string, string>;
  history: Array<{ from_status: string | null; to_status: string; note: string | null; created_at: string }>;
  follow_ups: Array<{ id: string; body: string; created_at: string }>;
  evidence: Array<{ id: string; media_type: string; description: string | null; created_at: string }>;
}

export function ReportDetail({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi<Detail>('get-report-detail', { report_id: id });
  const assignees = useApi<Array<{ id: string; full_name: string }>>('get-case-assignees', {}, can('assign_case'));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(fn: string, body: Record<string, unknown>, success: string) {
    setBusy(true); setActionError(null); setMsg(null);
    try {
      await callFunction(fn, body);
      setMsg(success); setNote(''); reload(); onChanged();
    } catch (e) { setActionError(errorMessage(e)); } finally { setBusy(false); }
  }

  if (loading) return <section className="card" style={{ marginTop: 16 }}><div className="card__body"><LoadingState /></div></section>;
  if (error) return <section className="card" style={{ marginTop: 16 }}><div className="card__body"><ErrorState message={error} onRetry={reload} /></div></section>;
  if (!data) return null;

  const status = data.report.status;
  const nexts = NEXT_STATUSES[status] ?? [];

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card__head">
        <h2>البلاغ {data.report.report_number}</h2>
        <span className={`badge ${badgeFor(status)}`}>{REPORT_STATUS_AR[status] ?? status}</span>
        <button type="button" className="btn btn--ghost btn--sm" style={{ marginInlineStart: 'auto' }} onClick={onClose}>
          إغلاق
        </button>
      </div>
      <div className="card__body">
        {msg ? <div className="alert alert--ok" role="status">{msg}</div> : null}
        {actionError ? <div className="alert alert--error" role="alert">{actionError}</div> : null}

        <p><strong>الواقعة:</strong> {data.report.narrative}</p>
        <p><strong>المكان:</strong> {data.report.incident_location ?? '—'} — <strong>التاريخ:</strong> {formatDate(data.report.incident_at)}</p>

        {nexts.length && can('change_report_status') ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {nexts.map((s) => (
              <button key={s} type="button" className="btn btn--sm" disabled={busy}
                onClick={() => void act('update-report-status', { report_id: id, to_status: s }, `تم الانتقال إلى: ${REPORT_STATUS_AR[s]}`)}>
                ➜ {REPORT_STATUS_AR[s]}
              </button>
            ))}
          </div>
        ) : null}

        {can('assign_case') && assignees.data?.length ? (
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="assignee">إحالة إلى</label>
            <select id="assignee" disabled={busy} defaultValue=""
              onChange={(e) => e.target.value && void act('assign-report', { report_id: id, assignee: e.target.value }, 'تمت الإحالة بنجاح')}>
              <option value="">اختر موظفًا/مندوبًا…</option>
              {assignees.data.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
        ) : null}

        {can('update_follow_up') ? (
          <form onSubmit={(e) => { e.preventDefault(); void act('add-report-follow-up', { report_id: id, body: note }, 'تمت إضافة المتابعة'); }}>
            <div className="field">
              <label htmlFor="fu">إضافة متابعة</label>
              <textarea id="fu" value={note} onChange={(e) => setNote(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn--ghost btn--sm" disabled={busy || !note.trim()}>حفظ المتابعة</button>
          </form>
        ) : null}

        <h3 style={{ fontSize: 15, marginTop: 20 }}>مسار الحالات</h3>
        <ul className="timeline">
          {data.history.map((h, i) => (
            <li key={i}>
              <div className="timeline__title">
                {h.from_status ? `${REPORT_STATUS_AR[h.from_status]} ← ` : ''}{REPORT_STATUS_AR[h.to_status] ?? h.to_status}
              </div>
              <div className="timeline__meta">{formatDate(h.created_at)}{h.note ? ` — ${h.note}` : ''}</div>
            </li>
          ))}
        </ul>

        <h3 style={{ fontSize: 15 }}>المتابعات ({data.follow_ups.length})</h3>
        {data.follow_ups.length === 0 ? <p style={{ color: 'var(--muted)' }}>لا توجد متابعات.</p> : (
          <ul className="timeline">
            {data.follow_ups.map((f) => (
              <li key={f.id}>
                <div className="timeline__title">{f.body}</div>
                <div className="timeline__meta">{formatDate(f.created_at)}</div>
              </li>
            ))}
          </ul>
        )}

        <h3 style={{ fontSize: 15, marginTop: 20 }}>الأدلة ({data.evidence.length})</h3>
        {can('upload_evidence') ? (
          <div style={{ marginBottom: 10 }}>
            <MediaUploader
              bucket="evidence"
              createFn="evidence-create-upload-url"
              completeFn="evidence-complete-upload"
              createBody={{ report_id: id }}
              completeBody={(path) => ({ report_id: id, path, media_type: 'image', description: 'دليل مرفوع من بلاغ', access_level: 'restricted' })}
              label="📎 رفع دليل / صورة"
              onUploaded={() => reload()}
            />
            <p className="hint">رفع الأدلة يتطلب تحققًا بخطوتين (AAL2) وصلاحية رفع الأدلة.</p>
          </div>
        ) : null}
        {data.evidence.length === 0 ? <p style={{ color: 'var(--muted)' }}>لا توجد أدلة بعد.</p> : (
          <MediaGallery
            items={data.evidence.map((e) => ({ ...e, media_type: e.media_type ?? 'image' }))}
            downloadFn="evidence-download-url"
            downloadBody={(eid) => ({ evidence_id: eid, purpose: 'view_report_evidence' })}
          />
        )}
      </div>
    </section>
  );
}
