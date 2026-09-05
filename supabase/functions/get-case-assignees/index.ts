import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-case-assignees' }, async ({ db, body }) => rpc(db, 'op_get_case_assignees', {}));
