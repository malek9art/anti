import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-notifications' }, async ({ db, body }) => rpc(db, 'op_get_notifications', { p_limit: body.limit ?? 50 }));
