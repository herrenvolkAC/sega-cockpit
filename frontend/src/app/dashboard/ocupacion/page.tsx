"use client";

import { useState, useCallback, useMemo } from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
  Legend,
} from "recharts";
import { InfoTooltip } from "@/components/InfoTooltip";
import { clientName } from "@/lib/env";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OcupacionKpis {
  totalPosiciones:      number;
  capacidadTotal:       number;
  posicionesConStock:   number;
  posicionesLibres:     number;
  posicionesBloqueadas: number;
  contenedoresTotales:  number;
  cajasTotales:         number;
  unidadesTotales:      number;
  lugaresLibresTotal:   number;
  ocupacionPctGlobal:   number;
}

interface EvolucionDia {
  fecha:                string;
  total_posiciones:     number;
  capacidad_total:      number;
  posiciones_ocupadas:  number;
  posiciones_libres:    number;
  posiciones_bloqueadas: number;
  contenedores_totales: number;
  ocupacion_pct:        number;
}

interface SectorRow {
  sector:               string;
  posiciones:           number;
  capacidad_total:      number;
  posiciones_ocupadas:  number;
  posiciones_libres:    number;
  posiciones_bloqueadas: number;
  contenedores:         number;
  ocupacion_pct:        number;
}

interface SeccionRow {
  seccion:      string;
  posiciones:   number;
  contenedores: number;
  ocupacion_pct: number;
}

interface PickingReservaRow {
  tipo_ubicacion:      string;
  posiciones:          number;
  capacidad_total:     number;
  posiciones_ocupadas: number;
  contenedores:        number;
  ocupacion_pct:       number;
}

interface OcupacionData {
  fechaInicio: string;
  fechaFin:    string;
  filtros:     { sector: string | null; seccion: string | null };
  snapshot:    { fecha: string | null };
  kpis:        OcupacionKpis;
  graficos: {
    evolucionDiaria:  EvolucionDia[];
    porSector:        SectorRow[];
    porSeccion:       SeccionRow[];
    pickingVsReserva: PickingReservaRow[];
  };
  generatedAt: string;
}

// ─── Helpers de color por % de ocupación ─────────────────────────────────────

const getOcupacionColor = (pct: number): string => {
  if (pct >= 95) return "#ef4444"; // red-500
  if (pct >= 85) return "#f97316"; // orange-500
  if (pct >= 70) return "#eab308"; // yellow-500
  return "#22c55e";                // green-500
};

