import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-security-events' }, async ({ db, body }) => rpc(db, 'op_get_security_events', { p_limit: body.limit ?? 100 }));
