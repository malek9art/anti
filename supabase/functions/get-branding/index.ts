import { serveEndpoint, rpc } from '../_shared/handler.ts';

// عام: شاشة الدخول تحتاج الشعار قبل المصادقة
serveEndpoint({ name: 'get-branding', anonymous: true }, async ({ db }) => rpc(db, 'op_get_branding'));
