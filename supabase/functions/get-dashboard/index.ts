import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-dashboard' }, async ({ db, body }) => rpc(db, 'op_get_dashboard', {}));
