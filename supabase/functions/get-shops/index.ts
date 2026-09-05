import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-shops' }, async ({ db, body }) => rpc(db, 'op_get_shops', { p_status: body.status ?? null }));
