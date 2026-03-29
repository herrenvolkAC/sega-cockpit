"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { clientName } from "@/lib/env";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type SlottingRow = {
  sku: string;
  articulo: string;
  tipologia_actual_observada: string;
  grupo_tipologia_actual: string;
  sugerencia: string;
  grupo_tipologia_objetivo: string | null;
  lineas_picking: number;
  unidades_pickeadas: number;
  avg_qty_por_linea: number;
  porc_lineas_unitarias: number;
  porc_lineas_multiplo_caja: number;
  porc_lineas_multiplo_pallet: number;
  lineas_por_1000_unidades: number;
  dias_con_actividad: number;
  ubicaciones_distintas: number;
  porc_unidades_desde_ubic_asignada: number;
  score_hacia_rack_pallet: number;
  score_hacia_balda: number;
  prioridad: number;
  lineas_potencialmente_evitables: number | null;
};

type SlottingData = {
  ok: boolean;
  kpis: {
    totalEvaluados: number;
    conSugerencia: number;
    rackToBalda: number;
    baldaToRack: number;
    aRevisar: number;
    lineasEvitables: number;
  };
  top10: Array<{
    sku: string;
    articulo: string;
    lineas_evitables: number;
    sugerencia: string;
    grupo_tipologia_objetivo: string | null;
  }>;
  detalle: SlottingRow[];
  metadata: {
    ventana_desde: string;
    ventana_hasta: string;
    loaded_at: string;
  } | null;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
type SortKey = keyof SlottingRow;
type SortDir = "asc" | "desc";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

const fmtDec = (n: number, decimals = 1) => n.toFixed(decimals);

const sugerenciaColor = (s: string) => {
  if (s.startsWith("SUGERIR: RACK/PALLET -> BALDA"))
    return { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", dot: "bg-orange-500" };
  if (s.startsWith("SUGERIR: BALDA -> RACK/PALLET"))
    return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", dot: "bg-blue-500" };
  if (s.startsWith("REVISAR"))
    return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", dot: "bg-yellow-500" };
  return { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" };
};

const exportCSV = (rows: SlottingRow[]) => {
  const headers = [
    "SKU", "Artículo", "Tipología Actual", "Grupo Actual", "Sugerencia",
    "Grupo Objetivo", "Líneas Picking", "Unidades Pickeadas", "Prom U/Línea",
    "% Líneas Unitarias", "% Múltiplo Caja", "% Múltiplo Pallet",
    "Líneas/1000u", "Días Activos", "Ubic. Distintas",
    "% Ubic Asignada", "Score→Rack", "Score→Balda", "Prioridad",
    "Líneas Evitables",
  ];
  const escape = (v: any) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.sku, r.articulo, r.tipologia_actual_observada, r.grupo_tipologia_actual,
        r.sugerencia, r.grupo_tipologia_objetivo ?? "",
        r.lineas_picking, r.unidades_pickeadas, r.avg_qty_por_linea,
        (r.porc_lineas_unitarias * 100).toFixed(1),
        (r.porc_lineas_multiplo_caja * 100).toFixed(1),
        (r.porc_lineas_multiplo_pallet * 100).toFixed(1),
        r.lineas_por_1000_unidades, r.dias_con_actividad, r.ubicaciones_distintas,
        (r.porc_unidades_desde_ubic_asignada * 100).toFixed(1),
        r.score_hacia_rack_pallet, r.score_hacia_balda, r.prioridad,
        r.lineas_potencialmente_evitables ?? "",
      ]
        .map(escape)
        .join(",")
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `slotting_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────
// Metodología (tab estático, sin datos)
// ─────────────────────────────────────────────
function MetodologiaTab() {
  return (
    <div className="max-w-4xl space-y-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

      {/* Intro */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">¿Qué hace este tablero?</h2>
        <p>
          Detecta productos cuya <strong>ubicación de almacenamiento no coincide con su patrón real de picking</strong>.
          Un SKU unitario en rack obliga al operario a desplazarse a una posición de gran altura para buscar pocas unidades;
          uno de alto volumen en balda impide usar autoelevadora y genera múltiples líneas para lo que saldría en una sola.
          El tablero cuantifica el impacto de cada cambio sugerido en <em>líneas de picking evitables</em>.
        </p>
      </section>

      {/* Paso 1 + 2 fusionados */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Paso 1 — Tipología y métricas</h2>
        <p className="mb-3">
          La tipología de cada SKU se determina por <strong>volumen dominante</strong>: gana el tipo de ubicación desde donde
          se pickeó la mayor cantidad de unidades. Solo los grupos <strong>BALDA</strong> y <strong>RACK/PALLET</strong> son
          evaluados; las áreas especiales (cámara, salón, servicio) quedan fuera.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-semibold">Métrica</th>
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-semibold">Señal operativa</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["% Líneas unitarias", "Alto → fraccionado → candidato a BALDA"],
                ["% Múltiplo de caja", "Alto → sale en cajas completas → candidato a RACK"],
                ["% Múltiplo de pallet", "Alto → sale en pallets → candidato fuerte a RACK"],
                ["Líneas / 1000 unidades", "Alta fragmentación = muchas líneas por poco volumen"],
                ["Días con actividad", "Evita actuar sobre picos de un solo día (promo, liquidación)"],
                ["% desde ubicación asignada", "< 50 % → dato sucio → no actuar hasta corregir WMS"],
              ].map(([m, s], i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-gray-50 dark:bg-gray-800"}>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 font-semibold whitespace-nowrap">{m}</td>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2">{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Paso 2 — Scores */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Paso 2 — Score y umbral de sugerencia</h2>
        <p className="mb-4">
          Se calculan dos scores simultáneos. Cuando el score hacia la tipología <em>opuesta</em> supera <strong>20 puntos</strong>,
          se emite la sugerencia.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 font-semibold text-blue-800 dark:text-blue-200 text-xs">
              Score → RACK/PALLET
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {[
                  ["% múltiplo de pallet", "+100"],
                  ["% múltiplo de caja", "+60"],
                  ["% líneas unitarias", "−80"],
                  ["líneas / 1000 u", "−0.6"],
                ].map(([f, p], i) => (
                  <tr key={i} className={i % 2 === 0 ? "" : "bg-gray-50 dark:bg-gray-800"}>
                    <td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">{f}</td>
                    <td className={`px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-right font-mono font-semibold ${p.startsWith("+") ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
            <div className="bg-orange-50 dark:bg-orange-900/30 px-4 py-2 font-semibold text-orange-800 dark:text-orange-200 text-xs">
              Score → BALDA
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {[
                  ["% líneas unitarias", "+100"],
                  ["líneas / 1000 u", "+0.6"],
                  ["% múltiplo de caja", "−60"],
                  ["% múltiplo de pallet", "−100"],
                ].map(([f, p], i) => (
                  <tr key={i} className={i % 2 === 0 ? "" : "bg-gray-50 dark:bg-gray-800"}>
                    <td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">{f}</td>
                    <td className={`px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-right font-mono font-semibold ${p.startsWith("+") ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Ejemplos */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Ejemplos</h2>
        <div className="space-y-4">

          {/* Ejemplo A */}
          <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
            <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 border-b border-orange-200 dark:border-orange-800">
              <span className="font-semibold text-orange-800 dark:text-orange-300 text-xs">A — RACK → BALDA · "Aceite de oliva 500ml"</span>
            </div>
            <div className="p-4 text-xs space-y-2">
              <p>200 líneas en el mes, casi siempre 1-2 unidades. Nunca en múltiplo de caja (12 u) ni de pallet.
                <span className="ml-1 font-mono text-gray-500">75 % unitarias · 0 % caja · 0 % pallet · 625 L/1000u</span>
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 space-y-0.5">
                <p><strong>Score RACK:</strong> (100×0) + (60×0) − (80×0.75) − (0.6×625) = <strong className="text-red-600 dark:text-red-400">−435</strong></p>
                <p><strong>Score BALDA:</strong> (100×0.75) + (0.6×625) − 0 − 0 = <strong className="text-green-700 dark:text-green-400">+450 ✓</strong></p>
              </div>
              <p className="text-gray-500">
                <strong>Líneas evitables:</strong> si la mediana de L/1000u en BALDA es 180 →
                (625 − 180) × (320/1000) = <strong className="text-green-700 dark:text-green-400">142 líneas menos</strong> con el mismo volumen vendido.
              </p>
            </div>
          </div>

          {/* Ejemplo B */}
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 border-b border-blue-200 dark:border-blue-800">
              <span className="font-semibold text-blue-800 dark:text-blue-300 text-xs">B — BALDA → RACK · "Detergente 5L"</span>
            </div>
            <div className="p-4 text-xs space-y-2">
              <p>80 líneas, 3.200 unidades. Sale mayormente en cajas (6 u) o pallets (60 u).
                <span className="ml-1 font-mono text-gray-500">2 % unitarias · 70 % caja · 15 % pallet · 25 L/1000u</span>
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 space-y-0.5">
                <p><strong>Score RACK:</strong> (100×0.15) + (60×0.70) − (80×0.02) − (0.6×25) = <strong className="text-green-700 dark:text-green-400">+40.4 ✓</strong></p>
                <p><strong>Score BALDA:</strong> (100×0.02) + (0.6×25) − (60×0.70) − (100×0.15) = <strong className="text-red-600 dark:text-red-400">−40</strong></p>
              </div>
              <p className="text-gray-500">En rack se repone y pickea con transpaleta. En balda se manipulan cajas pesadas una a una.</p>
            </div>
          </div>

          {/* Ejemplo C */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-600 dark:text-gray-300 text-xs">C — Sin sugerencia · "Yogur bebible 200ml" en BALDA</span>
            </div>
            <div className="p-4 text-xs space-y-2">
              <p>150 líneas, siempre 1-3 unidades. Casi nunca en múltiplos de caja.
                <span className="ml-1 font-mono text-gray-500">80 % unitarias · 5 % caja · 0 % pallet · 450 L/1000u</span>
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                <p><strong>Score RACK:</strong> <strong>−331</strong> &nbsp;|&nbsp; <strong>Score BALDA:</strong> <strong>+347</strong> → ya está bien ubicado, sin sugerencia ✓</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cuándo NO actuar + Filtros + Frecuencia */}
      <section className="pb-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Consideraciones operativas</h2>
        <div className="p-3 mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs">
          <strong className="text-yellow-800 dark:text-yellow-300">⚠ Revisar antes de actuar:</strong>
          <ul className="mt-1.5 space-y-1 list-disc list-inside text-yellow-800 dark:text-yellow-200">
            <li>Si <strong>% desde ubicación asignada &lt; 50 %</strong>: corregir maestro en WMS primero, no mover el producto.</li>
            <li>Si el SKU tuvo <strong>pocos días activos</strong>: verificar que no sea un pico puntual (promo, liquidación).</li>
            <li>Si <strong>caja/pallet = NULL</strong> en el maestro: los % de múltiplos son poco confiables.</li>
            <li>La sugerencia no conoce la <strong>disponibilidad física</strong> de posiciones en el depósito.</li>
          </ul>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Filtros de calidad aplicados:</strong> mínimo 10 líneas en el período · solo BALDA y RACK/PALLET · score ≥ 20 · ≥ 50 % desde ubicación asignada.<br/>
          <strong>Actualización:</strong> diaria vía <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono">bi.usp_build_slotting_sugerencias</code> sobre una ventana móvil de 30 días.
        </p>
      </section>

    </div>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function SlottingPage() {
  const [data, setData] = useState<SlottingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"analisis" | "metodologia">("analisis");
  const [search, setSearch] = useState("");
  const [filterSugerencia, setFilterSugerencia] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lineas_potencialmente_evitables");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/slotting");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Error desconocido");
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Tabla filtrada y ordenada ──
  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.detalle;

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.sku.toLowerCase().includes(q) ||
          (r.articulo ?? "").toLowerCase().includes(q)
      );
    }

    if (filterSugerencia !== "all") {
      if (filterSugerencia === "sugerir") {
        rows = rows.filter((r) => r.sugerencia.startsWith("SUGERIR:"));
      } else if (filterSugerencia === "revisar") {
        rows = rows.filter((r) => r.sugerencia.startsWith("REVISAR"));
      } else if (filterSugerencia === "ok") {
        rows = rows.filter((r) => r.sugerencia.startsWith("OK"));
      }
    }

    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, search, filterSugerencia, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (col !== sortKey) return <span className="ml-1 text-gray-300 dark:text-gray-600">↕</span>;
    return <span className="ml-1 text-blue-500">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const Th = ({
    col,
    children,
    className = "",
  }: {
    col: SortKey;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap ${className}`}
      onClick={() => handleSort(col)}
    >
      {children}
      <SortIcon col={col} />
    </th>
  );

  // ── Chart data ──
  const chartData = useMemo(() => {
    if (!data?.top10) return [];
    return data.top10.map((r) => ({
      ...r,
      label:
        (r.articulo ?? r.sku).length > 22
          ? (r.articulo ?? r.sku).slice(0, 20) + "…"
          : (r.articulo ?? r.sku),
      color: r.sugerencia.startsWith("SUGERIR: RACK/PALLET")
        ? "#f97316"  // orange
        : "#3b82f6", // blue
    }));
  }, [data]);

  // ─────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200 font-medium">Error al cargar datos: {error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data || data.detalle.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg">Sin datos disponibles.</p>
        <p className="text-sm mt-2">Ejecutá el SP <code>bi.usp_build_slotting_sugerencias</code> para generar el análisis.</p>
      </div>
    );
  }

  const { kpis, metadata } = data;

  const ventanaStr = metadata
    ? `${new Date(metadata.ventana_desde).toLocaleDateString("es-AR")} – ${new Date(metadata.ventana_hasta).toLocaleDateString("es-AR")}`
    : "";
  const loadedStr = metadata
    ? new Date(metadata.loaded_at).toLocaleString("es-AR")
    : "";

  // ─────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────
  return (
    <main className="p-6">
      {/* ── Header ── */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Optimización de Slotting — {clientName}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Detección de productos con tipo de almacenamiento subóptimo (BALDA vs RACK/PALLET)
        </p>
        {metadata && (
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Ventana de análisis: <strong>{ventanaStr}</strong></span>
            <span>Último cálculo: <strong>{loadedStr}</strong></span>
          </div>
        )}
      </header>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-8 border-b border-gray-200 dark:border-gray-700">
        {(["analisis", "metodologia"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            {tab === "analisis" ? "Análisis" : "Metodología"}
          </button>
        ))}
      </div>

      {activeTab === "metodologia" && <MetodologiaTab />}

      {activeTab === "analisis" && <>
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="Total de SKUs analizados que cumplen el mínimo de 10 líneas de picking y pertenecen a tipología BALDA o RACK/PALLET." />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">SKUs Evaluados</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(kpis.totalEvaluados)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="SKUs donde el score indica que el tipo de almacenamiento actual no es el más eficiente para su comportamiento de picking." />
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Con Sugerencia</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{fmt(kpis.conSugerencia)}</p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="SKUs almacenados en RACK/PALLET pero con comportamiento de picking fragmentado (unitario o en pequeñas cantidades). Candidatos a mover a BALDA." />
          </div>
          <p className="text-xs text-orange-700 dark:text-orange-300 mb-1">RACK → BALDA</p>
          <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">{fmt(kpis.rackToBalda)}</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="SKUs almacenados en BALDA pero con picking mayormente en múltiplos de caja o pallet. Candidatos a consolidar en RACK/PALLET para reducir movimientos." />
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">BALDA → RACK</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{fmt(kpis.baldaToRack)}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="Estimación de líneas de picking que podrían eliminarse si todos los SKUs con sugerencia adoptaran la tipología objetivo. Calculado comparando la fragmentación actual vs. la mediana de la tipología destino." />
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mb-1">Líneas Evitables</p>
          <p className="text-2xl font-bold text-green-800 dark:text-green-200">{fmt(kpis.lineasEvitables)}</p>
        </div>
      </div>

      {/* ── Gráfico Top 10 ── */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Top 10 SKUs por Líneas Evitables
            </h2>
            <InfoTooltip
              position="right"
              content="Los 10 SKUs con mayor potencial de reducción de líneas de picking. Atacarlos primero maximiza el impacto operativo del re-slotting."
            />
          </div>
          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block bg-orange-500" /> RACK → BALDA
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block bg-blue-500" /> BALDA → RACK
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={(v) => fmt(Number(v))}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={180}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-semibold text-gray-100 mb-1">{d.articulo}</p>
                        <p className="text-xs text-gray-400 mb-2">SKU: {d.sku}</p>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-400">Líneas evitables:</span>
                            <span className="font-medium text-green-400">{fmt(d.lineas_evitables)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-400">Sugerencia:</span>
                            <span className="font-medium text-gray-200">{d.grupo_tipologia_objetivo}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="lineas_evitables" radius={[0, 3, 3, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Grilla Detalle ── */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {/* Controles */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Detalle por SKU
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({filteredRows.length} de {data.detalle.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Buscar SKU o artículo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            <select
              value={filterSugerencia}
              onChange={(e) => setFilterSugerencia(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las sugerencias</option>
              <option value="sugerir">Solo sugerencias activas</option>
              <option value="revisar">Solo a revisar</option>
              <option value="ok">Solo OK</option>
            </select>
            <button
              onClick={() => exportCSV(filteredRows)}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium flex items-center gap-1"
            >
              ↓ Exportar CSV
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <Th col="sku">SKU</Th>
                <Th col="articulo" className="min-w-[180px]">Artículo</Th>
                <Th col="tipologia_actual_observada">Tipología</Th>
                <Th col="sugerencia">Sugerencia</Th>
                <Th col="lineas_picking">Líneas</Th>
                <Th col="unidades_pickeadas">Unidades</Th>
                <Th col="avg_qty_por_linea">U/Línea</Th>
                <Th col="porc_lineas_unitarias">
                  <span className="flex items-center gap-1">
                    % Unit
                    <InfoTooltip content="% líneas donde se pickeó exactamente 1 unidad. Alto → candidato a BALDA." position="right" />
                  </span>
                </Th>
                <Th col="porc_lineas_multiplo_caja">
                  <span className="flex items-center gap-1">
                    % Caja
                    <InfoTooltip content="% líneas donde la cantidad es múltiplo exacto de caja. Alto → candidato a RACK." position="right" />
                  </span>
                </Th>
                <Th col="lineas_por_1000_unidades">
                  <span className="flex items-center gap-1">
                    L/1000u
                    <InfoTooltip content="Líneas de picking por cada 1000 unidades. Mayor fragmentación = más líneas. Balda fragmentada tiene valores altos." position="right" />
                  </span>
                </Th>
                <Th col="lineas_potencialmente_evitables">Líneas Evitables</Th>
                <Th col="prioridad">Prioridad</Th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const colors = sugerenciaColor(row.sugerencia);
                return (
                  <tr
                    key={row.sku}
                    className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                      i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/50"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {row.sku}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-[220px]">
                      <span title={row.articulo}>
                        {row.articulo?.length > 30
                          ? row.articulo.slice(0, 28) + "…"
                          : row.articulo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {row.tipologia_actual_observada}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {row.sugerencia.replace("SUGERIR: ", "").replace("OK / SIN CAMBIO SUGERIDO", "OK")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmt(row.lineas_picking)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmt(row.unidades_pickeadas)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmtDec(row.avg_qty_por_linea)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmtPct(row.porc_lineas_unitarias)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmtPct(row.porc_lineas_multiplo_caja)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmtDec(row.lineas_por_1000_unidades)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {row.lineas_potencialmente_evitables !== null ? (
                        <span className="text-green-700 dark:text-green-400">
                          {fmt(row.lineas_potencialmente_evitables)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-400">
                      {fmtDec(row.prioridad)}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="px-3 py-8 text-center text-gray-400 dark:text-gray-500"
                  >
                    Sin resultados para los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </main>
  );
}
