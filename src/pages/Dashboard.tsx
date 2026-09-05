import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState } from '../components/States';
import { formatNumber } from '../lib/format';

interface Dash { [k: string]: number }

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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>مرحبًا، {profile?.full_name ?? 'مستخدم'}</h1>
          <p>{roles.length ? `أدوارك: ${roles.length}` : 'لم تُسند إليك أدوار بعد — راجع مدير النظام'}</p>
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
