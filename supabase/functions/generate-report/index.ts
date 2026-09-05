import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'generate-report' }, async ({ db, body }) => rpc(db, 'op_generate_report', { p_kind: body.kind, p_from: body.from, p_to: body.to }));
