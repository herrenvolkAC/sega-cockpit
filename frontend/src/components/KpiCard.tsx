"use client";

import type { Kpi } from "@/lib/types";

const statusClass = (s: Kpi["status"] | undefined) => {
  switch (s) {
    case "red":
      return "border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950";
    case "amber":
      return "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950";
    case "green":
      return "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950";
    default:
      return "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800";
  }
};

export function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div className={`rounded-2xl border p-6 ${statusClass(kpi.status)}`}>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{kpi.label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-4xl font-bold text-slate-900 dark:text-white">
          {kpi.value ?? "—"}
        </div>
        {kpi.unit ? <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">{kpi.unit}</div> : null}
      </div>
    </div>
  );
}
