import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'approve-signup' }, async ({ db, body }) => {
  if (!body.request_id) throw new Error('INVALID_INPUT: معرّف الطلب مطلوب');
  return rpc(db, 'op_approve_signup', { p_request_id: body.request_id });
});
