import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'set-branding-logo' }, async ({ db, body }) =>
  rpc(db, 'op_set_branding_logo', { p_path: body.path }));
