import { useState } from 'react';
import { useBranding } from '../context/BrandingContext';

const FALLBACK = `${import.meta.env.BASE_URL}logo.png`;

/**
 * الشعار الرسمي للمنصة.
 * يُقرأ من الشعار المرفوع عبر لوحة الإدارة (إعدادات النظام ← الهوية البصرية)،
 * ويعود تلقائيًا إلى الشعار المرفق مع التطبيق إن لم يُرفع شعار.
 * ⚠️ يُعرض كما هو دون إعادة رسم أو تغيير ألوان أو نسب.
 */
export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  const { logoUrl } = useBranding();
  const [failed, setFailed] = useState(false);

  return (
    <img
      src={failed ? FALLBACK : logoUrl}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      alt="شعار حماية — نظام مكافحة سرقة الأجهزة"
      style={{ objectFit: 'contain' }}
    />
  );
}
