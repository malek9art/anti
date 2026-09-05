import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'correct-record' }, async ({ db, body }) => rpc(db, 'op_correct_record', {
  p_entity_type: body.entity_type, p_entity_id: body.entity_id, p_field: body.field,
  p_old: body.old_value ?? null, p_new: body.new_value ?? null, p_reason: body.reason }));
