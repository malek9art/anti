import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'update-report-status' }, async ({ db, body }) => rpc(db, 'op_update_report_status', {
  p_report_id: body.report_id, p_to_status: body.to_status, p_note: body.note ?? null }));
