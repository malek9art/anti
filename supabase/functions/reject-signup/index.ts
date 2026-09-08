import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'reject-signup' }, async ({ db, body }) => {
  if (!body.request_id) throw new Error('INVALID_INPUT: معرّف الطلب مطلوب');
  return rpc(db, 'op_reject_signup', { p_request_id: body.request_id, p_reason: body.reason ?? null });
});
