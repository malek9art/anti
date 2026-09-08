import { useRef, useState, type ChangeEvent } from 'react';
import { callFunction, errorMessage } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useBranding } from '../context/BrandingContext';
import { Logo } from './Logo';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/svg+xml', 'image/webp'];

export function BrandingManager() {
  const { reload, isCustom } = useBranding();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(e: ChangeEvent<HTMLInputElement>) {
    setError(null); setMsg(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setError('يُسمح بصيغ PNG أو SVG أو WEBP فقط. يُفضّل PNG بخلفية شفافة.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('حجم الملف يتجاوز 2 ميجابايت.');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function upload() {
    if (!file) return;
    setBusy(true); setError(null); setMsg(null);
    try {
      // 1) رابط رفع موقّع من الخادم بعد التحقق من الصلاحية وAAL2
      const { path, token } = await callFunction<{ path: string; token: string }>(
        'branding-create-upload-url', { content_type: file.type });

      // 2) الرفع المباشر إلى التخزين بالرمز الموقّع
      const { error: upErr } = await supabase.storage
        .from('branding')
        .uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr) throw new Error(upErr.message);

      // 3) تثبيت المسار في إعدادات النظام مع رفع رقم الإصدار
      await callFunction('set-branding-logo', { path });

      setMsg('تم تحديث الشعار بنجاح. سيظهر في كل شاشات المنصة فورًا.');
      setFile(null); setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
      reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true); setError(null); setMsg(null);
    try {
      await callFunction('reset-branding-logo');
      setMsg('تمت إعادة الشعار الافتراضي المرفق مع التطبيق.');
      reload();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <section className="card">
      <div className="card__head"><h2>الهوية البصرية — الشعار</h2></div>
      <div className="card__body">
        {msg ? <div className="alert alert--ok" role="status">{msg}</div> : null}
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>الشعار الحالي</div>
            <div style={{
              background: 'var(--green-800)', borderRadius: 12, padding: 12,
              display: 'grid', placeItems: 'center', width: 116, height: 116,
            }}>
              <Logo size={92} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
              {isCustom ? 'شعار مرفوع' : 'الشعار الافتراضي'}
            </div>
          </div>

          {preview ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>معاينة الجديد</div>
              <div style={{
                background: 'var(--green-800)', borderRadius: 12, padding: 12,
                display: 'grid', placeItems: 'center', width: 116, height: 116,
              }}>
                <img src={preview} alt="معاينة الشعار الجديد" width={92} height={92}
                  style={{ objectFit: 'contain' }} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>على خلفية داكنة</div>
            </div>
          ) : null}

          {preview ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>على خلفية فاتحة</div>
              <div style={{
                background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 12,
                display: 'grid', placeItems: 'center', width: 116, height: 116,
              }}>
                <img src={preview} alt="معاينة الشعار على خلفية فاتحة" width={92} height={92}
                  style={{ objectFit: 'contain' }} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>تحقّق من الشفافية</div>
            </div>
          ) : null}
        </div>

        <div className="field" style={{ marginTop: 18, maxWidth: 460 }}>
          <label htmlFor="logo-file">اختر ملف الشعار</label>
          <input ref={inputRef} id="logo-file" type="file" accept="image/png,image/svg+xml,image/webp"
            onChange={pick} />
          <div className="hint">
            PNG بخلفية شفافة (مربّع، 512×512 أو أكبر) — الحد الأقصى 2 ميجابايت.
            يُرفع الملف كما هو دون أي إعادة رسم أو ضغط أو تغيير ألوان.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => void upload()} disabled={busy || !file}>
            {busy ? 'جارٍ الرفع…' : 'حفظ الشعار'}
          </button>
          {isCustom ? (
            <button type="button" className="btn btn--ghost" onClick={() => void reset()} disabled={busy}>
              إعادة الافتراضي
            </button>
          ) : null}
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 0, marginTop: 14 }}>
          يظهر الشعار تلقائيًا في: شاشة الدخول، الشريط الجانبي، الهيدر على الجوال، أيقونة المتصفح والتطبيق،
          ترويسة التقارير، وصفحات الطباعة/PDF. تغيير الشعار عملية حساسة تتطلب AAL2 وتُسجَّل في سجل التدقيق.
        </p>
      </div>
    </section>
  );
}
