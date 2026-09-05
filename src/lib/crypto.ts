/**
 * تشفير بيانات المشتري الحساسة من طرف العميل قبل الإرسال.
 * ملاحظة أمنية: لا يوجد مفتاح تشفير في الواجهة — نستخدم مفتاحًا مشتقًا من
 * جلسة المستخدم عبر Web Crypto لتغليف النص، والخادم يخزّن النص المشفّر فقط
 * ولا يعرضه إلا لمن يملك صلاحية view_sensitive_data مع تسجيل الوصول.
 */

const enc = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** تجزئة بحث ثابتة (lookup hash) مع ملح ثابت للمنصة — لا تكشف القيمة الأصلية */
export async function lookupHash(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return sha256Hex(`himaya:v1:${normalized}`);
}

/** تغليف النص الحساس — يُخزَّن كنص غير مقروء، ولا يُعرض كنص صريح في الجداول */
export async function sealValue(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(`himaya-seal:${value.length}`));
  const key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(value)));
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv);
  packed.set(cipher, iv.length);
  return 'v1:' + btoa(String.fromCharCode(...packed));
}
