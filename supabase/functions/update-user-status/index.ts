import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'update-user-status' }, async ({ db, body }) => rpc(db, 'op_update_user_status', { p_user_id: body.user_id, p_status: body.status }));
