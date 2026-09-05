import { corsHeaders } from './cors.ts';

export function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const MESSAGES: Record<string, [number, string]> = {
  UNAUTHENTICATED: [401, 'يجب تسجيل الدخول'],
  PERMISSION_DENIED: [403, 'لا تملك الصلاحية اللازمة لهذه العملية'],
  MFA_REQUIRED: [403, 'هذه العملية تتطلب تفعيل المصادقة الثنائية (AAL2)'],
  SECURITY_BLOCK: [409, 'العملية ممنوعة لأسباب أمنية'],
  INVALID_IMEI: [400, 'رقم IMEI غير صالح'],
  INVALID_TRANSITION: [409, 'انتقال الحالة غير مسموح'],
  CONSENT_REQUIRED: [400, 'موافقة المالك إلزامية'],
  JUSTIFICATION_REQUIRED: [400, 'مبرر الوصول إلزامي'],
  NOT_FOUND: [404, 'العنصر غير موجود'],
  APPEND_ONLY: [403, 'هذا السجل غير قابل للتعديل'],
  RATE_LIMITED: [429, 'عدد كبير من الطلبات، حاول لاحقًا'],
};

export function fail(error: unknown, fallbackStatus = 400): Response {
  const raw = typeof error === 'string' ? error : ((error as { message?: string })?.message ?? 'خطأ غير متوقع');
  const code = raw.split(':')[0].trim();
  const [status, message] = MESSAGES[code] ?? [fallbackStatus, raw];
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
