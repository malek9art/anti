import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="state">
      <div className="state__icon" aria-hidden="true">🧭</div>
      <h3>الصفحة غير موجودة</h3>
      <p>الرابط الذي فتحته غير صحيح أو لم يعد متاحًا.</p>
      <Link className="btn" to="/">العودة إلى لوحة التحكم</Link>
    </div>
  );
}
