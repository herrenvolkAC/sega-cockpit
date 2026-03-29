"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Legend,
} from "recharts";
import { InfoTooltip } from "@/components/InfoTooltip";
import { clientName } from "@/lib/env";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface KpiBloque {
  totalOc:              number;
  totalLineas:          number;
  lineasCompletas:      number;
  lineasParciales:      number;
  lineasSinRecepcion:   number;
  unidadesPedidas:      number;
  unidadesRecibidas:    number;
  unidadesPendientes:   number;
  cajasPedidas:         number;
  cajasRecibidas:       number;
  cajasPendientes:      number;
  satisfaccionPromedio: number;
}

interface DistribucionRow {
  rango:       string;
  orden:       number;
  cant_lineas: number;
  cant_oc:     number;
}

interface ProveedorRow {
  proveedor:             string;
  total_oc:              number;
  total_lineas:          number;
  lineas_completas:      number;
  unidades_pedidas:      number;
  unidades_recibidas:    number;
  unidades_pendientes:   number;
  satisfaccion_promedio: number;
}

interface ProximaVencer {
  oc:                    string;
  proveedor:             string;
  fin_vigencia:          string;
  dias_para_vencer:      number;
  lineas_totales:        number;
  lineas_completas:      number;
  unidades_pedidas:      number;
  unidades_recibidas:    number;
  unidades_pendientes:   number;
  satisfaccion_promedio: number;
}

interface ArticuloRow {
  articulo:              string;
  cant_oc:               number;
  unidades_pendientes:   number;
  unidades_pedidas:      number;
  unidades_recibidas:    number;
  cajas_pendientes:      number;
  satisfaccion_promedio: number;
}

interface EvolucionMes {
  mes_cierre:            string;
  total_oc:              number;
  oc_completas:          number;
  lineas_completas:      number;
  lineas_totales:        number;
  unidades_pedidas:      number;
  unidades_recibidas:    number;
  satisfaccion_promedio: number;
}

