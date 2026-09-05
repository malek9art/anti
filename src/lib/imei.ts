/** التحقق من IMEI: 15 رقمًا + خوارزمية Luhn (وليس regex فقط) */
export function isValidImei(value: string): boolean {
  if (!/^[0-9]{15}$/.test(value)) return false;
  let sum = 0;
  let double = false;
  for (let i = 14; i >= 0; i--) {
    let digit = Number(value[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function imeiError(value: string): string | null {
  const v = value.trim();
  if (!v) return 'رقم IMEI مطلوب';
  if (!/^[0-9]+$/.test(v)) return 'رقم IMEI يجب أن يحتوي على أرقام فقط';
  if (v.length !== 15) return `رقم IMEI يجب أن يكون 15 رقمًا (أدخلت ${v.length})`;
  if (!isValidImei(v)) return 'رقم IMEI غير صالح: فشل التحقق من خانة المراجعة (Luhn)';
  return null;
}

export function maskImei(value: string): string {
  if (!value || value.length < 4) return '••••';
  return '•'.repeat(Math.max(0, value.length - 4)) + value.slice(-4);
}
