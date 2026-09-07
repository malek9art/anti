import { useState, type FormEvent } from 'react';
import { useApi } from '../lib/useApi';
import { callFunction, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { MediaUploader } from '../components/MediaUploader';
import { MediaGallery, type MediaItem } from '../components/MediaGallery';
import { imeiError } from '../lib/imei';
import { DEVICE_STATUS_AR, formatDate } from '../lib/format';

interface DeviceRow {
  id: string; brand: string; model: string; color: string | null;
  status: string; is_flagged: boolean; imei_masked: string; created_at: string;
}

export function Devices() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<DeviceRow | null>(null);
  const list = useApi<DeviceRow[]>('get-devices', { search: query || null, limit: 50 });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>الأجهزة</h1>
          <p>سجل الأجهزة المسجّلة وخطّها الزمني غير القابل للحذف.</p>
        </div>
        {can('create_device') ? (
          <div className="page-head__actions">
            <button type="button" className="btn btn--gold" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'إغلاق النموذج' : '➕ تسجيل جهاز'}
            </button>
          </div>
        ) : null}
      </div>

      {showForm ? <DeviceForm onDone={() => setShowForm(false)} onCreated={() => list.reload()} /> : null}

      <section className="card">
        <div className="card__head">
          <h2>قائمة الأجهزة</h2>
          <form style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}
            onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
            <label htmlFor="dev-search" className="sr-only">بحث</label>
            <input id="dev-search" placeholder="ماركة/موديل أو IMEI كامل" value={search}
              onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
            <button type="submit" className="btn btn--ghost btn--sm">بحث</button>
          </form>
        </div>
        <div className="card__body">
          {list.loading ? <LoadingState label="جارٍ تحميل الأجهزة…" /> : null}
          {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : null}
          {list.data && list.data.length === 0 ? (
            <EmptyState title="لا توجد أجهزة" description="لم يُسجَّل أي جهاز مطابق حتى الآن." />
          ) : null}
          {list.data && list.data.length > 0 ? (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">قائمة الأجهزة المسجّلة</caption>
                <thead>
                  <tr>
                    <th scope="col">الماركة والموديل</th><th scope="col">IMEI</th>
                    <th scope="col">اللون</th><th scope="col">الحالة</th>
                    <th scope="col">تاريخ التسجيل</th><th scope="col">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((d) => (
                    <tr key={d.id}>
                      <td>{d.brand} {d.model}</td>
                      <td className="mono">{d.imei_masked}</td>
                      <td>{d.color ?? '—'}</td>
                      <td>
                        <span className={`badge ${d.is_flagged ? 'badge--danger' : 'badge--info'}`}>
                          {DEVICE_STATUS_AR[d.status] ?? d.status}
                        </span>
                      </td>
                      <td>{formatDate(d.created_at)}</td>
                      <td>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(d)}>
                          الخط الزمني
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

      {selected ? <Timeline device={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function DeviceForm({ onDone, onCreated }: { onDone: () => void; onCreated?: () => void }) {
  const [form, setForm] = useState({ brand: '', model: '', color: '', serial: '', imei_primary: '', imei_secondary: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const primaryErr = form.imei_primary ? imeiError(form.imei_primary) : null;
  const secondaryErr = form.imei_secondary ? imeiError(form.imei_secondary) : null;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (primaryErr || secondaryErr) return;
    setBusy(true); setError(null); setOk(null); setCreatedId(null);
    try {
      const id = await callFunction<{ id: string } | string>('create-device', {
        brand: form.brand, model: form.model, color: form.color || null, serial: form.serial || null,
        imei_primary: form.imei_primary, imei_secondary: form.imei_secondary || null,
      });
      const deviceId = typeof id === 'string' ? id : id?.id;
      setCreatedId(deviceId ?? null);
      setOk('تم تسجيل الجهاز بنجاح. يمكنك إضافة صور الجهاز الآن ثم إغلاق النموذج.');
      onCreated?.();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card__head"><h2>تسجيل جهاز جديد</h2></div>
      <div className="card__body">
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        {ok ? <div className="alert alert--ok" role="status">{ok}</div> : null}
        <form onSubmit={submit} noValidate>
          <div className="row">
            <div className="field">
              <label htmlFor="brand">الماركة</label>
              <input id="brand" value={form.brand} onChange={set('brand')} required />
            </div>
            <div className="field">
              <label htmlFor="model">الموديل</label>
              <input id="model" value={form.model} onChange={set('model')} required />
            </div>
            <div className="field">
              <label htmlFor="color">اللون</label>
              <input id="color" value={form.color} onChange={set('color')} />
            </div>
            <div className="field">
              <label htmlFor="serial">الرقم التسلسلي</label>
              <input id="serial" value={form.serial} onChange={set('serial')} dir="ltr" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="imei1">IMEI الأساسي</label>
              <input id="imei1" className="mono" inputMode="numeric" maxLength={15} value={form.imei_primary}
                onChange={(e) => setForm((f) => ({ ...f, imei_primary: e.target.value.replace(/\D/g, '') }))}
                aria-invalid={Boolean(primaryErr)} required />
              {primaryErr ? <div className="err" role="alert">{primaryErr}</div> : null}
            </div>
            <div className="field">
              <label htmlFor="imei2">IMEI الثانوي (Dual SIM — اختياري)</label>
              <input id="imei2" className="mono" inputMode="numeric" maxLength={15} value={form.imei_secondary}
                onChange={(e) => setForm((f) => ({ ...f, imei_secondary: e.target.value.replace(/\D/g, '') }))}
                aria-invalid={Boolean(secondaryErr)} />
              {secondaryErr ? <div className="err" role="alert">{secondaryErr}</div> : null}
            </div>
          </div>
          <button type="submit" className="btn" disabled={busy || Boolean(primaryErr) || Boolean(secondaryErr)}>
            {busy ? 'جارٍ الحفظ…' : 'تسجيل الجهاز'}
          </button>
        </form>

        {createdId ? (
          <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 15, marginBottom: 0 }}>📷 صور الجهاز (تصوير الجهاز عند التسجيل)</h3>
              <button type="button" className="btn btn--ghost btn--sm" style={{ marginInlineStart: 'auto' }}
                onClick={() => onDone()}>إنهاء وإغلاق</button>
            </div>
            <MediaUploader
              bucket="device-media"
              createFn="media-create-upload-url"
              completeFn="media-complete-upload"
              createBody={{ device_id: createdId }}
              completeBody={(path) => ({ device_id: createdId, path, media_type: 'image', caption: 'صورة الجهاز عند التسجيل' })}
              label="إضافة صورة"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Timeline({ device, onClose }: { device: DeviceRow; onClose: () => void }) {
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi<Array<{ event_type: string; description_ar: string; created_at: string }>>(
    'get-device-timeline', { device_id: device.id });
  const media = useApi<MediaItem[]>('get-device-media', { device_id: device.id });
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card__head">
        <h2>الخط الزمني — {device.brand} {device.model}</h2>
        <button type="button" className="btn btn--ghost btn--sm" style={{ marginInlineStart: 'auto' }} onClick={onClose}>
          إغلاق
        </button>
      </div>
      <div className="card__body">
        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {data && data.length === 0 ? <EmptyState title="لا توجد أحداث" /> : null}
        <ul className="timeline">
          {(data ?? []).map((ev, i) => (
            <li key={i}>
              <div className="timeline__title">{ev.description_ar}</div>
              <div className="timeline__meta">{formatDate(ev.created_at)}</div>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h3 style={{ fontSize: 15 }}>📷 صور الجهاز</h3>
            {can('create_device') ? (
              <MediaUploader
                bucket="device-media"
                createFn="media-create-upload-url"
                completeFn="media-complete-upload"
                createBody={{ device_id: device.id }}
                completeBody={(path) => ({ device_id: device.id, path, media_type: 'image', caption: 'إضافة صورة من الخط الزمني' })}
                label="إضافة صورة"
                onUploaded={() => media.reload()}
              />
            ) : null}
          </div>
          {media.loading ? <LoadingState label="جارٍ تحميل الصور…" /> : null}
          <MediaGallery
            items={media.data ?? []}
            downloadFn="media-download-url"
            downloadBody={(id) => ({ media_id: id })}
            onError={(m) => void m}
          />
        </div>
      </div>
    </section>
  );
}
