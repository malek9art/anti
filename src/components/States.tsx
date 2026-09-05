import type { ReactNode } from 'react';

export function LoadingState({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <div className="state__icon" aria-hidden="true">🗂️</div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <div className="state__icon" aria-hidden="true">⚠️</div>
      <h3>تعذّر إتمام العملية</h3>
      <p>{message}</p>
      {onRetry ? <button type="button" className="btn btn--ghost" onClick={onRetry}>إعادة المحاولة</button> : null}
    </div>
  );
}

export function ForbiddenState({ permission }: { permission?: string }) {
  return (
    <div className="state" role="alert">
      <div className="state__icon" aria-hidden="true">🔒</div>
      <h3>ممنوع الوصول</h3>
      <p>
        لا تملك الصلاحية اللازمة لعرض هذه الشاشة
        {permission ? ` (${permission})` : ''}. راجع مدير النظام.
      </p>
    </div>
  );
}

export function MfaRequiredState() {
  return (
    <div className="alert alert--warn" role="alert">
      🔐 هذه العملية حساسة وتتطلب مصادقة ثنائية (AAL2). فعّل المصادقة الثنائية من صفحة «الأمان» ثم أعد الدخول.
    </div>
  );
}
