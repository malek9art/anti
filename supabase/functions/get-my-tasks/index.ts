import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'get-my-tasks' }, async ({ db, body }) =>
  rpc(db, 'op_get_my_tasks', { p_limit: body.limit ?? 50 }));
