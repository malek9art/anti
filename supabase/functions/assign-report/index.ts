import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'assign-report' }, async ({ db, body }) => rpc(db, 'op_assign_report', {
  p_report_id: body.report_id, p_assignee: body.assignee, p_agency: body.agency ?? null }));
