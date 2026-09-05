import { useEffect, useState } from 'react';
import { HashRouter, BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { Layout } from './components/Layout';
import { Guard } from './components/Guard';
import { LoadingState } from './components/States';
import { Login } from './pages/Login';
import { MfaChallenge } from './pages/MfaChallenge';
import { Pending } from './pages/Pending';
import { Dashboard } from './pages/Dashboard';
import { CheckImei } from './pages/CheckImei';
import { Devices } from './pages/Devices';
import { Sales } from './pages/Sales';
import { Service } from './pages/Service';
import { Reports } from './pages/Reports';
import { Shops } from './pages/Shops';
import { Users } from './pages/Users';
import { Audit } from './pages/Audit';
import { Security } from './pages/Security';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Account } from './pages/Account';
import { NotFound } from './pages/NotFound';
import { supabase } from './lib/supabase';
import { ROUTER_MODE, isConfigured } from './lib/config';

function Shell() {
  const { session, loading, registered, profile, roles } = useAuth();
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaChecked, setMfaChecked] = useState(false);

  useEffect(() => {
    if (!session) { setNeedsMfa(false); setMfaChecked(true); return; }
    let alive = true;
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!alive) return;
      setNeedsMfa(Boolean(data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'));
      setMfaChecked(true);
    });
    return () => { alive = false; };
  }, [session]);

  if (!isConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="alert alert--error" role="alert">
            إعدادات الاتصال مفقودة. تأكد من تحميل ملف <code>config.js</code> قبل وحدة التطبيق.
          </div>
        </div>
      </div>
    );
  }

  if (loading || !mfaChecked) return <div className="auth-page"><div className="auth-card"><LoadingState /></div></div>;
  if (!session) return <Login />;
  if (needsMfa) return <MfaChallenge />;
  if (!registered || profile?.status !== 'active' || roles.length === 0) return <Pending />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Guard permission="view_dashboard"><Dashboard /></Guard>} />
        <Route path="check-imei" element={<Guard permission="search_imei"><CheckImei /></Guard>} />
        <Route path="devices" element={<Guard permission="view_device"><Devices /></Guard>} />
        <Route path="sales" element={<Guard permission="create_sale"><Sales /></Guard>} />
        <Route path="service" element={<Guard permission="create_repair"><Service /></Guard>} />
        <Route path="reports" element={<Guard><Reports /></Guard>} />
        <Route path="shops" element={<Guard><Shops /></Guard>} />
        <Route path="users" element={<Guard permission="manage_users"><Users /></Guard>} />
        <Route path="audit" element={<Guard permission="view_audit_logs"><Audit /></Guard>} />
        <Route path="security" element={<Guard permission="view_security_events"><Security /></Guard>} />
        <Route path="analytics" element={<Guard permission="generate_reports"><Analytics /></Guard>} />
        <Route path="settings" element={<Guard permission="manage_system_settings"><Settings /></Guard>} />
        <Route path="account" element={<Account />} />
        <Route path="404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  // GitHub Pages لا يعيد كتابة مسارات BrowserRouter — نستخدم HashRouter افتراضيًا
  const Router = ROUTER_MODE === 'browser' ? BrowserRouter : HashRouter;
  return (
    <Router>
      <BrandingProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </BrandingProvider>
    </Router>
  );
}
