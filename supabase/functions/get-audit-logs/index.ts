import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-audit-logs' }, async ({ db, body }) => rpc(db, 'op_get_audit_logs', { p_limit: body.limit ?? 100 }));
