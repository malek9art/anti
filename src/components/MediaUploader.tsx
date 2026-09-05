import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { callFunction, errorMessage } from '../lib/api';

interface Props {
  /** اسم دلو التخزين (device-media أو evidence) */
  bucket: string;
  /** دالة إنشاء رابط الرفع الموقّع */
  createFn: string;
  /** دالة تثبيت المسار بعد الرفع */
  completeFn: string;
  /** حِزم إرسالها لدالة إنشاء الرابط (device_id أو report_id) */
  createBody: Record<string, unknown>;
  /** بناء حِزم دالة التثبيت من (المسار + الملف) */
  completeBody: (path: string, file: File) => Record<string, unknown>;
  /** تسمية الزر */
  label: string;
  onUploaded?: (path: string) => void;
}

/**
 * رفع وسائط عبر رابط موقّع يصدره الخادم (بعد فحص الصلاحية وAAL2)،
 * ثم رفع مباشر إلى التخزين، ثم تثبيت المسار عبر دالة الحافة.
 * لا يُخزَّن أي ملف على جهاز المستخدم المصدر — يُرسل فقط إلى التخزين.
 */
export function MediaUploader({ bucket, createFn, completeFn, createBody, completeBody, label, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file) return;
    setBusy(true); setError(null); setMsg(null);
    try {
      // 1) رابط موقّع من الخادم بعد التحقق من الصلاحية وAAL2
      const { path, token } = await callFunction<{ path: string; token: string }>(
        createFn, { ...createBody, content_type: file.type });

      // 2) الرفع المباشر إلى التخزين بالرمز الموقّع
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(path, token, file, { contentType: file.type, upsert: true });
      if (upErr) throw new Error(upErr.message);

      // 3) تثبيت المسار/فهرسته
      await callFunction(completeFn, completeBody(path, file));

      setMsg('تم الرفع بنجاح ✓');
      if (inputRef.current) inputRef.current.value = '';
      onUploaded?.(path);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="media-uploader">
      <label className="btn btn--sm btn--ghost" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
        {busy ? 'جارٍ الرفع…' : label}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => void upload(e.target.files?.[0] as File)}
          disabled={busy}
        />
      </label>
      {msg ? <span className="media-msg media-msg--ok" role="status">{msg}</span> : null}
      {error ? <div className="alert alert--error" style={{ marginTop: 8 }} role="alert">{error}</div> : null}
    </div>
  );
}
