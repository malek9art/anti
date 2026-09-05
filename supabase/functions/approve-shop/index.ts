import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'approve-shop' }, async ({ db, body }) => rpc(db, 'op_approve_shop', { p_shop_id: body.shop_id }));
