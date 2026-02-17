"use client";

import { Suspense } from "react";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { StatusResponse } from "@/lib/types";
import { env } from "@/lib/env";
import { usePolling } from "@/hooks/usePolling";
import { KpiCard } from "@/components/KpiCard";
import { Banner } from "@/components/Banner";
import { EmptyState } from "@/components/EmptyState";
import { BasicThemeToggle } from "@/components/BasicThemeToggle";

function StatusPageContent() {
  const sp = useSearchParams();
  const sector = (sp.get("sector") ?? "").trim();

  // Función para formatear fechas a formato local legible
  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "—";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "—";
      
      // Simplemente formatear la fecha como está
      return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit", 
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(date);
    } catch {
      return "—";
    }
  };

  const url = useMemo(() => {
    if (!sector) return null;
    return `/api/status?sector=${encodeURIComponent(sector)}`;
  }, [sector]);

  const { data, error, loading, updating, lastUpdatedAt } = usePolling<StatusResponse>(url, {
    refreshMs: env.refreshSeconds * 1000,
  });

  const kpis = data?.kpis ?? [];
  const lag = data?.replicationLagMinutes ?? null;
  const lagWarn = lag !== null && lag >= env.lagWarnMinutes;

  if (!sector) {
    return (
      <main className="p-6">
        <EmptyState title="Falta ?sector=..." message="Ejemplo: /status?sector=Premios" />
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="p-6">
        <EmptyState title="Cargando…" message={`Sector: ${sector}`} />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="p-6">
        <Banner kind="error" title="No se pudo obtener datos del monitor" message={error} />
      </main>
    );
  }

  return (
    <main className="p-6 text-gray-800 dark:text-gray-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1">
          <div className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">Sector</div>
          <div 
            className="text-4xl font-bold"
            style={{
              color: 'var(--text-color, #111827)'
            }}
          >
            {sector}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <BasicThemeToggle />
          <div className="flex items-center gap-6 text-sm">
            <div className="text-gray-600 dark:text-gray-300">
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Generado</div>
              <div className="font-mono">{formatDateTime(data?.generatedAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-1">Lag</div>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                lag === null 
                  ? "bg-slate-700 text-slate-300" 
                  : lag >= env.lagWarnMinutes 
                    ? "bg-yellow-900 text-yellow-200" 
                    : "bg-blue-900 text-blue-200"
              }`}>
                {lag === null ? "—" : `${lag} min`}
              </span>
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {updating && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs">Actualizando</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="mb-4 text-xs text-gray-500 dark:text-gray-500 text-right">
        Base de datos: <span className="font-mono font-semibold">{data?.databaseName || "Unknown"}</span> | 
        Última actualización: {formatDateTime(lastUpdatedAt?.toISOString())}
      </div>

      {lagWarn ? (
        <div className="mb-4">
          <Banner
            kind="warn"
            title="Datos con atraso"
            message={`Atraso de replicación: ${lag} min (umbral: ${env.lagWarnMinutes})`}
          />
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <Banner kind="error" title="Error en actualización" message={error} />
        </div>
      ) : null}

      {kpis.length === 0 ? (
        <EmptyState title="Sin datos" message="No se encontraron KPIs para este sector." />
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map((k) => (
            <KpiCard key={k.key} kpi={k} />
          ))}
        </section>
      )}
    </main>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StatusPageContent />
    </Suspense>
  );
}
