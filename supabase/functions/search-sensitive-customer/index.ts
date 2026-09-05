import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'search-sensitive-customer', rateLimit: 30 }, async ({ db, body }) => rpc(db, 'op_search_sensitive_customer', { p_hash: body.hash }));
