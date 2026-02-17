"use client";

import { useEffect, useRef, useState } from "react";

type UsePollingResult<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;     // true hasta la primera respuesta (ok o error)
  updating: boolean;    // true durante refresh (si ya hubo data)
  lastUpdatedAt: Date | null;
};

type Options = {
  refreshMs: number;
};

export function usePolling<T>(url: string | null, opts: Options): UsePollingResult<T> {
  const { refreshMs } = opts;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const timerRef = useRef<number | null>(null);
  const inflightRef = useRef<AbortController | null>(null);
  const mountedRef = useRef<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;

    const clear = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      inflightRef.current?.abort();
      inflightRef.current = null;
    };

    const tick = async () => {
      if (!mountedRef.current) return;
      if (!url) {
        setLoading(false);
        setError("Missing URL");
        return;
      }

      // Si ya hay data, esto es un refresh => updating
      setUpdating(data !== null);
      if (data === null) setLoading(true);

      // Abort previous request if any
      inflightRef.current?.abort();
      const ac = new AbortController();
      inflightRef.current = ac;

      try {
        const res = await fetch(url, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: ac.signal,
        });

        if (!res.ok) {
          const contentType = res.headers.get("content-type") ?? "";
          let detail = "";

          if (contentType.includes("application/json")) {
            const j = (await res.json().catch(() => null)) as any;
            if (j && typeof j.error === "string") detail = j.error;
            else detail = JSON.stringify(j ?? {});
          } else {
            detail = await res.text().catch(() => "");
          }

          detail = detail.replace(/\s+/g, " ").trim().slice(0, 160);

          throw new Error(detail ? `HTTP ${res.status} - ${detail}` : `HTTP ${res.status}`);
        }

        const json = (await res.json()) as T;
        setData(json);
        setError(null);
        setLastUpdatedAt(new Date());
      } catch (e: unknown) {
        // Si fue abort por refresh/unmount, no lo tratamos como error
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
        // Mantener último data válido
      } finally {
        setLoading(false);
        setUpdating(false);

        // Programar próximo tick
        if (mountedRef.current) {
          timerRef.current = window.setTimeout(tick, refreshMs);
        }
      }
    };

    clear();
    void tick();

    return () => {
      mountedRef.current = false;
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, refreshMs]);

  return { data, error, loading, updating, lastUpdatedAt };
}
