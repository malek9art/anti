import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'add-report-follow-up' }, async ({ db, body }) => rpc(db, 'op_add_report_follow_up', {
  p_report_id: body.report_id, p_body: body.body, p_internal: body.internal !== false }));
