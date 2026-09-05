export const DEVICE_STATUS_AR: Record<string, string> = {
  registered: 'مُسجَّل', sold: 'مُباع', in_repair: 'قيد الصيانة', formatted: 'تمت الفرمتة',
  reported_stolen: 'مُبلَّغ عنه', under_alert: 'تحت التنبيه', recovered: 'مُسترد', retired: 'خارج الخدمة',
};

export const REPORT_STATUS_AR: Record<string, string> = {
  draft: 'مسودة', submitted: 'مُقدَّم', under_review: 'قيد المراجعة', verified: 'تم التحقق',
  active: 'نشط', assigned: 'مُحال', recovered: 'تم الاسترداد', closed: 'مغلق', rejected: 'مرفوض',
};

export const PRIORITY_AR: Record<string, string> = {
  low: 'منخفضة', normal: 'عادية', high: 'عالية', critical: 'حرجة',
};

export const SHOP_STATUS_AR: Record<string, string> = {
  pending: 'قيد الاعتماد', approved: 'معتمد', suspended: 'معلّق', rejected: 'مرفوض',
};

export const ACCOUNT_STATUS_AR: Record<string, string> = {
  invited: 'مدعو', active: 'نشط', suspended: 'موقوف', disabled: 'معطّل',
};

export const ROLE_AR: Record<string, string> = {
  system_admin: 'مدير النظام', authorized_officer: 'ضابط مخوّل', investigation_officer: 'ضابط تحقيق',
  delegate: 'مندوب', shop_manager: 'مدير محل', technician: 'فني', auditor: 'مدقّق',
};

const dateFmt = new Intl.DateTimeFormat('ar', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('ar').format(Number.isFinite(n) ? n : 0);
}

export function formatMoney(value: number | string | null | undefined): string {
  return `${formatNumber(value)} ر.س`;
}
