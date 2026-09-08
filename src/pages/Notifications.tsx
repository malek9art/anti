import { useMemo, useState } from 'react';
import { callFunction, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { formatDate } from '../lib/format';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'important' | 'critical';
  notification_type?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
  created_at: string;
}

const SEVERITY_AR: Record<string, string> = {
  info: 'معلومة',
  warning: 'تنبيه',
  important: 'مهم',
  critical: 'حرج',
};

const SEVERITY_BADGE: Record<string, string> = {
  info: 'badge badge--info',
  warning: 'badge badge--warn',
  important: 'badge badge--gold',
  critical: 'badge badge--danger',
};

const SEVERITY_ICON: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  important: '❗',
  critical: '🚨',
};

type Filter = 'all' | 'unread' | 'info' | 'warning' | 'important' | 'critical';

export function Notifications() {
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useApi<NotificationItem[]>('get-notifications', { limit: 100 });

  const items = useMemo(() => {
    const all = query.data ?? [];
    if (filter === 'all') return all;
    if (filter === 'unread') return all.filter((n) => !n.is_read);
    return all.filter((n) => n.severity === filter);
  }, [query.data, filter]);

  const unreadCount = (query.data ?? []).filter((n) => !n.is_read).length;

  async function markRead(id: string) {
    setBusyId(id); setActionError(null);
    try {
      await callFunction('mark-notification-read', { id });
      query.reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    const unread = (query.data ?? []).filter((n) => !n.is_read);
    if (unread.length === 0) return;
    setBusyId('all'); setActionError(null);
    try {
      for (const n of unread) await callFunction('mark-notification-read', { id: n.id });
      query.reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const FILTERS: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: 'الكل' },
    { key: 'unread', label: `غير المقروءة (${unreadCount})` },
    { key: 'critical', label: 'حرج' },
    { key: 'important', label: 'مهم' },
    { key: 'warning', label: 'تنبيه' },
    { key: 'info', label: 'معلومة' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>مركز التنبيهات</h1>
          <p>تنبيهات النظام المصنّفة حسب مستوى الخطورة — تصلك فور وقوع الأحداث المهمة.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn--ghost" onClick={() => void markAllRead()}
            disabled={busyId !== null || unreadCount === 0}>
            تعليم الكل كمقروء
          </button>
        </div>
      </div>

      {actionError ? <div className="alert alert--error" role="alert">{actionError}</div> : null}

      <div className="auth-tabs" role="tablist" aria-label="تصفية التنبيهات" style={{ marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {query.loading ? <LoadingState /> : null}
      {query.error ? <ErrorState message={query.error} onRetry={query.reload} /> : null}

      {query.data && items.length === 0 ? (
        <div className="card"><div className="card__body">
          <EmptyState title="لا توجد تنبيهات" description="ستظهر هنا التنبيهات الأمنية والإدارية فور صدورها." />
        </div></div>
      ) : null}

      {items.length > 0 ? (
        <div className="card"><div className="card__body" style={{ display: 'grid', gap: 10 }}>
          {items.map((n) => (
            <article key={n.id} className="card" style={{
              borderInlineStart: `4px solid ${n.severity === 'critical' ? 'var(--danger)' : n.severity === 'important' ? 'var(--gold-500)' : n.severity === 'warning' ? 'var(--warn)' : 'var(--green-600)'}`,
              opacity: n.is_read ? 0.75 : 1,
            }}>
              <div className="card__body" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span aria-hidden="true" style={{ fontSize: 22 }}>{SEVERITY_ICON[n.severity] ?? 'ℹ️'}</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{n.title}</strong>
                    <span className={SEVERITY_BADGE[n.severity] ?? 'badge'}>{SEVERITY_AR[n.severity] ?? n.severity}</span>
                    {!n.is_read ? <span className="badge badge--ok">جديد</span> : null}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>{n.body}</p>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>{formatDate(n.created_at)}</div>
                </div>
                {!n.is_read ? (
                  <button type="button" className="btn btn--ghost btn--sm"
                    disabled={busyId !== null}
                    onClick={() => void markRead(n.id)}>
                    {busyId === n.id ? 'جارٍ…' : 'تعليم كمقروء'}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div></div>
      ) : null}
    </div>
  );
}
