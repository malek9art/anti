import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-reports' }, async ({ db, body }) => rpc(db, 'op_get_reports', { p_status: body.status ?? null, p_limit: body.limit ?? 50 }));
