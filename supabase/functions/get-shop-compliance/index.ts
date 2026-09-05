import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-shop-compliance' }, async ({ db, body }) =>
  rpc(db, 'op_get_shop_compliance', { p_from: body.from, p_to: body.to }));
