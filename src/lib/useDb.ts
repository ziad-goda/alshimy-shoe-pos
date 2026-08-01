import { useCallback, useEffect, useRef, useState } from "react";
import { query, subscribe } from "./db";

/**
 * Reactive SQL query hook.
 *
 * - Re-runs ONLY when the SQL text or the serialized params change, or when the
 *   database notifies a write. It never re-runs because of a new array identity,
 *   so it cannot cause an infinite render loop.
 * - Writes/keystrokes are debounced and stale responses are discarded via a
 *   monotonically increasing run id.
 */
export function useQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const paramsKey = JSON.stringify(params) + "::" + JSON.stringify(deps);


  // Keep the latest values without making them effect dependencies.
  const sqlRef = useRef(sql);
  const paramsRef = useRef(params);
  sqlRef.current = sql;
  paramsRef.current = params;

  const runIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const run = useCallback(async () => {
    const id = ++runIdRef.current;
    try {
      const rows = await query<T>(sqlRef.current, paramsRef.current);
      if (!mountedRef.current || id !== runIdRef.current) return;
      setData(rows);
    } catch (e) {
      console.error("useQuery error:", e);
    } finally {
      if (mountedRef.current && id === runIdRef.current) setLoading(false);
    }
  }, []);

  const schedule = useCallback(
    (delay: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void run();
      }, delay);
    },
    [run],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Fetch on query/params change.
  useEffect(() => {
    schedule(60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, paramsKey]);

  // Refetch on database writes.
  useEffect(() => {
    const unsub = subscribe(() => schedule(120));
    return () => {
      unsub();
    };
  }, [schedule]);

  return { data, loading, refresh: run };
}
