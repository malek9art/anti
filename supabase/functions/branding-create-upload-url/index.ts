import { serveEndpoint } from '../_shared/handler.ts';
import { adminClient } from '../_shared/client.ts';

const ALLOWED = ['image/png', 'image/svg+xml', 'image/webp'];

serveEndpoint({ name: 'branding-create-upload-url' }, async ({ db, aal, body }) => {
  if (aal !== 'aal2') throw new Error('MFA_REQUIRED: تغيير الشعار يتطلب AAL2');
  const { data: allowed } = await db.rpc('has_permission', { p_permission: 'manage_system_settings' });
  if (!allowed) throw new Error('PERMISSION_DENIED: إدارة الهوية البصرية');

  const contentType = String(body.content_type ?? 'image/png');
  if (!ALLOWED.includes(contentType)) {
    throw new Error('INVALID_INPUT: يُسمح بصيغ PNG أو SVG أو WEBP فقط');
  }
  const ext = contentType === 'image/svg+xml' ? 'svg' : contentType === 'image/webp' ? 'webp' : 'png';
  const path = `logo/${crypto.randomUUID()}.${ext}`;

  const admin = adminClient();
  const { data, error } = await admin.storage.from('branding').createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token, signedUrl: data.signedUrl };
});
