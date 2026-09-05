import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'mark-notification-read' }, async ({ db, body }) => rpc(db, 'op_mark_notification_read', { p_id: body.id }));
