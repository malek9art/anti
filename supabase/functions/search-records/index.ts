import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'search-records', rateLimit: 60 }, async ({ db, body }) => rpc(db, 'op_get_devices', { p_search: body.search ?? null, p_limit: body.limit ?? 50 }));
