import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'link-shop-user' }, async ({ db, body }) => rpc(db, 'op_link_shop_user', { p_shop_id: body.shop_id, p_user_id: body.user_id, p_role: body.role ?? 'staff' }));
