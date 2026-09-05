/**
 * الشعار الرسمي للمنصة.
 * يُقرأ من ملف PNG بخلفية شفافة في public/logo.png — نقطة تبديل واحدة فقط.
 * ⚠️ لا يُعاد رسمه ولا تُغيَّر ألوانه أو نسبه أو نصوصه.
 */
const BASE = import.meta.env.BASE_URL;

export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <img
      src={`${BASE}logo.png`}
      width={size}
      height={size}
      className={className}
      alt="شعار حماية — نظام مكافحة سرقة الأجهزة"
      style={{ objectFit: 'contain' }}
    />
  );
}

export const LOGO_URL = `${BASE}logo.png`;
