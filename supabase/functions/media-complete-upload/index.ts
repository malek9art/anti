import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'media-complete-upload' }, async ({ db, body }) =>
  rpc(db, 'op_register_device_media', {
    p_device_id: body.device_id, p_path: body.path,
    p_media_type: body.media_type ?? 'image', p_caption: body.caption ?? null,
  }));
