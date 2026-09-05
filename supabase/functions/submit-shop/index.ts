import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'submit-shop' }, async ({ db, body }) => rpc(db, 'op_submit_shop', {
  p_name: body.name, p_license: body.license, p_owner: body.owner,
  p_phone: body.phone, p_address: body.address ?? null }));
