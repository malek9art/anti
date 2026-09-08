import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-signup-requests' }, async ({ db, body }) =>
  rpc(db, 'op_get_signup_requests', { p_limit: body.limit ?? 100 }));
