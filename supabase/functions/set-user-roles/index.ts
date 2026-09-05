import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'set-user-roles' }, async ({ db, body }) => rpc(db, 'op_set_user_roles', { p_user_id: body.user_id, p_roles: body.roles }));
