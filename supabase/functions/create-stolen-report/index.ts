import { serveEndpoint, rpc } from '../_shared/handler.ts';
import { isValidImei } from '../_shared/imei.ts';

serveEndpoint({ name: 'create-stolen-report' }, async ({ db, body }) => {
  const imei = String(body.imei ?? '').trim();
  if (!isValidImei(imei)) throw new Error('INVALID_IMEI: رقم IMEI غير صالح');
  return rpc(db, 'op_create_stolen_report', {
    p_imei: imei, p_incident_at: body.incident_at, p_location: body.location ?? null,
    p_narrative: body.narrative, p_priority: body.priority ?? 'normal',
    p_contact_encrypted: body.contact_encrypted ?? null,
  });
});
