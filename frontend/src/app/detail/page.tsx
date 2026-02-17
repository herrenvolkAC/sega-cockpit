"use client";

import { Suspense } from "react";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { DetailResponse } from "@/lib/types";
import { env } from "@/lib/env";
import { usePolling } from "@/hooks/usePolling";
import { EmptyState } from "@/components/EmptyState";
import { Banner } from "@/components/Banner";

function DetailPageContent() {
  const searchParams = useSearchParams();
  const sector = (searchParams.get("sector") ?? "").trim();

  const url = useMemo(() => {
    if (!sector) return null;
    return `/api/detail?sector=${encodeURIComponent(sector)}`;
  }, [sector]);

  const { data, error, loading, updating, lastUpdatedAt } = usePolling<DetailResponse>(url, {
    refreshMs: 5000,
  });

  if (!sector) {
    return (
      <main className="p-6">
        <EmptyState title="Sector no especificado" message="Por favor especifique un sector en la URL: /detail?sector=nombre" />
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="p-6">
        <EmptyState title="Cargando datos..." message="Obteniendo información del sector..." />
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6">
        <EmptyState title="Error" message={error} />
      </main>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <main className="p-6">
        <EmptyState title="Sin datos" message="No se encontraron detalles para el sector especificado." />
      </main>
    );
  }

  const items = data.items ?? [];
  const lag = data.replicationLagMinutes ?? null;
  const lagWarn = lag !== null && lag >= env.lagWarnMinutes;

  return (
    <main className="p-6 text-slate-100 dark:text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Detalles - {sector}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Última actualización: {new Date(data.generatedAt).toLocaleString('es-AR')}
          </p>
        </div>
        {lagWarn && (
          <Banner
            kind="warn"
            title={`Atraso de replicación: ${lag} min`}
            message="Los datos pueden estar desactualizados"
          />
        )}
      </header>

      <div className="grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.label}
                </h3>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {item.key}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {item.value ?? "—"}
                </div>
                {item.unit && (
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {item.unit}
                  </div>
                )}
                {item.status && (
                  <div className={`mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === "green" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                    item.status === "amber" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                    item.status === "red" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                    "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }`}>
                    {item.status === "green" ? "✅" : item.status === "amber" ? "⚠️" : "❌"}
                  </div>
                )}
              </div>
            </div>
            {item.extra && (
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {item.extra}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

export default function DetailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DetailPageContent />
    </Suspense>
  );
}
