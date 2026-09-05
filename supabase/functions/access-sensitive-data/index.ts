import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'access-sensitive-data', rateLimit: 20 }, async ({ db, body }) => rpc(db, 'op_access_sensitive_data', { p_customer_id: body.customer_id, p_justification: body.justification }));
