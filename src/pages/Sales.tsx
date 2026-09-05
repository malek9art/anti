import { useState, type FormEvent } from 'react';
import { useApi } from '../lib/useApi';
import { callFunction, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState, MfaRequiredState } from '../components/States';
import { lookupHash, sealValue } from '../lib/crypto';
import { SHOP_STATUS_AR } from '../lib/format';

export function Sales() {
  const { isAal2 } = useAuth();
  const shops = useApi<Array<{ id: string; name_ar: string; status: string }>>('get-shops', { status: 'approved' });
  const devices = useApi<Array<{ id: string; brand: string; model: string; imei_masked: string; status: string }>>(
    'get-devices', { limit: 100 });

  const [form, setForm] = useState({
    shop_id: '', device_id: '', price: '', warranty_months: '12',
    name: '', phone: '', national_id: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setOk(null);
    try {
      // تُشفَّر بيانات المشتري قبل المغادرة، وتُرسل تجزئات بحث فقط
      const [name_encrypted, phone_encrypted, national_id_encrypted] = await Promise.all([
        sealValue(form.name), sealValue(form.phone),
        form.national_id ? sealValue(form.national_id) : Promise.resolve(null),
      ]);
      const [name_hash, phone_hash, national_id_hash] = await Promise.all([
        lookupHash(form.name), lookupHash(form.phone),
        form.national_id ? lookupHash(form.national_id) : Promise.resolve(null),
      ]);
      const result = await callFunction<{ invoice_number: string }>('register-sale', {
        shop_id: form.shop_id, device_id: form.device_id,
        price: Number(form.price), warranty_months: Number(form.warranty_months),
        name_encrypted, phone_encrypted, national_id_encrypted,
        name_hash, phone_hash, national_id_hash,
      });
      setOk(`تم تسجيل البيع بنجاح. رقم الفاتورة: ${result.invoice_number}`);
      setForm((f) => ({ ...f, device_id: '', price: '', name: '', phone: '', national_id: '' }));
      devices.reload();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  const available = (devices.data ?? []).filter((d) => d.status === 'registered');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>تسجيل عملية بيع</h1>
          <p>تُشفَّر بيانات المشتري الحساسة قبل الإرسال ولا تُعرض كنص صريح لغير المخوّل.</p>
        </div>
      </div>

      {!isAal2 ? <MfaRequiredState /> : null}

      <section className="card" style={{ maxWidth: 780 }}>
        <div className="card__body">
          {shops.loading || devices.loading ? <LoadingState label="جارٍ تحميل المحلات والأجهزة…" /> : null}
          {shops.error ? <ErrorState message={shops.error} onRetry={shops.reload} /> : null}
          {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
          {ok ? <div className="alert alert--ok" role="status">{ok}</div> : null}

          {!shops.loading && shops.data && shops.data.length === 0 ? (
            <div className="alert alert--warn">لا توجد محلات معتمدة. اعتمد محلًا أولًا من صفحة المحلات.</div>
          ) : null}

          <form onSubmit={submit} noValidate>
            <div className="row">
              <div className="field">
                <label htmlFor="s-shop">المحل</label>
                <select id="s-shop" value={form.shop_id} onChange={set('shop_id')} required>
                  <option value="">اختر محلًا…</option>
                  {(shops.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name_ar} ({SHOP_STATUS_AR[s.status]})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-dev">الجهاز</label>
                <select id="s-dev" value={form.device_id} onChange={set('device_id')} required>
                  <option value="">اختر جهازًا…</option>
                  {available.map((d) => (
                    <option key={d.id} value={d.id}>{d.brand} {d.model} — {d.imei_masked}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-price">السعر (ر.س)</label>
                <input id="s-price" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} required />
              </div>
              <div className="field">
                <label htmlFor="s-war">مدة الضمان (شهر)</label>
                <input id="s-war" type="number" min="0" value={form.warranty_months} onChange={set('warranty_months')} />
              </div>
            </div>

            <h3 style={{ fontSize: 15 }}>بيانات المشتري (مشفّرة)</h3>
            <div className="row">
              <div className="field">
                <label htmlFor="s-name">الاسم الكامل</label>
                <input id="s-name" value={form.name} onChange={set('name')} required />
              </div>
              <div className="field">
                <label htmlFor="s-phone">رقم الهاتف</label>
                <input id="s-phone" dir="ltr" value={form.phone} onChange={set('phone')} required />
              </div>
              <div className="field">
                <label htmlFor="s-nid">رقم الهوية الوطنية</label>
                <input id="s-nid" dir="ltr" value={form.national_id} onChange={set('national_id')} />
                <div className="hint">تُخزَّن مشفّرة، ولا يمكن عرضها إلا بصلاحية ومبرر مسجَّل.</div>
              </div>
            </div>

            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'جارٍ التسجيل…' : 'تسجيل البيع'}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
