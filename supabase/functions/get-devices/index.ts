import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-devices' }, async ({ db, body }) => rpc(db, 'op_get_devices', { p_search: body.search ?? null, p_limit: body.limit ?? 50 }));
