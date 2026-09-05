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
          <h1>حسابك بانتظار التفعيل</h1>
          <div className="auth-card__rule" />
        </div>
        <div className="alert alert--warn" role="status">
          {!registered
            ? 'تم إنشاء حسابك في نظام المصادقة، لكنه غير مربوط بملف مستخدم في المنصة بعد. راجع مدير النظام لتفعيله وإسناد الأدوار.'
            : `حسابك (${profile?.email ?? ''}) غير نشط أو لم تُسند إليه أدوار بعد. راجع مدير النظام.`}
        </div>
        <button type="button" className="btn btn--block" onClick={() => void refresh()}>تحديث الحالة</button>
        <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }}
          onClick={() => void signOut()}>تسجيل الخروج</button>
      </div>
    </div>
  );
}