const getOcupacionBadge = (pct: number): { label: string; classes: string } => {
  if (pct >= 95) return { label: "Crítica",  classes: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" };
  if (pct >= 85) return { label: "Alta",     classes: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" };
  if (pct >= 70) return { label: "Media",    classes: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" };
  return             { label: "Normal",   classes: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" };
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "6px",
  },
  labelStyle: { color: "#f3f4f6", fontWeight: "bold" as const },
  itemStyle:  { color: "#f3f4f6" },
};

// ─── Sub-componente: KPI Card ─────────────────────────────────────────────────

const KPICard = ({
  title,
  value,
  subtitle,
  color,
  tooltip,
}: {
  title:    string;
  value:    string | number;
  subtitle?: string;
  color:    "blue" | "green" | "red" | "orange" | "yellow" | "purple" | "gray";
  tooltip?: string;
}) => {
  const bg: Record<string, string> = {
    blue:   "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    green:  "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    red:    "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
    yellow: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
    gray:   "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
  };
  const tx: Record<string, string> = {
    blue:   "text-blue-800 dark:text-blue-200",
    green:  "text-green-800 dark:text-green-200",
    red:    "text-red-800 dark:text-red-200",
    orange: "text-orange-800 dark:text-orange-200",
    yellow: "text-yellow-800 dark:text-yellow-200",
    purple: "text-purple-800 dark:text-purple-200",
    gray:   "text-gray-800 dark:text-gray-200",
  };

  return (
    <div className={`${bg[color]} border rounded-lg p-5 relative`}>
      {tooltip && (
        <div className="absolute top-2 right-2">
          <InfoTooltip content={tooltip} />
        </div>
      )}
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 pr-5">
        {title}
      </div>
      <div className={`text-2xl font-bold ${tx[color]} mb-0.5`}>{value}</div>
      {subtitle && (
        <div className={`text-xs ${tx[color]} opacity-75`}>{subtitle}</div>
      )}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OcupacionPage() {
  // Defaults: últimos 30 días
  const today     = new Date();
  const thirtyAgo = new Date(today);
  thirtyAgo.setDate(today.getDate() - 30);
  const defaultFin   = today.toISOString().split("T")[0];
  const defaultInicio = thirtyAgo.toISOString().split("T")[0];

  const [data,        setData]        = useState<OcupacionData | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fechaInicio, setFechaInicio] = useState(defaultInicio);
  const [fechaFin,    setFechaFin]    = useState(defaultFin);
  const [sector,      setSector]      = useState("");
  const [seccion,     setSeccion]     = useState("");
  const [queriedRange, setQueriedRange] = useState<{ start: string; end: string } | null>(null);

  const formatN = (n: number, decimals = 0) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimals }).format(n);

  const formatPct = (n: number) => `${formatN(n, 1)} %`;

  const formatFecha = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  };

  const fetchData = useCallback(async () => {
    if (!fechaInicio || !fechaFin) {
      alert("Por favor seleccione un rango de fechas.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fechaInicio, fechaFin });
      if (sector.trim())  params.append("sector",  sector.trim());
      if (seccion.trim()) params.append("seccion", seccion.trim());

      const res = await fetch(`/api/ocupacion?${params}`);
      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Error desconocido");
      setData(json.data);
      setQueriedRange({ start: fechaInicio, end: fechaFin });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, sector, seccion]);

  // ── Datos derivados ──────────────────────────────────────────────────────────

  const kpis = data?.kpis;
  const badge = kpis ? getOcupacionBadge(kpis.ocupacionPctGlobal) : null;

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    const pct = kpis.ocupacionPctGlobal;
    return [
      {
        title:   "Ocupación Global",
        value:   formatPct(pct),
        subtitle: badge?.label,
        color:   (pct >= 95 ? "red" : pct >= 85 ? "orange" : pct >= 70 ? "yellow" : "green") as any,
        tooltip: "Porcentaje de capacidad ocupada en el almacén (contenedores / capacidad total) al último día del período seleccionado.",
      },
      {
        title:   "Total Posiciones",
        value:   formatN(kpis.totalPosiciones),
        color:   "blue" as any,
        tooltip: "Cantidad total de ubicaciones de almacenaje registradas y activas.",
      },
      {
        title:   "Posiciones con Stock",
        value:   formatN(kpis.posicionesConStock),
        subtitle: `${formatPct(kpis.totalPosiciones > 0 ? (kpis.posicionesConStock / kpis.totalPosiciones) * 100 : 0)} del total`,
        color:   "blue" as any,
        tooltip: "Ubicaciones que tienen al menos un contenedor almacenado.",
      },
      {
        title:   "Posiciones Libres",
        value:   formatN(kpis.posicionesLibres),
        subtitle: `${formatPct(kpis.totalPosiciones > 0 ? (kpis.posicionesLibres / kpis.totalPosiciones) * 100 : 0)} del total`,
        color:   "green" as any,
        tooltip: "Ubicaciones vacías y sin bloqueo, disponibles para almacenar mercadería.",
      },
      {
        title:   "Posiciones Bloqueadas",
        value:   formatN(kpis.posicionesBloqueadas),
        subtitle: `${formatPct(kpis.totalPosiciones > 0 ? (kpis.posicionesBloqueadas / kpis.totalPosiciones) * 100 : 0)} del total`,
        color:   (kpis.posicionesBloqueadas > 0 ? "orange" : "gray") as any,
        tooltip: "Ubicaciones con bloqueo activo. No están disponibles para operaciones de entrada o salida.",
      },
      {
        title:   "Contenedores Almacenados",
        value:   formatN(kpis.contenedoresTotales),
        color:   "purple" as any,
        tooltip: "Total de contenedores (pallets) almacenados en el almacén al último día del período.",
      },
      {
        title:   "Capacidad Total",
        value:   formatN(kpis.capacidadTotal),
        subtitle: `${formatN(kpis.lugaresLibresTotal)} lugares libres`,
        color:   "gray" as any,
        tooltip: "Capacidad total declarada en el sistema para todas las ubicaciones activas.",
      },
      {
        title:   "Cajas en Stock",
        value:   formatN(kpis.cajasTotales),
        color:   "gray" as any,
        tooltip: "Total de cajas contabilizadas en los contenedores almacenados.",
      },
    ];
  }, [kpis, badge]);

  // Evolución: colorear puntos individualmente
  const evolucionData = useMemo(
    () =>
      (data?.graficos.evolucionDiaria ?? []).map((d) => ({
        ...d,
        label:        formatFecha(d.fecha),
        ocupacion_pct: parseFloat(Number(d.ocupacion_pct).toFixed(1)),
      })),
    [data]
  );

  const sectorData = useMemo(
    () =>
      (data?.graficos.porSector ?? []).map((d) => ({
        ...d,
        ocupacion_pct: parseFloat(Number(d.ocupacion_pct).toFixed(1)),
        fill: getOcupacionColor(Number(d.ocupacion_pct)),
      })),
    [data]
  );

  const seccionData = useMemo(
    () =>
      (data?.graficos.porSeccion ?? []).map((d) => ({
        ...d,
        ocupacion_pct: parseFloat(Number(d.ocupacion_pct).toFixed(1)),
        fill: getOcupacionColor(Number(d.ocupacion_pct)),
      })),
    [data]
  );

  const hasData = !!data && (data.kpis.totalPosiciones > 0);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="p-6">
      {/* Encabezado */}
      <header className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Ocupación del Almacén — {clientName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Análisis histórico de la utilización de posiciones por sector, sección y tipo de ubicación
            </p>
          </div>
          {data?.snapshot.fecha && (
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-md">
              Snapshot al{" "}
              {new Date(data.snapshot.fecha + "T00:00:00").toLocaleDateString("es-AR", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </div>
          )}
        </div>
      </header>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 border border-gray-200 dark:border-gray-700 mb-8">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Filtros de consulta
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sector (opcional)
            </label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Ej: SECO, FRIO..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sección (opcional)
            </label>
            <input
              type="text"
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              placeholder="Ej: A, B, RACK-01..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Consultando..." : "Consultar"}
            </button>
            <button
              onClick={() => { setSector(""); setSeccion(""); }}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:cursor-not-allowed"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
        {queriedRange && (
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Período consultado:{" "}
            {new Date(queriedRange.start + "T00:00:00").toLocaleDateString("es-AR")}{" "}
            →{" "}
            {new Date(queriedRange.end + "T00:00:00").toLocaleDateString("es-AR")}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <span className="text-red-600 dark:text-red-400 font-medium">{error}</span>
          <button
            onClick={fetchData}
            className="ml-auto text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Estado inicial */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500 dark:text-gray-400">
          <div className="text-5xl mb-4">🏭</div>
          <p className="text-lg font-medium">Seleccioná un rango de fechas y presioná Consultar</p>
          <p className="text-sm mt-1">Se mostrará la evolución histórica de la ocupación del almacén</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && data && !hasData && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Sin datos para el período seleccionado
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300">
            No se encontraron registros de ocupación para las fechas y filtros indicados.
          </p>
        </div>
      )}

      {/* ── Contenido principal ─────────────────────────────────────────────── */}
      {!loading && hasData && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {kpiCards.map((k, i) => (
              <KPICard key={i} {...k} />
            ))}
          </div>

          {/* Leyenda de colores */}
          <div className="flex flex-wrap gap-3 mb-6 text-xs">
            {[
              { label: "Normal  (< 70 %)",  color: "#22c55e" },
              { label: "Media   (70–85 %)", color: "#eab308" },
              { label: "Alta    (85–95 %)", color: "#f97316" },
              { label: "Crítica (≥ 95 %)",  color: "#ef4444" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>

          {/* Evolución temporal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Evolución de la Ocupación
              </h2>
              <InfoTooltip content="Porcentaje de ocupación diario del almacén a lo largo del período seleccionado. Las líneas de referencia indican los umbrales operativos (70 %, 85 %, 95 %)." />
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={evolucionData} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v) => `${v} %`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: any) => [`${Number(v).toFixed(1)} %`, "Ocupación"]}
                  cursor={{ stroke: "#6b7280", strokeWidth: 1 }}
                />
                <ReferenceLine y={70} stroke="#eab308" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "70 %", fill: "#eab308", fontSize: 10, position: "right" }} />
                <ReferenceLine y={85} stroke="#f97316" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "85 %", fill: "#f97316", fontSize: 10, position: "right" }} />
                <ReferenceLine y={95} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "95 %", fill: "#ef4444", fontSize: 10, position: "right" }} />
                <Area
                  type="monotone"
                  dataKey="ocupacion_pct"
                  fill="#3b82f620"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#3b82f6" }}
                  name="% Ocupación"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Evolución apilada: ocupadas / libres / bloqueadas */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Distribución de Posiciones por Estado
              </h2>
              <InfoTooltip content="Evolución diaria de la composición del almacén: posiciones ocupadas (con stock), libres (vacías y disponibles) y bloqueadas. Los valores son absolutos." />
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={evolucionData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: any, name: any) => [formatN(Number(v)), name]}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
                <Bar dataKey="posiciones_ocupadas"   name="Ocupadas"   stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="posiciones_libres"     name="Libres"     stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="posiciones_bloqueadas" name="Bloqueadas" stackId="a" fill="#f97316" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sector + Picking vs Reserva */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Ocupación por sector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Ocupación por Sector
                </h2>
                <InfoTooltip content="Porcentaje de ocupación por sector al último día del período. El color indica el nivel de alerta según los umbrales operativos." />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sectorData} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="sector" width={80} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v: any, _: any, props: any) => [
                      `${Number(v).toFixed(1)} % (${formatN(props.payload.posiciones_ocupadas)} / ${formatN(props.payload.posiciones)} pos.)`,
                      "Ocupación",
                    ]}
                    cursor={false}
                  />
                  <ReferenceLine x={70} stroke="#eab308" strokeDasharray="4 3" strokeWidth={1} />
                  <ReferenceLine x={85} stroke="#f97316" strokeDasharray="4 3" strokeWidth={1} />
                  <ReferenceLine x={95} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1} />
                  <Bar dataKey="ocupacion_pct" name="% Ocupación" radius={[0, 3, 3, 0]}>
                    {sectorData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Picking vs Reserva */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Picking vs Reserva / Bulto
                </h2>
                <InfoTooltip content="Comparación de ocupación entre ubicaciones de picking (positions de extracción directa) y ubicaciones de reserva o bulto (almacenaje masivo)." />
              </div>
              <div className="space-y-4 mt-4">
                {(data?.graficos.pickingVsReserva ?? []).map((row) => {
                  const pct  = parseFloat(Number(row.ocupacion_pct).toFixed(1));
                  const col  = getOcupacionColor(pct);
                  const bdg  = getOcupacionBadge(pct);
                  return (
                    <div key={row.tipo_ubicacion} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {row.tipo_ubicacion}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bdg.classes}`}>
                            {bdg.label}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {formatPct(pct)}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className="h-3 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: col }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatN(row.posiciones_ocupadas)} ocupadas</span>
                        <span>{formatN(row.posiciones)} posiciones totales</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabla resumen */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left pb-2 text-gray-500 dark:text-gray-400 font-medium">Tipo</th>
                      <th className="text-right pb-2 text-gray-500 dark:text-gray-400 font-medium">Posiciones</th>
                      <th className="text-right pb-2 text-gray-500 dark:text-gray-400 font-medium">Ocupadas</th>
                      <th className="text-right pb-2 text-gray-500 dark:text-gray-400 font-medium">Contenedores</th>
                      <th className="text-right pb-2 text-gray-500 dark:text-gray-400 font-medium">Ocupación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.graficos.pickingVsReserva ?? []).map((row) => (
                      <tr key={row.tipo_ubicacion} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-1.5 text-gray-700 dark:text-gray-300">{row.tipo_ubicacion}</td>
                        <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{formatN(row.posiciones)}</td>
                        <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{formatN(row.posiciones_ocupadas)}</td>
                        <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{formatN(row.contenedores)}</td>
                        <td className="py-1.5 text-right font-semibold" style={{ color: getOcupacionColor(Number(row.ocupacion_pct)) }}>
                          {formatPct(Number(row.ocupacion_pct))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Top secciones */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Top Secciones por % de Ocupación
              </h2>
              <InfoTooltip content="Las 15 secciones con mayor porcentaje de ocupación al último día del período. Permite identificar zonas saturadas que requieren atención o redistribución." />
            </div>
            <ResponsiveContainer width="100%" height={Math.max(260, seccionData.length * 28)}>
              <BarChart data={seccionData} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="seccion" width={100} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: any, _: any, props: any) => [
                    `${Number(v).toFixed(1)} % · ${formatN(props.payload.contenedores)} cont. / ${formatN(props.payload.posiciones)} pos.`,
                    "Ocupación",
                  ]}
                  cursor={false}
                />
                <ReferenceLine x={70} stroke="#eab308" strokeDasharray="4 3" strokeWidth={1} />
                <ReferenceLine x={85} stroke="#f97316" strokeDasharray="4 3" strokeWidth={1} />
                <ReferenceLine x={95} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1} />
                <Bar dataKey="ocupacion_pct" name="% Ocupación" radius={[0, 3, 3, 0]}>
                  {seccionData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla detalle por sector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Detalle por Sector — Snapshot
              </h2>
              <InfoTooltip content="Tabla resumen con los indicadores de ocupación por sector al último día del período." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                    {["Sector", "Posiciones", "Ocupadas", "Libres", "Bloqueadas", "Contenedores", "% Ocupación"].map((h) => (
                      <th key={h} className="pb-3 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectorData.map((row) => {
                    const pct = row.ocupacion_pct;
                    const bdg = getOcupacionBadge(pct);
                    return (
                      <tr key={row.sector} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-gray-100">{row.sector ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{formatN(row.posiciones)}</td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{formatN(row.posiciones_ocupadas)}</td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{formatN(row.posiciones_libres)}</td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{formatN(row.posiciones_bloqueadas)}</td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{formatN(row.contenedores)}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: getOcupacionColor(pct) }}
                              />
                            </div>
                            <span className="font-semibold text-xs whitespace-nowrap" style={{ color: getOcupacionColor(pct) }}>
                              {formatPct(pct)}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${bdg.classes}`}>
                              {bdg.label}
                            </span>
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
