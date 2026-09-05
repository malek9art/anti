import { serveEndpoint, rpc } from '../_shared/handler.ts';
import { adminClient } from '../_shared/client.ts';

serveEndpoint({ name: 'evidence-download-url' }, async ({ db, body }) => {
  const target = await rpc(db, 'op_authorize_evidence_download', {
    p_evidence_id: body.evidence_id, p_purpose: body.purpose ?? null,
  });
  const admin = adminClient();
  const { data, error } = await admin.storage.from(target.bucket).createSignedUrl(target.path, 120);
  if (error) throw new Error(error.message);
  return { url: data.signedUrl, expires_in: 120 };
});