interface SatisfaccionData {
  filtros:  { estado: string; proveedor: string | null };
  kpis:     { activas: KpiBloque | null; cerradas: KpiBloque | null };
  graficos: {
    distribucion:      DistribucionRow[];
    porProveedor:      ProveedorRow[];
    proximasVencer:    ProximaVencer[];
    topArticulos:      ArticuloRow[];
    evolucionCerradas: EvolucionMes[];
  };
  generatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSatisfaccionColor = (pct: number): string => {
  if (pct >= 95) return "#22c55e";
  if (pct >= 80) return "#84cc16";
  if (pct >= 50) return "#eab308";
  if (pct >  0)  return "#f97316";
  return "#ef4444";
};

const getSatisfaccionBadge = (pct: number): { label: string; classes: string } => {
  if (pct >= 95) return { label: "Excelente",     classes: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" };
  if (pct >= 80) return { label: "Buena",         classes: "bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300" };
  if (pct >= 50) return { label: "Media",         classes: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" };
  if (pct >  0)  return { label: "Baja",          classes: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" };
  return               { label: "Sin recepción", classes: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" };
};

const getDiasVencerColor = (dias: number): string => {
  if (dias <= 7)  return "text-red-600 dark:text-red-400 font-bold";
  if (dias <= 15) return "text-orange-600 dark:text-orange-400 font-semibold";
  if (dias <= 30) return "text-yellow-600 dark:text-yellow-400";
  return "text-gray-600 dark:text-gray-400";
};

const DIST_COLORS: Record<string, string> = {
  "100% Completa":    "#22c55e",
  "80–99% Alta":      "#84cc16",
  "50–79% Media":     "#eab308",
  "1–49% Baja":       "#f97316",
  "0% Sin recepción": "#ef4444",
};

const tooltipStyle = {
  contentStyle: { backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "6px" },
  labelStyle:   { color: "#f3f4f6", fontWeight: "bold" as const },
  itemStyle:    { color: "#f3f4f6" },
};

// ─── Sub-componente KPI Card ──────────────────────────────────────────────────

const KPICard = ({
  title, value, subtitle, color, tooltip,
}: {
  title: string; value: string | number; subtitle?: string;
  color: "blue" | "green" | "red" | "orange" | "yellow" | "gray" | "lime";
  tooltip?: string;
}) => {
  const bg: Record<string, string> = {
    blue:   "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    green:  "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    red:    "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
    yellow: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
    lime:   "bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800",
    gray:   "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
  };
  const tx: Record<string, string> = {
    blue:   "text-blue-800 dark:text-blue-200",
    green:  "text-green-800 dark:text-green-200",
    red:    "text-red-800 dark:text-red-200",
    orange: "text-orange-800 dark:text-orange-200",
    yellow: "text-yellow-800 dark:text-yellow-200",
    lime:   "text-lime-800 dark:text-lime-200",
    gray:   "text-gray-800 dark:text-gray-200",
  };
  return (
    <div className={`${bg[color]} border rounded-lg p-5 relative`}>
      {tooltip && <div className="absolute top-2 right-2"><InfoTooltip content={tooltip} /></div>}
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 pr-5">{title}</div>
      <div className={`text-2xl font-bold ${tx[color]} mb-0.5`}>{value}</div>
      {subtitle && <div className={`text-xs ${tx[color]} opacity-75`}>{subtitle}</div>}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

type TabKey = "activas" | "cerradas";

export default function SatisfaccionOcPage() {
  const [data,      setData]      = useState<SatisfaccionData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [proveedor, setProveedor] = useState("");
  const [tab,       setTab]       = useState<TabKey>("activas");

  const formatN   = (n: number, dec = 0) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: dec }).format(n);
  const formatPct = (n: number) => `${formatN(n, 1)} %`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ estado: "all" });
      if (proveedor.trim()) params.append("proveedor", proveedor.trim());
      const res = await fetch(`/api/satisfaccion-oc?${params}`);
      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Error desconocido");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  }, [proveedor]);

  // Carga inicial automática
  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPI del tab activo ──────────────────────────────────────────────────────
  const kpi = tab === "activas" ? data?.kpis.activas : data?.kpis.cerradas;

  const kpiCards = useMemo(() => {
    if (!kpi) return [];
    const pct = kpi.satisfaccionPromedio;
    const bdg = getSatisfaccionBadge(pct);
    const colorSat = pct >= 95 ? "green" : pct >= 80 ? "lime" : pct >= 50 ? "yellow" : pct > 0 ? "orange" : "red";
    const pctCompletas = kpi.totalLineas > 0 ? (kpi.lineasCompletas / kpi.totalLineas) * 100 : 0;
    return [
      {
        title:   "Satisfacción Promedio",
        value:   formatPct(pct),
        subtitle: bdg.label,
        color:   colorSat as any,
        tooltip: "Promedio del % de satisfacción sobre todas las líneas de OC (porc_satisfaccion × 100).",
      },
      {
        title:   "OCs Totales",
        value:   formatN(kpi.totalOc),
        subtitle: `${formatN(kpi.totalLineas)} líneas`,
        color:   "blue" as any,
        tooltip: "Cantidad de órdenes de compra distintas en el estado seleccionado.",
      },
      {
        title:   "Líneas Completas",
        value:   formatN(kpi.lineasCompletas),
        subtitle: `${formatPct(pctCompletas)} del total`,
        color:   "green" as any,
        tooltip: "Líneas donde la cantidad recibida alcanzó la cantidad pedida (completa_flag = 1).",
      },
      {
        title:   "Líneas Parciales",
        value:   formatN(kpi.lineasParciales),
        subtitle: "Con alguna recepción",
        color:   "yellow" as any,
        tooltip: "Líneas con al menos una recepción pero sin completar el 100 % pedido.",
      },
      {
        title:   "Líneas sin Recepción",
        value:   formatN(kpi.lineasSinRecepcion),
        color:   (kpi.lineasSinRecepcion > 0 ? "orange" : "gray") as any,
        tooltip: "Líneas de OC donde no se registró ninguna unidad recibida.",
      },
      {
        title:   "Cajas Recibidas",
        value:   formatN(kpi.cajasRecibidas),
        subtitle: `${formatPct(kpi.cajasPedidas > 0 ? (kpi.cajasRecibidas / kpi.cajasPedidas) * 100 : 0)} de lo pedido`,
        color:   "blue" as any,
        tooltip: "Total de cajas efectivamente recibidas.",
      },
      {
        title:   "Cajas Pendientes",
        value:   formatN(kpi.cajasPendientes),
        color:   (kpi.cajasPendientes > 0 ? "orange" : "green") as any,
        tooltip: "Total de cajas aún pendientes de recepción.",
      },
      {
        title:   "Líneas con Desvío",
        value:   formatN(kpi.lineasParciales + kpi.lineasSinRecepcion),
        subtitle: `${formatPct(kpi.totalLineas > 0 ? ((kpi.lineasParciales + kpi.lineasSinRecepcion) / kpi.totalLineas) * 100 : 0)} del total`,
        color:   ((kpi.lineasParciales + kpi.lineasSinRecepcion) > 0 ? "orange" : "green") as any,
        tooltip: "Líneas parciales más líneas sin recepción. Representa el volumen de desvío respecto a lo comprometido.",
      },
    ];
  }, [kpi]);

  // ── Datos para gráficos ─────────────────────────────────────────────────────

  const distribucionData = useMemo(
    () =>
      [...(data?.graficos.distribucion ?? [])].sort((a, b) => a.orden - b.orden).map((d) => ({
        ...d,
        fill: DIST_COLORS[d.rango] ?? "#6b7280",
      })),
    [data]
  );

  const proveedorData = useMemo(
    () =>
      (data?.graficos.porProveedor ?? []).map((d) => ({
        ...d,
        satisfaccion_promedio: parseFloat(Number(d.satisfaccion_promedio).toFixed(1)),
        fill: getSatisfaccionColor(Number(d.satisfaccion_promedio)),
      })),
    [data]
  );

  // Altura dinámica del gráfico de proveedores: mínimo 200px, 36px por fila
  const proveedorChartHeight = Math.max(200, proveedorData.length * 36);

  const evolucionData = useMemo(
    () =>
      (data?.graficos.evolucionCerradas ?? []).map((d) => ({
        ...d,
        satisfaccion_promedio: parseFloat(Number(d.satisfaccion_promedio).toFixed(1)),
        pct_completas: d.total_oc > 0
          ? parseFloat(((d.oc_completas / d.total_oc) * 100).toFixed(1)) : 0,
      })),
    [data]
  );

  const hasData = !!data;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="p-6">
      {/* Encabezado */}
      <header className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Satisfacción de Entregas — {clientName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Cumplimiento de órdenes de compra: unidades pedidas vs. recibidas por proveedor
            </p>
          </div>
          {data && (
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-md">
              Actualizado al{" "}
              {new Date(data.generatedAt).toLocaleString("es-AR", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </header>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 border border-gray-200 dark:border-gray-700 mb-6">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Filtros</div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Proveedor (opcional)
            </label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Nombre del proveedor..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Consultando..." : "Actualizar"}
            </button>
            <button
              onClick={() => setProveedor("")}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:cursor-not-allowed"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Aviso metodológico */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
        <span className="font-semibold">Nota:</span>{" "}
        Las OCs <strong>activas</strong> muestran el avance parcial de recepción — la satisfacción
        puede mejorar hasta que la OC sea cerrada. Las OCs <strong>cerradas</strong> reflejan
        el resultado definitivo una vez que el WMS las marca como inactivas.
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <span className="text-red-600 dark:text-red-400 font-medium">{error}</span>
          <button onClick={fetchData} className="ml-auto text-sm text-red-700 dark:text-red-300 underline hover:no-underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}

      {!loading && hasData && (
        <>
          {/* ── Tabs Activas / Cerradas ─────────────────────────────────────── */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
            {(["activas", "cerradas"] as TabKey[]).map((t) => {
              const label = t === "activas" ? "OCs Activas (en curso)" : "OCs Cerradas";
              const count = t === "activas"
                ? data.kpis.activas?.totalOc  ?? 0
                : data.kpis.cerradas?.totalOc ?? 0;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === t
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  {label}
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                    tab === t
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                  }`}>
                    {formatN(count)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── KPI Cards ───────────────────────────────────────────────────── */}
          {kpi ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {kpiCards.map((k, i) => <KPICard key={i} {...k} />)}
            </div>
          ) : (
            <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400">
              No hay OCs {tab === "activas" ? "activas" : "cerradas"} con los filtros aplicados.
            </div>
          )}

          {/* ── Distribución + Top proveedores ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Distribución por rango */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Distribución por Rango de Satisfacción
                </h2>
                <InfoTooltip content="Cantidad de líneas de OC agrupadas por rango de satisfacción. Incluye el total de OCs activas y cerradas." />
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={distribucionData} margin={{ top: 4, right: 16, left: 0, bottom: 56 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                  <XAxis
                    dataKey="rango"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v: any, name: any) => [
                      formatN(Number(v)),
                      name === "cant_lineas" ? "Líneas" : "OCs",
                    ]}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Bar dataKey="cant_lineas" name="cant_lineas" radius={[3, 3, 0, 0]}>
                    {distribucionData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {distribucionData.map((row) => {
                  const total = distribucionData.reduce((s, r) => s + r.cant_lineas, 0);
                  const pct   = total > 0 ? (row.cant_lineas / total) * 100 : 0;
                  return (
                    <div key={row.rango} className="flex items-center gap-3 text-sm">
                      <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: row.fill }} />
                      <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{row.rango}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">{formatN(row.cant_oc)} OC</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100 w-16 text-right">{formatN(row.cant_lineas)} lín.</span>
                      <span className="text-gray-400 w-12 text-right text-xs">{formatN(pct, 1)} %</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 15 proveedores con peor satisfacción */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Top 15 Proveedores — Peor Satisfacción
                </h2>
                <InfoTooltip content="Los 15 proveedores con menor satisfacción promedio, ordenados de peor a mejor. Permite priorizar el seguimiento y las acciones de mejora." />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Líneas de referencia: 80 % (mínimo aceptable) · 95 % (objetivo)
              </p>
              <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
                <ResponsiveContainer width="100%" height={proveedorChartHeight}>
                  <BarChart
                    data={proveedorData}
                    layout="vertical"
                    margin={{ top: 2, right: 52, left: 8, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="proveedor"
                      width={130}
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: any, _: any, props: any) => [
                        `${Number(v).toFixed(1)} % · ${formatN(props.payload.total_oc)} OCs · ${formatN(props.payload.lineas_completas)}/${formatN(props.payload.total_lineas)} lín.`,
                        "Satisfacción",
                      ]}
                      cursor={false}
                    />
                    <ReferenceLine x={80} stroke="#eab308" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "80%", fill: "#eab308", fontSize: 9, position: "insideTopRight" }} />
                    <ReferenceLine x={95} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "95%", fill: "#22c55e", fontSize: 9, position: "insideTopRight" }} />
                    <Bar dataKey="satisfaccion_promedio" name="% Satisfacción" radius={[0, 3, 3, 0]}>
                      {proveedorData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── OCs próximas a vencer (solo tab activas) ──────────────────────── */}
          {tab === "activas" && data.graficos.proximasVencer.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-6">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  OCs Próximas a Vencer con Recepción Incompleta
                </h2>
                <InfoTooltip content="OCs activas con vigencia próxima a expirar y aún sin completar. Ordenadas por urgencia (días restantes) y menor satisfacción." />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                      {["OC", "Proveedor", "Vence en", "Fecha fin", "Satisfacción", "Líneas compl.", "Ud. pendientes"].map((h) => (
                        <th key={h} className="pb-3 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.graficos.proximasVencer.map((row) => {
                      const pct = Number(row.satisfaccion_promedio);
                      const bdg = getSatisfaccionBadge(pct);
                      return (
                        <tr key={row.oc} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-2.5 pr-4 font-mono text-xs text-gray-900 dark:text-gray-100">{row.oc}</td>
                          <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300 max-w-[140px] truncate" title={row.proveedor}>{row.proveedor}</td>
                          <td className={`py-2.5 pr-4 ${getDiasVencerColor(row.dias_para_vencer)}`}>
                            {row.dias_para_vencer === 0 ? "Hoy" : `${row.dias_para_vencer}d`}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 text-xs">
                            {new Date(row.fin_vigencia).toLocaleDateString("es-AR")}
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-14 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div className="h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: getSatisfaccionColor(pct) }} />
                              </div>
                              <span className="text-xs font-semibold" style={{ color: getSatisfaccionColor(pct) }}>{formatPct(pct)}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${bdg.classes}`}>{bdg.label}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{formatN(row.lineas_completas)} / {formatN(row.lineas_totales)}</td>
                          <td className="py-2.5 pr-4 font-semibold text-orange-700 dark:text-orange-400">{formatN(row.unidades_pendientes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Top artículos pendientes + Evolución cerradas ──────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Top artículos */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Top 15 Artículos con Mayor Pendiente
                </h2>
                <InfoTooltip content="Artículos con mayor volumen de unidades pendientes de recepción. Prioridad para el seguimiento a proveedores según impacto en stock." />
              </div>
              <div className="overflow-y-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-gray-800">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left pb-2 text-gray-500 dark:text-gray-400 font-medium">Artículo</th>
                      <th className="text-right pb-2 text-gray-500 dark:text-gray-400 font-medium">OCs</th>
                      <th className="text-right pb-2 text-gray-500 dark:text-gray-400 font-medium">Ud. pend.</th>
                      <th className="text-right pb-2 text-gray-500 dark:text-gray-400 font-medium">Satisf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.graficos.topArticulos.map((row, i) => {
                      const pct = Number(row.satisfaccion_promedio);
                      return (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300 max-w-[160px] truncate" title={row.articulo}>{row.articulo}</td>
                          <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">{row.cant_oc}</td>
                          <td className="py-1.5 text-right font-semibold text-orange-700 dark:text-orange-400">{formatN(row.unidades_pendientes)}</td>
                          <td className="py-1.5 text-right font-semibold" style={{ color: getSatisfaccionColor(pct) }}>{formatPct(pct)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Evolución mensual OCs cerradas */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Evolución Mensual — OCs Cerradas
                </h2>
                <InfoTooltip content="Satisfacción promedio mensual de OCs en estado Completa, agrupadas por mes de fin de vigencia. Línea verde punteada: % de OCs completamente satisfechas." />
              </div>
              {evolucionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={evolucionData} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                    <XAxis dataKey="mes_cierre" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: any, name: any) => [
                        `${Number(v).toFixed(1)} %`,
                        name === "satisfaccion_promedio" ? "Satisfacción prom." : "% OCs completas",
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
                    <ReferenceLine y={80} stroke="#eab308" strokeDasharray="4 3" strokeWidth={1} />
                    <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1} />
                    <Line type="monotone" dataKey="satisfaccion_promedio" name="satisfaccion_promedio" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="pct_completas"         name="pct_completas"         stroke="#22c55e" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: "#22c55e" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600">
                  <div className="text-center">
                    <div className="text-3xl mb-2">📋</div>
                    <p className="text-sm">Sin OCs cerradas para mostrar</p>
                    <p className="text-xs mt-1">Las OCs en estado "Completa" aparecerán aquí</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Tabla detalle por proveedor ────────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Detalle por Proveedor — Top 15 Peores
              </h2>
              <InfoTooltip content="Resumen de satisfacción de los 15 proveedores con menor cumplimiento. Para ver todos los proveedores con buen desempeño, aplicar filtro de proveedor específico." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                    {["Proveedor", "OCs", "Líneas", "Compl.", "Ud. recibidas", "Ud. pendientes", "Satisfacción"].map((h) => (
                      <th key={h} className="pb-3 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proveedorData.map((row) => {
                    const pct = row.satisfaccion_promedio;
                    const bdg = getSatisfaccionBadge(pct);
                    return (
                      <tr key={row.proveedor} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-gray-100 max-w-[180px] truncate" title={row.proveedor}>{row.proveedor}</td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{formatN(row.total_oc)}</td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{formatN(row.total_lineas)}</td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">
                          {formatN(row.lineas_completas)}{" "}
                          <span className="text-xs text-gray-400">
                            ({formatN(row.total_lineas > 0 ? (row.lineas_completas / row.total_lineas) * 100 : 0, 0)} %)
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{formatN(row.unidades_recibidas)}</td>
                        <td className="py-2.5 pr-4 font-semibold text-orange-700 dark:text-orange-400">{formatN(row.unidades_pendientes)}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div className="h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: getSatisfaccionColor(pct) }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color: getSatisfaccionColor(pct) }}>{formatPct(pct)}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${bdg.classes}`}>{bdg.label}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
