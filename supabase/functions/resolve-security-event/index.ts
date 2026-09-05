import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'resolve-security-event' }, async ({ db, body }) => rpc(db, 'op_resolve_security_event', { p_id: body.id, p_note: body.note ?? null }));
