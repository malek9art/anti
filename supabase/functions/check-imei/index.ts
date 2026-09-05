import { serveEndpoint, rpc } from '../_shared/handler.ts';
import { isValidImei } from '../_shared/imei.ts';

serveEndpoint({ name: 'check-imei', rateLimit: 30 }, async ({ db, body }) => {
  const imei = String(body.imei ?? '').trim();
  if (!isValidImei(imei)) throw new Error('INVALID_IMEI: رقم IMEI غير صالح (فشل التحقق من خانة Luhn)');
  return rpc(db, 'op_check_imei', { p_imei: imei });
});
