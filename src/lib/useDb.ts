import { useEffect, useState, useCallback } from "react";
import { getDb, query, subscribe } from "./db";

export function useQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  deps: unknown[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    await getDb();
    const r = await query<T>(sql, params);
    setData(r);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, JSON.stringify(params), ...deps]);

  useEffect(() => {
    run();
    const unsub = subscribe(() => {
      run();
    });
    return () => {
      unsub();
    };
  }, [run]);

  return { data, loading, refresh: run };
}
