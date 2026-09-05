import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'suspend-shop' }, async ({ db, body }) => rpc(db, 'op_suspend_shop', { p_shop_id: body.shop_id, p_reason: body.reason }));
