import { supabase } from './supabase';
import { SUPABASE_URL } from './config';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** كل استدعاءات الخادم تمر عبر Edge Functions — الواجهة لا تلمس الجداول مباشرة */
export async function callFunction<T = unknown>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  let payload: { ok?: boolean; data?: T; error?: { code: string; message: string } } = {};
  try { payload = await res.json(); } catch { /* استجابة غير JSON */ }

  if (!res.ok || payload.ok === false) {
    throw new ApiError(
      payload.error?.code ?? 'UNKNOWN',
      payload.error?.message ?? `تعذّر تنفيذ الطلب (${res.status})`,
      res.status,
    );
  }
  return payload.data as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'حدث خطأ غير متوقع';
}
