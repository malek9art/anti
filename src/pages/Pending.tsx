import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';

/** يظهر عندما ينجح تسجيل الدخول لكن الحساب غير مُفعَّل أو بلا أدوار */
export function Pending() {
  const { profile, registered, signOut, refresh } = useAuth();
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <Logo size={80} />
          <h1>طلب التفعيل قيد المراجعة</h1>
          <div className="auth-card__rule" />
        </div>
        <div className="alert alert--warn" role="status">
          {!registered
            ? 'تم إنشاء حسابك في نظام المصادقة، وطلب التفعيل الخاص بك بانتظار موافقة الإدارة. ستتمكن من الدخول فور الموافقة.'
            : `حسابك (${profile?.email ?? ''}) بانتظار موافقة الإدارة على طلب التفعيل. بمجرد الموافقة اضغط «تحديث الحالة» للدخول.`}
        </div>
        <button type="button" className="btn btn--block" onClick={() => void refresh()}>تحديث الحالة</button>
        <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }}
          onClick={() => void signOut()}>تسجيل الخروج</button>
      </div>
    </div>
  );
}
