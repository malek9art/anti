import { useCallback, useEffect, useState } from 'react';
import { callFunction, errorMessage } from './api';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useApi<T>(fn: string, body: Record<string, unknown> = {}, enabled = true): QueryState<T> {
  const key = JSON.stringify(body);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let alive = true;
    setLoading(true); setError(null);
    callFunction<T>(fn, JSON.parse(key) as Record<string, unknown>)
      .then((res) => { if (alive) setData(res); })
      .catch((e) => { if (alive) setError(errorMessage(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fn, key, enabled, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}
