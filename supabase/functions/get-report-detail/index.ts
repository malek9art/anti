import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-report-detail' }, async ({ db, body }) => rpc(db, 'op_get_report_detail', { p_report_id: body.report_id }));
