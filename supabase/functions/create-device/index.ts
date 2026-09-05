import { serveEndpoint, rpc } from '../_shared/handler.ts';
import { isValidImei } from '../_shared/imei.ts';

serveEndpoint({ name: 'create-device' }, async ({ db, body }) => {
  const primary = String(body.imei_primary ?? '').trim();
  const secondary = body.imei_secondary ? String(body.imei_secondary).trim() : null;
  if (!isValidImei(primary)) throw new Error('INVALID_IMEI: رقم IMEI الأساسي غير صالح');
  if (secondary && !isValidImei(secondary)) throw new Error('INVALID_IMEI: رقم IMEI الثانوي غير صالح');
  return rpc(db, 'op_create_device', {
    p_brand: body.brand, p_model: body.model, p_color: body.color ?? null,
    p_serial: body.serial ?? null, p_imei_primary: primary,
    p_imei_secondary: secondary, p_shop_id: body.shop_id ?? null,
  });
});
