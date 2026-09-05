import { useState, type FormEvent } from 'react';
import { callFunction, errorMessage } from '../lib/api';
import { imeiError } from '../lib/imei';
import { DEVICE_STATUS_AR, formatDate } from '../lib/format';

interface CheckResult {
  valid: boolean;
  reason?: string;
  registered: boolean;
  device: { id: string; brand: string; model: string; status: string; is_flagged: boolean } | null;
  security_alert: boolean;
  alert: { report_number: string; status: string; since: string } | null;
}

export function CheckImei() {
  const [imei, setImei] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  const clientError = touched ? imeiError(imei) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    const err = imeiError(imei);
    if (err) { setError(null); setResult(null); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      setResult(await callFunction<CheckResult>('check-imei', { imei: imei.trim() }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>فحص IMEI</h1>
          <p>تحقّق أمني فوري من حالة الجهاز. لا تُكشف هوية المبلّغ في أي حال.</p>
        </div>
      </div>

      <section className="card" style={{ maxWidth: 640 }}>
        <div className="card__body">
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="imei">رقم IMEI (15 رقمًا)</label>
              <input id="imei" className="mono" inputMode="numeric" maxLength={15} value={imei}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, ''))}
                onBlur={() => setTouched(true)}
                aria-invalid={Boolean(clientError)}
                aria-describedby="imei-help" required />
              <div className="hint" id="imei-help">
                يُتحقق من الرقم بخوارزمية Luhn محليًا وخادميًا. اطلبه بالضغط على ‎*#06#‎ على الجهاز.
              </div>
              {clientError ? <div className="err" role="alert">{clientError}</div> : null}
            </div>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'جارٍ الفحص…' : 'فحص الآن'}
            </button>
          </form>

          {error ? <div className="alert alert--error" role="alert" style={{ marginTop: 16 }}>{error}</div> : null}

          {result ? (
            <div style={{ marginTop: 18 }}>
              {result.security_alert ? (
                <div className="alert alert--error" role="alert">
                  🚨 <strong>تنبيه أمني:</strong> يوجد بلاغ سرقة نشط على هذا الجهاز
                  (رقم البلاغ {result.alert?.report_number}، منذ {formatDate(result.alert?.since)}).
                  لا يجوز إجراء أي صيانة أو فرمتة، وأبلغ الجهة المختصة فورًا.
                </div>
              ) : (
                <div className="alert alert--ok" role="status">
                  ✅ لا توجد بلاغات سرقة نشطة على هذا الجهاز.
                </div>
              )}

              <div className="alert alert--info">
                {result.registered && result.device ? (
                  <>
                    الجهاز مسجّل في المنصة: <strong>{result.device.brand} {result.device.model}</strong> —
                    الحالة: {DEVICE_STATUS_AR[result.device.status] ?? result.device.status}
                  </>
                ) : 'الجهاز غير مسجّل في المنصة.'}
              </div>

              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>
                ملاحظة: رقم IMEI لا يتيح تحديد موقع الجهاز؛ هذه النتيجة حالة تسجيل وبلاغات فقط.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
