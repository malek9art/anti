import { serveEndpoint, rpc } from '../_shared/handler.ts';
import { adminClient } from '../_shared/client.ts';

serveEndpoint({ name: 'media-download-url' }, async ({ db, body }) => {
  const target = await rpc(db, 'op_authorize_device_media_download', { p_media_id: body.media_id });
  const admin = adminClient();
  const { data, error } = await admin.storage.from(target.bucket).createSignedUrl(target.path, 120);
  if (error) throw new Error(error.message);
  return { url: data.signedUrl, expires_in: 120 };
});
