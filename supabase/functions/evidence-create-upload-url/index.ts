import { serveEndpoint } from '../_shared/handler.ts';
import { adminClient } from '../_shared/client.ts';

serveEndpoint({ name: 'evidence-create-upload-url' }, async ({ db, userId, aal, body }) => {
  if (aal !== 'aal2') throw new Error('MFA_REQUIRED: رفع الأدلة يتطلب AAL2');
  const { data: allowed } = await db.rpc('has_permission', { p_permission: 'upload_evidence' });
  if (!allowed) throw new Error('PERMISSION_DENIED: رفع الأدلة');
  const path = `${body.report_id}/${userId}/${crypto.randomUUID()}`;
  const admin = adminClient();
  const { data, error } = await admin.storage.from('evidence').createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token, signedUrl: data.signedUrl };
});
