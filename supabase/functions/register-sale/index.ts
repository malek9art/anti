import { serveEndpoint, rpc } from '../_shared/handler.ts';

serveEndpoint({ name: 'register-sale' }, async ({ db, body }) => rpc(db, 'op_register_sale', {
  p_shop_id: body.shop_id, p_device_id: body.device_id, p_price: body.price,
  p_warranty_months: body.warranty_months ?? 0,
  p_name_encrypted: body.name_encrypted, p_phone_encrypted: body.phone_encrypted,
  p_national_id_encrypted: body.national_id_encrypted ?? null,
  p_name_hash: body.name_hash, p_phone_hash: body.phone_hash,
  p_national_id_hash: body.national_id_hash ?? null }));
