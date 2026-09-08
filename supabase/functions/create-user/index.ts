import { serveEndpoint } from '../_shared/handler.ts';
import { adminClient } from '../_shared/client.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serveEndpoint({ name: 'create-user', rateLimit: 10 }, async ({ db, aal, body }) => {
  if (aal !== 'aal2') throw new Error('MFA_REQUIRED: إنشاء المستخدمين يتطلب جلسة موثّقة (AAL2)');

  const { data: allowed } = await db.rpc('has_permission', { p_permission: 'manage_users' });
  if (!allowed) throw new Error('PERMISSION_DENIED: إدارة المستخدمين');

  const fullName = String(body.full_name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const roles: string[] = Array.isArray(body.roles)
    ? body.roles.map((r) => String(r)).filter(Boolean).slice(0, 10)
    : [];

  if (fullName.length < 3) throw new Error('INVALID_INPUT: الاسم الكامل مطلوب (3 أحرف على الأقل)');
  if (!EMAIL_RE.test(email)) throw new Error('INVALID_INPUT: بريد إلكتروني غير صالح');
  if (password.length < 10) throw new Error('INVALID_INPUT: كلمة المرور يجب أن تكون 10 أحرف على الأقل');

  const admin = adminClient();

  // 1) إنشاء حساب المصادقة (بريد مؤكَّد فورًا — الإدارة هي من أنشأ الحساب)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr) {
    const m = createErr.message.toLowerCase();
    if (m.includes('already been registered') || m.includes('already exists')) {
      throw new Error('DUPLICATE: هذا البريد مسجّل مسبقًا');
    }
    throw new Error(createErr.message);
  }
  const newId = created.user?.id;
  if (!newId) throw new Error('تعذّر إنشاء الحساب');

  // 2) الملف الشخصي + الأدوار + سجل التدقيق — عبر RPC تتحقق من الصلاحية وAAL2 داخل القاعدة
  const { error: profileErr } = await db.rpc('op_create_user_profile', {
    p_user_id: newId,
    p_full_name: fullName,
    p_email: email,
    p_roles: roles,
  });
  if (profileErr) {
    // تراجع: حذف حساب المصادقة حتى لا يبقى حسابًا يتيمًا بلا ملف شخصي
    await admin.auth.admin.deleteUser(newId).catch(() => undefined);
    throw new Error(profileErr.message);
  }

  return { id: newId, email };
});
