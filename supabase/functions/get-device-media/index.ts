import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-device-media' }, async ({ db, body }) =>
  rpc(db, 'op_get_device_media', { p_device_id: body.device_id }));
