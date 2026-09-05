import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-device-timeline' }, async ({ db, body }) => rpc(db, 'op_get_device_timeline', { p_device_id: body.device_id }));
