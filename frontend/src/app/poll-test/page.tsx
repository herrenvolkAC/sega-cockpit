"use client";

import { usePolling } from "@/hooks/usePolling";
import type { StatusResponse } from "@/lib/types";

export default function PollTestPage() {
  const { data, error, loading, updating, lastUpdatedAt } = usePolling<StatusResponse>(
    "/api/status?sector=Premios",
    { refreshMs: 5000 }
  );

  return (
    <main style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h1>Poll test</h1>
      <div>loading: {String(loading)}</div>
      <div>updating: {String(updating)}</div>
      <div>lastUpdatedAt: {lastUpdatedAt ? lastUpdatedAt.toISOString() : "—"}</div>
      <div>error: {error ?? "—"}</div>
      <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
        {data ? JSON.stringify(data, null, 2) : "no data"}
      </pre>
    </main>
  );
}
