import { useState, type FormEvent } from 'react';
import { useApi } from '../lib/useApi';
import { callFunction, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState, MfaRequiredState } from '../components/States';
import { imeiError } from '../lib/imei';

type Mode = 'repair' | 'format';

interface CheckResult {
  registered: boolean;
  security_alert: boolean;
  device: { id: string; brand: string; model: string } | null;
  alert: { report_number: string } | null;
}

type Receipt = {
  kind: Mode;
  operation_number: string;
  at: string;
};

export function Service() {
  const { isAal2, profile } = useAuth();
  const [mode, setMode] = useState<Mode>('repair');
  const [imei, setImei] = useState('');
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ shop_id: '', fault: '', actions: '', cost: '', reason: '', consent: false });
  const shops = useApi<Array<{ id: string; name_ar: string }>>('get-shops', { status: 'approved' });
  const err = imei ? imeiError(imei) : null;
  const shopName = (shops.data ?? []).find((s) => s.id === form.shop_id)?.name_ar ?? '—';

  async function runCheck(e: FormEvent) {
    e.preventDefault();
    if (err) return;
    setChecking(true); setError(null); setCheck(null); setOk(null);
    try {
      setCheck(await callFunction<CheckResult>('check-imei', { imei }));
    } catch (e) { setError(errorMessage(e)); } finally { setChecking(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!check?.device) return;
    setBusy(true); setError(null); setOk(null); setReceipt(null);
    try {
      if (mode === 'repair') {
        const r = await callFunction<{ operation_number: string }>('create-repair', {
          device_id: check.device.id, shop_id: form.shop_id,
          fault: form.fault, actions: form.actions || null, cost: Number(form.cost || 0),
        });
        setOk('تم تسجيل عملية الصيانة بنجاح.');
        setReceipt({ kind: 'repair', operation_number: r.operation_number, at: new Date().toISOString() });
      } else {
        const r = await callFunction<{ operation_number: string }>('create-format-record', {
          device_id: check.device.id, shop_id: form.shop_id,
          reason: form.reason, consent: form.consent,
        });
        setOk('تم تسجيل عملية الفرمتة بنجاح.');
        setReceipt({ kind: 'format', operation_number: r.operation_number, at: new Date().toISOString() });
      }
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>الصيانة والفرمتة</h1>
          <p>استلام فني ← فحص خادمي للـ IMEI ← تنبيه أمني إن كان مبلّغًا ← تسجيل العملية.</p>
        </div>
      </div>

      {!isAal2 && mode === 'format' ? <MfaRequiredState /> : null}

      <section className="card" style={{ maxWidth: 760 }}>
        <div className="card__head">
          <div className="auth-tabs" style={{ margin: 0, width: 260 }} role="tablist" aria-label="نوع العملية">
            <button type="button" role="tab" aria-selected={mode === 'repair'} onClick={() => setMode('repair')}>صيانة</button>
            <button type="button" role="tab" aria-selected={mode === 'format'} onClick={() => setMode('format')}>فرمتة</button>
          </div>
        </div>
        <div className="card__body">
          <form onSubmit={runCheck} noValidate>
            <div className="field">
              <label htmlFor="sv-imei">1. الفحص الأمني للـ IMEI (إلزامي قبل الاستلام)</label>
              <input id="sv-imei" className="mono" inputMode="numeric" maxLength={15} value={imei}
                onChange={(e) => { setImei(e.target.value.replace(/\D/g, '')); setCheck(null); }}
                aria-invalid={Boolean(err)} required />
              {err ? <div className="err" role="alert">{err}</div> : null}
            </div>
            <button type="submit" className="btn btn--ghost" disabled={checking || Boolean(err)}>
              {checking ? 'جارٍ الفحص…' : 'فحص الجهاز'}
            </button>
          </form>

          {checking ? <LoadingState /> : null}
          {error ? <div className="alert alert--error" role="alert" style={{ marginTop: 14 }}>{error}</div> : null}
          {ok ? <div className="alert alert--ok" role="status" style={{ marginTop: 14 }}>{ok}</div> : null}

          {receipt ? (
            <section className="card" style={{ marginTop: 16, borderColor: 'var(--ok)' }}>
              <div className="card__head">
                <h2>✅ تم تسجيل عملية {receipt.kind === 'repair' ? 'الصيانة' : 'الفرمتة'}</h2>
                <span className="badge badge--ok">مؤكَّدة</span>
              </div>
              <div className="card__body">
                <dl className="receipt">
                  <div className="receipt__row"><dt>اسم الفني</dt><dd>{profile?.full_name ?? '—'}</dd></div>
                  <div className="receipt__row"><dt>المحل</dt><dd>{shopName}</dd></div>
                  <div className="receipt__row"><dt>IMEI</dt><dd className="mono">{imei}</dd></div>
                  <div className="receipt__row"><dt>تاريخ ووقت العملية</dt><dd>{new Intl.DateTimeFormat('ar', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  }).format(new Date(receipt.at))}</dd></div>
                  <div className="receipt__row"><dt>رقم العملية</dt><dd className="mono">{receipt.operation_number}</dd></div>
                </dl>
                <p className="hint" style={{ marginBottom: 0 }}>
                  🛡️ هذا السجل غير قابل للحذف أو التعديل من قِبل الفني، ويُحفظ في سجل التدقيق
                  (append-only) لضمان سلامة العمليات.
                </p>
              </div>
            </section>
          ) : null}

          {check?.security_alert ? (
            <div className="alert alert--error" role="alert" style={{ marginTop: 14 }}>
              🚨 هذا الجهاز عليه بلاغ سرقة نشط ({check.alert?.report_number}). يُمنع استلامه أو صيانته أو فرمتته،
              وقد سُجّل حدث أمني وأُخطرت الجهة المختصة.
            </div>
          ) : null}

          {check && !check.security_alert && !check.registered ? (
            <div className="alert alert--warn" style={{ marginTop: 14 }}>
              الجهاز غير مسجّل في المنصة. سجّله أولًا من صفحة الأجهزة قبل تسجيل العملية.
            </div>
          ) : null}

          {check && !check.security_alert && check.device ? (
            <form onSubmit={submit} noValidate style={{ marginTop: 18 }}>
              <div className="alert alert--ok">
                ✅ الجهاز سليم: {check.device.brand} {check.device.model} — يمكن متابعة الاستلام.
              </div>
              <div className="field">
                <label htmlFor="sv-shop">المحل</label>
                <select id="sv-shop" value={form.shop_id}
                  onChange={(e) => setForm((f) => ({ ...f, shop_id: e.target.value }))} required>
                  <option value="">اختر محلًا…</option>
                  {(shops.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
                </select>
              </div>

              {mode === 'repair' ? (
                <>
                  <div className="field">
                    <label htmlFor="sv-fault">وصف العطل</label>
                    <textarea id="sv-fault" value={form.fault}
                      onChange={(e) => setForm((f) => ({ ...f, fault: e.target.value }))} required />
                  </div>
                  <div className="row">
                    <div className="field">
                      <label htmlFor="sv-act">الإجراءات المتخذة</label>
                      <input id="sv-act" value={form.actions}
                        onChange={(e) => setForm((f) => ({ ...f, actions: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label htmlFor="sv-cost">التكلفة (ر.س)</label>
                      <input id="sv-cost" type="number" min="0" step="0.01" value={form.cost}
                        onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="sv-reason">سبب الفرمتة</label>
                    <textarea id="sv-reason" value={form.reason}
                      onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" style={{ width: 18 }} checked={form.consent}
                        onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))} />
                      أُقرّ بالحصول على موافقة مالك الجهاز الموثّقة
                    </label>
                    <div className="hint">الموافقة إلزامية وتُرفض العملية خادميًا بدونها.</div>
                  </div>
                </>
              )}

              <button type="submit" className="btn" disabled={busy || (mode === 'format' && !form.consent)}>
                {busy ? 'جارٍ الحفظ…' : mode === 'repair' ? 'تسجيل الصيانة' : 'تسجيل الفرمتة'}
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </>
  );
}
