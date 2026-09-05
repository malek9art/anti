import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'create-repair' }, async ({ db, body }) => rpc(db, 'op_create_repair', {
  p_device_id: body.device_id, p_shop_id: body.shop_id, p_technician_id: body.technician_id ?? null,
  p_fault: body.fault, p_actions: body.actions ?? null, p_cost: body.cost ?? 0 }));
