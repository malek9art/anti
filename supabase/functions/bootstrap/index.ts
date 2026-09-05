import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'bootstrap' }, async ({ db, body }) => rpc(db, 'op_bootstrap_profile', {}));
