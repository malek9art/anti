import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'update-system-setting' }, async ({ db, body }) => rpc(db, 'op_update_system_setting', { p_key: body.key, p_value: body.value }));
