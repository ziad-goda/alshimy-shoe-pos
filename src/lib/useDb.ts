import { useEffect, useState, useRef } from "react";
import { getDb, query, subscribe } from "./db";

export function useQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  deps: unknown[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  // debounce timer so rapid changes (like typing) don't trigger blocking SQL.js queries on every keystroke
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // create stable keys for params and deps to use in the effect deps
  const paramsKey = JSON.stringify(params);
  const depsKey = JSON.stringify(deps);
  const key = `${sql}::${paramsKey}::${depsKey}`;

  // perform the actual query (synchronous sql.js operations happen inside but are called less frequently)
  // we yield to the event loop / requestIdleCallback before executing heavy SQL work so input event handlers
  // complete and the UI stays responsive in packaged environments.
  const fetchNow = async () => {
    try {
      // give the browser a chance to finish current input events and render work
      if (typeof window !== "undefined") {
        if ("requestIdleCallback" in window) {
          await new Promise<void>((res) => (window as any).requestIdleCallback(() => res(), { timeout: 50 }));
        } else {
          await new Promise((res) => setTimeout(res, 0));
        }
      }

      await getDb();
      const r = await query<T>(sql, params);
      if (!mountedRef.current) return;
      setData(r);
      setLoading(false);
    } catch (e) {
      // swallow errors here to avoid breaking render — the app can handle empty/failed queries
      console.error("useQuery fetch error:", e);
      if (!mountedRef.current) return;
      setLoading(false);
    }
  };

  // schedule a debounced fetch; delay chosen small so UI feels responsive but avoids blocking on every keystroke
  const scheduleFetch = (delay = 120) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // use setTimeout to debounce; this also yields to the main loop
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void fetchNow();
    }, delay) as unknown as number;
  };

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    // initial fetch is debounced slightly to avoid blocking during rapid UI updates
    scheduleFetch(80);

    // subscribe to DB changes — when notified we schedule a debounced fetch
    const unsub = subscribe(() => {
      // schedule fetch with a slightly larger delay to coalesce rapid writes
      scheduleFetch(120);
    });

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      unsub();
    };
    // key intentionally includes params and deps so effect reruns only when query parameters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, refresh: fetchNow };
}
