import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState } from '../components/States';
import { formatNumber, ROLE_AR } from '../lib/format';

interface Dash { [k: string]: number }

interface QuickAction { to: string; icon: string; label: string }

/** مهام كل دور — واجهة مخصصة حسب صلاحياته */
const ROLE_ACTIONS: Record<string, QuickAction[]> = {
  system_admin: [
    { to: '/users', icon: '👥', label: 'إدارة المستخدمين وطلبات التفعيل' },
    { to: '/shops', icon: '🏪', label: 'اعتماد المحلات' },
    { to: '/security', icon: '🛡️', label: 'الأحداث الأمنية' },
    { to: '/audit', icon: '📜', label: 'سجل التدقيق' },
    { to: '/analytics', icon: '📊', label: 'التقارير والتحليلات' },
    { to: '/settings', icon: '⚙️', label: 'الإعدادات والهوية' },
  ],
  authorized_officer: [
    { to: '/reports', icon: '🚨', label: 'بلاغات السرقة' },
    { to: '/devices', icon: '📱', label: 'سجل الأجهزة' },
    { to: '/my-tasks', icon: '📋', label: 'مهامي المحالة' },
    { to: '/security', icon: '🛡️', label: 'الأحداث الأمنية' },
    { to: '/check-imei', icon: '🔎', label: 'فحص IMEI' },
  ],
  investigation_officer: [
    { to: '/reports', icon: '🚨', label: 'البلاغات والتحقيقات' },
    { to: '/devices', icon: '📱', label: 'سجل الأجهزة' },
    { to: '/my-tasks', icon: '📋', label: 'قضاياي' },
    { to: '/check-imei', icon: '🔎', label: 'فحص IMEI' },
  ],
  delegate: [
    { to: '/my-tasks', icon: '📋', label: 'مهامي الميدانية' },
    { to: '/reports', icon: '🚨', label: 'البلاغات' },
    { to: '/check-imei', icon: '🔎', label: 'فحص IMEI' },
  ],
  shop_manager: [
    { to: '/check-imei', icon: '🔎', label: 'فحص جهاز قبل الشراء' },
    { to: '/sales', icon: '🧾', label: 'تسجيل عملية بيع' },
    { to: '/service', icon: '🛠️', label: 'استلام جهاز صيانة' },
    { to: '/devices', icon: '📱', label: 'أجهزة محلي' },
  ],
  technician: [
    { to: '/check-imei', icon: '🔎', label: 'فحص IMEI قبل العمل' },
    { to: '/service', icon: '🛠️', label: 'استلام صيانة' },
    { to: '/devices', icon: '📱', label: 'سجل الأجهزة' },
  ],
  auditor: [
    { to: '/audit', icon: '📜', label: 'سجل التدقيق' },
    { to: '/analytics', icon: '📊', label: 'التقارير' },
    { to: '/security', icon: '🛡️', label: 'الأحداث الأمنية' },
  ],
};

export function Dashboard() {
  const { profile, roles, isAal2 } = useAuth();
  const { data, loading, error, reload } = useApi<Dash>('get-dashboard');
  const notifications = useApi<Array<{ id: string; title: string; body: string; severity: string; created_at: string }>>(
    'get-notifications', { limit: 6 });

  const cards = [
    { key: 'devices_total', label: 'إجمالي الأجهزة', gold: true },
    { key: 'devices_flagged', label: 'أجهزة تحت التنبيه', alert: true },
    { key: 'reports_active', label: 'بلاغات نشطة', alert: true },
    { key: 'reports_recovered', label: 'أجهزة مستردة' },
    { key: 'sales_total', label: 'عمليات البيع' },
    { key: 'repairs_total', label: 'عمليات الصيانة' },
    { key: 'formats_total', label: 'عمليات الفرمتة' },
    { key: 'shops_pending', label: 'محلات بانتظار الاعتماد' },
    { key: 'my_assignments', label: 'قضايا محالة إليّ', gold: true },
  ];

  // دمج مهام الأدوار المسندة دون تكرار
  const actions: QuickAction[] = [];
  const seen = new Set<string>();
  for (const r of roles) {
    for (const a of ROLE_ACTIONS[r] ?? []) {
      if (!seen.has(a.to)) { seen.add(a.to); actions.push(a); }
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>مرحبًا، {profile?.full_name ?? 'مستخدم'}</h1>
          <p>{roles.length ? `دورك: ${roles.map((r) => ROLE_AR[r] ?? r).join('، ')}` : 'لم تُسند إليك أدوار بعد — راجع مدير النظام'}</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--gold" to="/check-imei">🔎 فحص IMEI</Link>
        </div>
      </div>

      {!isAal2 ? (
        <div className="alert alert--warn" role="alert">
          🔐 جلستك الحالية AAL1. العمليات الحساسة (البيع، الفرمتة، البلاغات، الإدارة) ستُرفض حتى تفعّل
          المصادقة الثنائية من <Link to="/account">صفحة الأمان</Link>.
        </div>
      ) : null}

      {actions.length > 0 ? (
        <section className="card" style={{ marginBottom: 18 }}>
          <div className="card__head"><h2>مهامك السريعة</h2></div>
          <div className="card__body">
            <div className="role-grid">
              {actions.map((a) => (
                <Link key={a.to} to={a.to} className="role-card role-card--link">
                  <span className="role-card__icon" aria-hidden>{a.icon}</span>
                  <span className="role-card__title">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {loading ? <LoadingState label="جارٍ تحميل المؤشرات…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data ? (
        <div className="grid grid--stats" style={{ marginBottom: 18 }}>
          {cards.map((c) => (
            <div key={c.key} className={`stat${c.alert && Number(data[c.key]) > 0 ? ' stat--alert' : ''}${c.gold ? ' stat--gold' : ''}`}>
              <p className="stat__label">{c.label}</p>
              <div className="stat__value">{formatNumber(data[c.key])}</div>
            </div>
          ))}
        </div>
      ) : null}

      <section className="card">
        <div className="card__head"><h2>آخر التنبيهات</h2></div>
        <div className="card__body">
          {notifications.loading ? <LoadingState /> : null}
          {notifications.error ? <ErrorState message={notifications.error} onRetry={notifications.reload} /> : null}
          {notifications.data && notifications.data.length === 0 ? (
            <p style={{ color: 'var(--muted)', margin: 0 }}>لا توجد تنبيهات حاليًا.</p>
          ) : null}
          <ul className="timeline">
            {(notifications.data ?? []).map((n) => (
              <li key={n.id}>
                <div className="timeline__title">{n.title}</div>
                <div className="timeline__meta">{n.body}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
