import { serveEndpoint } from '../_shared/handler.ts';
import { adminClient } from '../_shared/client.ts';

serveEndpoint({ name: 'media-create-upload-url' }, async ({ db, userId, body }) => {
  const { data: allowed } = await db.rpc('has_permission', { p_permission: 'create_device' });
  if (!allowed) throw new Error('PERMISSION_DENIED: رفع وسائط الأجهزة');
  const path = `${body.device_id}/${userId}/${crypto.randomUUID()}`;
  const admin = adminClient();
  const { data, error } = await admin.storage.from('device-media').createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token, signedUrl: data.signedUrl };
});
