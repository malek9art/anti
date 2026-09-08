import { serveEndpoint } from '../_shared/handler.ts';
import { adminClient } from '../_shared/client.ts';

// الأدوار المتاحة للتسجيل الذاتي — حسابات الجهات المختصة ومدير النظام تُنشأ من الإدارة فقط
const SELF_ROLES = new Set(['shop_manager', 'technician', 'delegate']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serveEndpoint({ name: 'submit-signup-request', anonymous: true, rateLimit: 5 }, async ({ body }) => {
  const userId = String(body.user_id ?? '');
  const fullName = String(body.full_name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? '').trim();
  const role = String(body.role ?? '');
  const payload = (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload))
    ? body.payload as Record<string, unknown>
    : {};

  if (!userId) throw new Error('INVALID_INPUT: معرّف المستخدم مطلوب');
  if (fullName.length < 3) throw new Error('INVALID_INPUT: الاسم الكامل مطلوب (3 أحرف على الأقل)');
  if (!EMAIL_RE.test(email)) throw new Error('INVALID_INPUT: بريد إلكتروني غير صالح');
  if (!SELF_ROLES.has(role)) throw new Error('INVALID_INPUT: الدور المطلوب غير متاح للتسجيل الذاتي');

  // حصر بيانات الطلب بمفاتيح نصية بسيطة فقط (حماية من الحقن الضخم)
  const cleanPayload: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === 'string' && k.length <= 40) cleanPayload[k] = v.slice(0, 300);
  }

  const admin = adminClient();

  // تحقق أن حساب المصادقة موجود فعلًا وأن البريد يطابقه (منع انتحال الطلبات)
  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authData.user) throw new Error('NOT_FOUND: حساب المصادقة غير موجود');
  if ((authData.user.email ?? '').toLowerCase() !== email) {
    throw new Error('INVALID_INPUT: البريد لا يطابق حساب المصادقة');
  }

  // أنشئ/حدّث الملف الشخصي بحالة «مدعو» — لا يمكنه الدخول حتى الموافقة
  const { error: upErr } = await admin.from('users').upsert({
    id: userId, full_name: fullName, email, phone: phone || null, status: 'invited',
  }, { onConflict: 'id' });
  if (upErr) throw new Error(upErr.message);

  // إن وُجد طلب معلّق سابق لنفس المستخدم فأعد النجاح (عملية متمّمة)
  const { data: existing } = await admin
    .from('signup_requests').select('id').eq('user_id', userId).eq('status', 'pending').maybeSingle();
  if (existing) return { request_id: existing.id, status: 'pending' };

  const { data: req, error: reqErr } = await admin
    .from('signup_requests')
    .insert({ user_id: userId, full_name: fullName, email, phone: phone || null, requested_role: role, payload: cleanPayload })
    .select('id')
    .single();
  if (reqErr) throw new Error(reqErr.message);

  return { request_id: req.id, status: 'pending' };
});
