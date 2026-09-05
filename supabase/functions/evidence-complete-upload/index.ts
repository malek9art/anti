import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'evidence-complete-upload' }, async ({ db, body }) =>
  rpc(db, 'op_register_evidence', {
    p_report_id: body.report_id, p_path: body.path,
    p_media_type: body.media_type ?? 'image', p_description: body.description ?? null,
    p_access_level: body.access_level ?? 'restricted', p_checksum: body.checksum ?? null,
  }));
