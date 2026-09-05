import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'security-event', rateLimit: 120 }, async ({ db, body }) => rpc(db, 'op_ingest_auth_event', { p_event: body.event, p_details: body.details ?? {} }));
