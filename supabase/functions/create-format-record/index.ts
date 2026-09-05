import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'create-format-record' }, async ({ db, body }) => rpc(db, 'op_create_format_record', {
  p_device_id: body.device_id, p_shop_id: body.shop_id, p_technician_id: body.technician_id ?? null,
  p_reason: body.reason, p_consent: body.consent === true }));
