import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'reset-branding-logo' }, async ({ db }) => {
  await rpc(db, 'op_reset_branding_logo');
  return { reset: true };
});
