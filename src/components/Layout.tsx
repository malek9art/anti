import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { callFunction } from '../lib/api';
import { APP_FULL_NAME, APP_NAME } from '../lib/config';

interface NavItem { to: string; label: string; icon: string; permission?: string; group: string; mobile?: boolean }

const NAV: NavItem[] = [
  { to: '/', label: 'لوحة التحكم', icon: '🏠', group: 'الرئيسية', permission: 'view_dashboard', mobile: true },
  { to: '/check-imei', label: 'فحص IMEI', icon: '🔎', group: 'الرئيسية', permission: 'search_imei', mobile: true },
  { to: '/devices', label: 'الأجهزة', icon: '📱', group: 'العمليات', permission: 'view_device', mobile: true },
  { to: '/sales', label: 'المبيعات', icon: '🧾', group: 'العمليات', permission: 'create_sale' },
  { to: '/service', label: 'الصيانة والفرمتة', icon: '🛠️', group: 'العمليات', permission: 'create_repair' },
  { to: '/reports', label: 'بلاغات السرقة', icon: '🚨', group: 'البلاغات', mobile: true },
  { to: '/my-tasks', label: 'مهامي', icon: '📋', group: 'البلاغات', permission: 'update_follow_up', mobile: true },
  { to: '/notifications', label: 'التنبيهات', icon: '🔔', group: 'الرئيسية' },
  { to: '/shops', label: 'المحلات', icon: '🏪', group: 'الجهات' },
  { to: '/users', label: 'المستخدمون', icon: '👥', group: 'الإدارة', permission: 'manage_users' },
  { to: '/audit', label: 'سجل التدقيق', icon: '📜', group: 'الرقابة', permission: 'view_audit_logs' },
  { to: '/security', label: 'الأحداث الأمنية', icon: '🛡️', group: 'الرقابة', permission: 'view_security_events' },
  { to: '/analytics', label: 'التقارير', icon: '📊', group: 'الرقابة', permission: 'generate_reports' },
  { to: '/settings', label: 'إعدادات النظام', icon: '⚙️', group: 'الإدارة', permission: 'manage_system_settings' },
  { to: '/account', label: 'حسابي والأمان', icon: '🔐', group: 'الإدارة', mobile: true },
];

export function Layout() {
  const { profile, can, signOut, aal } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = () => {
      callFunction<Array<{ is_read: boolean }>>('get-notifications', { limit: 50 })
        .then((list) => { if (alive) setUnread(list.filter((n) => !n.is_read).length); })
        .catch(() => undefined);
    };
    load();
    const t = window.setInterval(load, 60000);
    return () => { alive = false; window.clearInterval(t); };
  }, [location.pathname]);

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visible = NAV.filter((item) => !item.permission || can(item.permission));
  const groups = [...new Set(visible.map((i) => i.group))];
  const mobileItems = visible.filter((i) => i.mobile).slice(0, 5);
  const current = visible.find((i) => i.to === location.pathname);

  return (
    <div className="app-shell">
      {open ? <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <nav className={`sidebar${open ? ' sidebar--open' : ''}`} aria-label="القائمة الرئيسية">
        <div className="sidebar__brand">
          <Logo size={44} />
          <div>
            <strong>{APP_NAME}</strong>
            <span>نظام مكافحة سرقة الأجهزة</span>
          </div>
        </div>
        <div className="sidebar__nav">
          {groups.map((g) => (
            <div key={g}>
              <div className="sidebar__group">{g}</div>
              {visible.filter((i) => i.group === g).map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
                  <span className="nav-link__icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar__footer">
          {aal === 'aal2' ? '🔐 جلسة موثّقة (AAL2)' : '⚠️ جلسة AAL1 — فعّل المصادقة الثنائية'}
        </div>
      </nav>

      <div className="main-col">
        <header className="topbar">
          <button
            type="button"
            className="btn btn--ghost btn--sm hamburger"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen((v) => !v)}
          >
            ☰ <span className="sr-only">القائمة</span>
          </button>
          <div className="topbar__logo"><Logo size={34} /></div>
          <h1 className="topbar__title">{current?.label ?? APP_FULL_NAME}</h1>
          <div className="topbar__spacer" />
          <button
            type="button"
            className="btn btn--ghost btn--sm topbar__bell"
            onClick={() => navigate('/notifications')}
            aria-label={`التنبيهات — ${unread} غير مقروءة`}
            title="مركز التنبيهات"
          >
            🔔
            {unread > 0 ? <span className="topbar__bell-badge">{unread > 99 ? '99+' : unread}</span> : null}
          </button>
          <div className="topbar__user">
            <strong>{profile?.full_name ?? 'مستخدم'}</strong>
            {profile?.email}
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void signOut()}>
            خروج
          </button>
        </header>

        <main id="main" className="content" tabIndex={-1}>
          <div className="print-header">
            <Logo size={56} />
            <strong>{APP_FULL_NAME}</strong>
          </div>
          <Outlet />
        </main>
      </div>

      <nav className="bottombar" aria-label="التنقل السريع">
        {mobileItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
            <span className="bottombar__icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
