import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-users' }, async ({ db, body }) => rpc(db, 'op_get_users', { p_limit: body.limit ?? 100 }));
