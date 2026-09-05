import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'revoke-other-sessions' }, async ({ db }) => {
  const { error } = await db.auth.signOut({ scope: 'others' });
  if (error) throw new Error(error.message);
  await rpc(db, 'op_ingest_auth_event', { p_event: 'revoked_other_sessions', p_details: {} });
  return { revoked: true };
});
