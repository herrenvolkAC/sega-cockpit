"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ScatterChart, Scatter
} from "recharts";
import { InfoTooltip } from "@/components/InfoTooltip";
import { clientName } from "@/lib/env";

const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 200ms ease-out forwards;
  }

  .recharts-bar-rectangle {
    transition: all 0.2s ease-in-out !important;
  }

  .recharts-bar-rectangle:hover {
    filter: brightness(1.1) !important;
    stroke: rgba(255, 255, 255, 0.2) !important;
    stroke-width: 1px !important;
  }

  .recharts-bar-rectangle.recharts-active-bar {
    filter: brightness(1.15) !important;
    stroke: rgba(255, 255, 255, 0.3) !important;
    stroke-width: 2px !important;
  }

  .recharts-active-bar-background,
  .recharts-bar-background-rectangle {
    display: none !important;
    opacity: 0 !important;
  }

  .recharts-tooltip-wrapper {
    border: 1px solid #374151 !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3) !important;
  }
`;

// Colores fijos para el pie de estado de ULs — colores visualmente distintos por nombre
const UL_COLOR_BY_NAME: Record<string, string> = {
  'Normales':     '#10b981', // verde
  'Sin Fin Prep': '#f59e0b', // ámbar
  'Sin Volumen':  '#3b82f6', // azul — diferenciado del ámbar
  'Overfill':     '#ef4444', // rojo
};
const UL_PIE_COLORS = ['#10b981', '#f59e0b', '#fb923c', '#ef4444', '#8b5cf6', '#06b6d4'];
const ulColor = (name: string, index: number) =>
  UL_COLOR_BY_NAME[name] ?? UL_PIE_COLORS[index % UL_PIE_COLORS.length];

// Función utilitaria para obtener camiones válidos
const getValidTrucks = (data: ExpedicionesData | null) => {
  if (!data?.scatterData) return [];
  return data.scatterData.filter(t => {
    if (t.tiempo_muerto === null || t.tiempo_muerto === undefined) return false;
    if (t.duracion === null || t.duracion === undefined) return false;
    if (t.tiempo_muerto < 0 || t.duracion < 0) return false;
    if (t.tiempo_muerto > 720 || t.duracion > 720) return false;
    return true;
  });
};

// Función para calcular percentiles
const calculatePercentile = (data: number[], percentile: number): number => {
  if (data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - (index - lower)) + sorted[upper] * (index - lower);
};

// Tipos para los datos de expediciones
type ExpedicionesData = {
  databaseName: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  matricula: string | null;
  totalCamiones: number;
  duracionPromedio: number;
  ocupacionPromedio: number;
  totalDestinos: number;
  tiempoMuertoPromedio: number;
  tiempoMuertoP95: number;
  camionesEspera15: number;
  camionesEspera30: number;
  tiempoMuertoTotal: number;
  duracionTotal: number;
  totalCamionesValidos: number;
  scatterCaps: {
    duracionP98: number;
    tiempoMuertoP95: number;
  };
  scatterData: Array<{
    matricula: string;
    fecha: string;
    duracion: number;
    tiempo_muerto: number;
    ocupacion: number;
    cantidad_destinos: number;
    uls: number;
  }>;
  camionesPorDia: Array<{
    dia: string;
    camiones: number;
    duracion_promedio: number;
    tiempo_muerto_promedio: number;
    ocupacion_promedio: number;
    total_destinos: number;
    total_uls: number;
  }>;
  topTiempoMuerto: Array<{
    matricula: string;
    fecha: string;
    duracion: number;
    tiempo_muerto: number;
    ocupacion: number;
    cantidad_destinos: number;
    uls: number;
  }>;
  estadoULs: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  topMatriculas: Array<{
    name: string;
    uls_total: number;
    duracion_promedio: number;
    viajes: number;
  }>;
  matriculasMasUsadas: Array<{
    name: string;
    viajes: number;
    uls_total: number;
    duracion_promedio: number;
    ocupacion_promedio: number;
    total_destinos: number;
  }>;
  generatedAt: string;
};

type BenchmarkData = {
  databaseName: string;
  datosMensuales: Array<{
    anio: number;
    mes: number;
    mesAnio: string;
    total_camiones: number;
    duracion_promedio: number;
    tiempo_muerto_promedio: number;
    ocupacion_promedio: number;
    total_destinos: number;
    total_uls: number;
  }>;
  promedioDuracionHistorico: number;
  mejorDuracion: number;
  peorDuracion: number;
  promedioOcupacionHistorico: number;
  mejorOcupacion: number;
  peorOcupacion: number;
  promedioTiempoMuertoHistorico: number;
  mejorTiempoMuerto: number;
  peorTiempoMuerto: number;
  p95TiempoMuertoHistorico: number;
  duracionActual: number;
  ocupacionActual: number;
  tiempoMuertoActual: number;
  brechaDuracionVsPromedio: number;
  brechaDuracionVsMejor: number;
  brechaOcupacionVsPromedio: number;
  brechaOcupacionVsMejor: number;
  brechaTiempoMuertoVsPromedio: number;
  brechaTiempoMuertoVsMejor: number;
  generatedAt: string;
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '6px',
  },
  labelStyle: { color: '#f3f4f6', fontWeight: 'bold' as const },
  itemStyle: { color: '#f3f4f6' },
};

export default function ExpedicionesPage() {
  const [data, setData] = useState<ExpedicionesData | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [matricula, setMatricula] = useState('');
  const [showOutliers, setShowOutliers] = useState(true);
  const matriculaRef = useRef(matricula);

  useEffect(() => {
    matriculaRef.current = matricula;
  }, [matricula]);

  const fetchExpedicionesData = useCallback(async () => {
    if (!fechaInicio || !fechaFin) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('fechaInicio', fechaInicio);
      params.append('fechaFin', fechaFin);
      if (matriculaRef.current.trim()) params.append('matricula', matriculaRef.current.trim());
      const response = await fetch(`/expediciones?${params}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error.message || 'Error desconocido');
      setData(result);
    } catch (err) {
      setError('No se pudieron cargar los datos de expediciones. Verificá la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, matricula]);

  const fetchBenchmarkData = useCallback(async () => {
    if (!fechaInicio || !fechaFin) return;
    try {
      const params = new URLSearchParams();
      params.append('fechaInicio', fechaInicio);
      params.append('fechaFin', fechaFin);
      if (matriculaRef.current.trim()) params.append('matricula', matriculaRef.current.trim());
      const response = await fetch(`/expediciones/benchmark?${params}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error.message || 'Error desconocido');
      setBenchmarkData(result);
    } catch {
      setBenchmarkData(null);
    }
  }, [fechaInicio, fechaFin, matricula]);

  useEffect(() => {
    setFechaInicio('2025-01-01');
    setFechaFin('2025-02-01');
  }, []);

  useEffect(() => {
    if (fechaInicio && fechaFin) fetchBenchmarkData();
  }, [fetchBenchmarkData]);

  const formatNumber = (num: number) => new Intl.NumberFormat("es-AR").format(num);

  // KPIs de Salud Operativa — todos calculados desde datos reales
  const kpiCards = useMemo(() => {
    if (!data || !benchmarkData) return [];

    const validTrucks = getValidTrucks(data);
    const baselineDuracion = benchmarkData.promedioDuracionHistorico || 120;

    // SLA real: camiones que cumplen duración ≤ baseline
    const cumplimientoSLA = validTrucks.length > 0
      ? (validTrucks.filter(t => t.duracion <= baselineDuracion).length / validTrucks.length) * 100
      : 0;
    const deltaVsBaseline = ((data.duracionPromedio - baselineDuracion) / baselineDuracion) * 100;

    // P95 real calculado desde scatter data
    const duracionValues = validTrucks.map(t => t.duracion);
    const p95Real = calculatePercentile(duracionValues, 95);
    const baselineP95 = benchmarkData.promedioDuracionHistorico * 1.5 || 180;

    // Peor camión individual (no promedio diario)
    const peorCamion = validTrucks.length > 0
      ? validTrucks.reduce((peor, t) => t.duracion > peor.duracion ? t : peor)
      : null;

    return [
      {
        title: "% Cumplimiento SLA",
        value: `${cumplimientoSLA.toFixed(1)}%`,
        subtitle: `Camiones ≤ ${baselineDuracion.toFixed(0)} min`,
        color: cumplimientoSLA >= 95 ? "green" as const :
               cumplimientoSLA >= 85 ? "yellow" as const : "red" as const,
        delta: undefined as number | undefined,
        tooltip: `Porcentaje de camiones individuales cuya duración de carga fue ≤ ${baselineDuracion.toFixed(0)} min (baseline histórica de los últimos 10 meses). Base: ${validTrucks.length} viajes válidos.`
      },
      {
        title: "Duración Promedio",
        value: `${data.duracionPromedio.toFixed(0)} min`,
        subtitle: `vs ${baselineDuracion.toFixed(0)} min histórica`,
        color: deltaVsBaseline <= 0 ? "green" as const :
               deltaVsBaseline <= 10 ? "yellow" as const : "red" as const,
        delta: deltaVsBaseline,
        tooltip: `Tiempo promedio de carga del período vs promedio histórico de los últimos 10 meses (${baselineDuracion.toFixed(0)} min). Un delta positivo indica que el período es más lento que la historia.`
      },
      {
        title: "P95 Duración",
        value: `${p95Real.toFixed(0)} min`,
        subtitle: `vs ${baselineP95.toFixed(0)} min histórica`,
        color: p95Real <= baselineP95 ? "green" as const :
               p95Real <= baselineP95 * 1.2 ? "yellow" as const : "red" as const,
        delta: baselineP95 > 0 ? ((p95Real - baselineP95) / baselineP95) * 100 : undefined,
        tooltip: `Percentil 95 de duración calculado sobre los ${validTrucks.length} viajes válidos del período. El 95% de los camiones cargaron en menos de este tiempo. Valores altos indican cola de casos problemáticos.`
      },
      {
        title: "Peor Camión del Período",
        value: peorCamion ? `${peorCamion.duracion.toFixed(0)} min` : "N/A",
        subtitle: peorCamion ? `${peorCamion.matricula} · ${peorCamion.fecha}` : "",
        color: "red" as const,
        delta: undefined,
        tooltip: peorCamion
          ? `Camión individual con mayor duración de carga en el período: ${peorCamion.matricula} el ${peorCamion.fecha} tardó ${peorCamion.duracion.toFixed(0)} minutos. Útil para investigar causas específicas.`
          : "Sin datos suficientes para identificar el caso extremo."
      }
    ];
  }, [data, benchmarkData]);

  // KPIs de Eficiencia Logística — ocupación calculada sobre camiones individuales
  const eficienciaKPIs = useMemo(() => {
    if (!data || !benchmarkData) return [];

    const validTrucks = getValidTrucks(data);
    const baselineOcupacion = benchmarkData.promedioOcupacionHistorico || 85;
    const deltaOcupacion = ((data.ocupacionPromedio - baselineOcupacion) / baselineOcupacion) * 100;

    // % calculado sobre camiones individuales (no sobre días)
    const totalValidos = validTrucks.length || 1;
    const contenedoresBajos = validTrucks.filter(t => t.ocupacion < 40).length;
    const contenedoresAltos = validTrucks.filter(t => t.ocupacion > 80).length;
    const porcentajeSubutilizados = (contenedoresBajos / totalValidos) * 100;
    const porcentajeCargaAlta = (contenedoresAltos / totalValidos) * 100;

    // Destinos baseline calculado desde histórico real (no hardcodeado)
    const baselineDestinos = benchmarkData.datosMensuales?.length > 0
      ? benchmarkData.datosMensuales.reduce((s, m) => s + m.total_destinos, 0) /
        benchmarkData.datosMensuales.reduce((s, m) => s + m.total_camiones, 0)
      : null;
    const destinosPorCamion = data.totalCamiones > 0 ? data.totalDestinos / data.totalCamiones : 0;
    const deltaDestinos = baselineDestinos
      ? ((destinosPorCamion - baselineDestinos) / baselineDestinos) * 100
      : undefined;

    return [
      {
        title: "Ocupación Promedio",
        value: `${data.ocupacionPromedio.toFixed(1)}%`,
        subtitle: `vs ${baselineOcupacion.toFixed(1)}% histórica`,
        color: deltaOcupacion >= 0 ? "green" as const :
               deltaOcupacion >= -5 ? "yellow" as const : "red" as const,
        delta: deltaOcupacion,
        tooltip: `Porcentaje de ocupación promedio del contenedor en el período vs promedio histórico de los últimos 10 meses (${baselineOcupacion.toFixed(1)}%). Mide qué tan aprovechado sale cada vehículo.`
      },
      {
        title: "% Camiones < 40% Ocupación",
        value: `${porcentajeSubutilizados.toFixed(1)}%`,
        subtitle: `${contenedoresBajos} de ${totalValidos} camiones`,
        color: porcentajeSubutilizados <= 20 ? "green" as const :
               porcentajeSubutilizados <= 30 ? "yellow" as const : "red" as const,
        delta: undefined as number | undefined,
        tooltip: `Porcentaje de camiones individuales que salieron con menos del 40% de su capacidad de carga ocupada. Representan viajes con alto desperdicio de espacio ("transportando aire"). Base: ${totalValidos} viajes válidos.`
      },
      {
        title: "% Camiones > 80% Ocupación",
        value: `${porcentajeCargaAlta.toFixed(1)}%`,
        subtitle: `${contenedoresAltos} de ${totalValidos} camiones`,
        color: porcentajeCargaAlta >= 60 ? "green" as const :
               porcentajeCargaAlta >= 40 ? "yellow" as const : "red" as const,
        delta: undefined,
        tooltip: `Porcentaje de camiones individuales que salieron con más del 80% de su capacidad ocupada. Representa el aprovechamiento óptimo de flota. Idealmente debe ser el grupo mayoritario. Base: ${totalValidos} viajes válidos.`
      },
      {
        title: "Destinos Promedio por Camión",
        value: destinosPorCamion.toFixed(1),
        subtitle: baselineDestinos ? `vs ${baselineDestinos.toFixed(1)} histórica` : "Sin baseline disponible",
        color: !baselineDestinos ? "blue" as const :
               destinosPorCamion >= baselineDestinos ? "green" as const :
               destinosPorCamion >= baselineDestinos * 0.9 ? "yellow" as const : "red" as const,
        delta: deltaDestinos,
        tooltip: "Promedio de puntos de entrega atendidos por viaje. Un valor mayor indica rutas más densas y eficientes. El baseline se calcula del promedio histórico de los últimos 10 meses."
      }
    ];
  }, [data, benchmarkData]);

  // Cálculo de cuadrantes y dominios para scatter plot
  const scatterAnalysis = useMemo(() => {
    if (!data?.scatterData || !benchmarkData) return null;

    const baselineDuracion = benchmarkData.promedioDuracionHistorico || 120;
    const baselineTiempoMuerto = benchmarkData.promedioTiempoMuertoHistorico || 5;

    const duracionCap = showOutliers
      ? Math.max(...data.scatterData.map(d => d.duracion)) + 5
      : data.scatterCaps?.duracionP98 || 180;
    const tiempoMuertoCap = showOutliers
      ? Math.max(...data.scatterData.map(d => d.tiempo_muerto)) + 10
      : data.scatterCaps?.tiempoMuertoP95 || 25;

    const validTrucks = getValidTrucks(data);
    if (validTrucks.length === 0) return null;

    const cuadrantes = { optimo: 0, carga: 0, coordinacion: 0, critico: 0 };
    validTrucks.forEach(p => {
      const durExcede = p.duracion > baselineDuracion;
      const tmExcede = p.tiempo_muerto > baselineTiempoMuerto;
      if (!durExcede && !tmExcede) cuadrantes.optimo++;
      else if (durExcede && !tmExcede) cuadrantes.carga++;
      else if (!durExcede && tmExcede) cuadrantes.coordinacion++;
      else cuadrantes.critico++;
    });

    const outliers = data.scatterData.filter(p =>
      p.duracion > (data.scatterCaps?.duracionP98 || 180) ||
      p.tiempo_muerto > (data.scatterCaps?.tiempoMuertoP95 || 25)
    );

    return { baselineDuracion, baselineTiempoMuerto, duracionCap, tiempoMuertoCap, cuadrantes, outliers: outliers.length, totalPoints: validTrucks.length, validTrucks };
  }, [data, benchmarkData, showOutliers]);

  // KPIs de Coordinación Operativa
  const coordinacionKPIs = useMemo(() => {
    if (!data || !benchmarkData) return [];
    const validTrucks = getValidTrucks(data);
    if (validTrucks.length === 0) return [];

    const tmValues = validTrucks.map(t => t.tiempo_muerto);
    const durValues = validTrucks.map(t => t.duracion);
    const tmPromedio = tmValues.reduce((s, v) => s + v, 0) / validTrucks.length;
    const p95TM = calculatePercentile(tmValues, 95);
    const pEspera15 = (validTrucks.filter(t => t.tiempo_muerto > 15).length / validTrucks.length) * 100;
    const pEspera30 = (validTrucks.filter(t => t.tiempo_muerto > 30).length / validTrucks.length) * 100;
    const tmTotal = tmValues.reduce((s, v) => s + v, 0);
    const durTotal = durValues.reduce((s, v) => s + v, 0);
    const pTMsTotal = (tmTotal + durTotal) > 0 ? (tmTotal / (tmTotal + durTotal)) * 100 : 0;

    const baselineTM = benchmarkData.promedioTiempoMuertoHistorico || 5;
    const baselineP95TM = benchmarkData.p95TiempoMuertoHistorico || 15;

    return [
      {
        title: "Tiempo Muerto Promedio",
        value: `${tmPromedio.toFixed(1)} min`,
        subtitle: `vs ${baselineTM.toFixed(1)} min histórica`,
        color: ((tmPromedio - baselineTM) / baselineTM) * 100 <= 0 ? "green" as const :
               ((tmPromedio - baselineTM) / baselineTM) * 100 <= 10 ? "yellow" as const : "red" as const,
        delta: ((tmPromedio - baselineTM) / baselineTM) * 100,
        tooltip: `Tiempo promedio desde que la mercadería está lista hasta que comienza la carga del camión, por viaje. Mide la descoordinación entre preparación y playa. Baseline histórica: ${baselineTM.toFixed(1)} min.`
      },
      {
        title: "P95 Tiempo Muerto",
        value: `${p95TM.toFixed(1)} min`,
        subtitle: `vs ${baselineP95TM.toFixed(1)} min histórica`,
        color: ((p95TM - baselineP95TM) / baselineP95TM) * 100 <= 0 ? "green" as const :
               ((p95TM - baselineP95TM) / baselineP95TM) * 100 <= 10 ? "yellow" as const : "red" as const,
        delta: ((p95TM - baselineP95TM) / baselineP95TM) * 100,
        tooltip: `El 95% de los camiones esperan menos de este tiempo. Detecta la "cola crítica" de casos con mayor demora. Valores altos sugieren problemas recurrentes en horarios o turnos específicos.`
      },
      {
        title: "% Camiones > 15 min espera",
        value: `${pEspera15.toFixed(1)}%`,
        subtitle: "Alerta moderada",
        color: pEspera15 <= 20 ? "green" as const :
               pEspera15 <= 35 ? "yellow" as const : "red" as const,
        delta: undefined as number | undefined,
        tooltip: "Porcentaje de camiones que esperaron más de 15 minutos antes de iniciar la carga. Indica nivel de congestión en playa de carga. Umbral saludable: < 20%."
      },
      {
        title: "% Camiones > 30 min espera",
        value: `${pEspera30.toFixed(1)}%`,
        subtitle: "Alerta crítica",
        color: pEspera30 <= 10 ? "green" as const :
               pEspera30 <= 20 ? "yellow" as const : "red" as const,
        delta: undefined,
        tooltip: "Porcentaje de camiones que esperaron más de 30 minutos. Esperas de esta magnitud impactan el cumplimiento de ventanas horarias de entrega. Umbral crítico: > 10%."
      },
      {
        title: "% Tiempo Muerto / Total",
        value: `${pTMsTotal.toFixed(1)}%`,
        subtitle: "Ineficiencia en dock",
        color: pTMsTotal <= 15 ? "green" as const :
               pTMsTotal <= 25 ? "yellow" as const : "red" as const,
        delta: undefined,
        tooltip: "Tiempo muerto total / (Tiempo muerto + Duración de carga) × 100. Indica qué fracción del tiempo productivo total en dock es improductivo. Umbral saludable: < 15%."
      }
    ];
  }, [data, benchmarkData]);

  if (loading) {
    return (
      <main className="p-6">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-gray-600 dark:text-gray-400">Cargando dashboard...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <main className="p-6">

        {/* Header */}
        <header className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Expediciones / Cargas — {clientName}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Panel de control de despachos y cargas de camiones
              </p>
              {data && (
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">
                  {fechaInicio && fechaFin
                    ? `${new Date(fechaInicio + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })} – ${new Date(fechaFin + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}`
                    : 'Rango seleccionado'
                  }
                  {' · '}{formatNumber(data.totalCamiones)} camiones{' · '}
                  <span className={`font-semibold ${
                    data.duracionPromedio <= 120 ? 'text-green-600 dark:text-green-400' :
                    data.duracionPromedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {data.duracionPromedio.toFixed(0)} min avg
                  </span>
                  {benchmarkData && (
                    <span className="text-gray-500 dark:text-gray-500 text-sm">
                      {' '}(Baseline 10m: {benchmarkData.promedioDuracionHistorico?.toFixed(0)} min · TM 10m: {benchmarkData.promedioTiempoMuertoHistorico?.toFixed(0)} min)
                    </span>
                  )}
                </p>
              )}
            </div>
            {data && (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-right">
                Actualizado: {new Date(data.generatedAt).toLocaleString('es-AR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </div>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
            <span className="text-red-600 dark:text-red-400 font-medium">{error}</span>
            <button
              onClick={fetchExpedicionesData}
              className="ml-auto text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 border border-gray-200 dark:border-gray-700 mb-8">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Rango de análisis
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Matrícula (Opcional)
              </label>
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Filtrar por matrícula..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchExpedicionesData}
                disabled={loading || !fechaInicio || !fechaFin}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Filtrar
              </button>
              <button
                onClick={() => { setFechaInicio(''); setFechaFin(''); setMatricula(''); setData(null); }}
                disabled={loading}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:cursor-not-allowed"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Empty state — sin fechas */}
        {!data && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Seleccioná un rango de fechas
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ingresá las fechas de inicio y fin, luego hacé clic en "Filtrar".
            </p>
          </div>
        )}

        {/* Empty state — sin datos en rango */}
        {data && data.totalCamiones === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 mb-8 text-center">
            <div className="text-5xl mb-4">🚚</div>
            <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              No hay datos en este rango
            </h3>
            <p className="text-yellow-700 dark:text-yellow-300">
              No se encontraron expediciones para el período seleccionado. Probá con otro rango de fechas.
            </p>
          </div>
        )}

        {data && data.totalCamiones > 0 && (
          <>
            {/* Sección 1 — Salud Operativa */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                Salud Operativa
                <span className="text-xs text-gray-500 font-normal">Cumplimiento y Dispersión</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpiCards.map((kpi, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
                    <div className="absolute top-2 right-2">
                      <InfoTooltip content={kpi.tooltip} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                      {kpi.title}
                      {kpi.delta !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          kpi.delta > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                          kpi.delta < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {kpi.delta > 0 ? '↑' : kpi.delta < 0 ? '↓' : '→'} {Math.abs(kpi.delta).toFixed(1)}%
                        </span>
                      )}
                    </p>
                    <p className={`text-2xl font-semibold mb-1 ${
                      kpi.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      kpi.color === 'red' ? 'text-red-700 dark:text-red-400' :
                      kpi.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-gray-900 dark:text-gray-100'
                    }`}>
                      {kpi.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sección 2 — Coordinación Operativa */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                Coordinación Operativa
                <span className="text-xs text-gray-500 font-normal">Tiempo Muerto y Espera</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {coordinacionKPIs.map((kpi, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
                    <div className="absolute top-2 right-2">
                      <InfoTooltip content={kpi.tooltip} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                      {kpi.title}
                      {kpi.delta !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          kpi.delta > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                          kpi.delta < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {kpi.delta > 0 ? '↑' : kpi.delta < 0 ? '↓' : '→'} {Math.abs(kpi.delta).toFixed(1)}%
                        </span>
                      )}
                    </p>
                    <p className={`text-2xl font-bold mb-1 ${
                      kpi.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      kpi.color === 'red' ? 'text-red-700 dark:text-red-400' :
                      kpi.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-gray-900 dark:text-gray-100'
                    }`}>
                      {kpi.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Scatter — Diagnóstico Duración vs Tiempo Muerto */}
            {scatterAnalysis && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8 relative">
                <div className="absolute top-2 right-2">
                  <InfoTooltip content="Cada punto representa un camión individual. Los cuadrantes indican el tipo de problema: Óptimo (abajo-izquierda) = sin ineficiencias; Carga (abajo-derecha) = duración excesiva pero espera breve; Coordinación (arriba-izquierda) = espera larga pero carga rápida; Crítico (arriba-derecha) = ambos problemas. Color = nivel de ocupación del contenedor." />
                </div>

                {/* Resumen cuadrantes */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Óptimo', count: scatterAnalysis.cuadrantes.optimo, color: 'green', desc: `≤${scatterAnalysis.baselineDuracion.toFixed(0)}min / ≤${scatterAnalysis.baselineTiempoMuerto.toFixed(1)}min` },
                    { label: 'Carga', count: scatterAnalysis.cuadrantes.carga, color: 'blue', desc: `>${scatterAnalysis.baselineDuracion.toFixed(0)}min / ≤${scatterAnalysis.baselineTiempoMuerto.toFixed(1)}min` },
                    { label: 'Coordinación', count: scatterAnalysis.cuadrantes.coordinacion, color: 'orange', desc: `≤${scatterAnalysis.baselineDuracion.toFixed(0)}min / >${scatterAnalysis.baselineTiempoMuerto.toFixed(1)}min` },
                    { label: 'Crítico', count: scatterAnalysis.cuadrantes.critico, color: 'red', desc: `>${scatterAnalysis.baselineDuracion.toFixed(0)}min / >${scatterAnalysis.baselineTiempoMuerto.toFixed(1)}min` },
                  ].map((q) => (
                    <div key={q.label} className={`text-center p-3 bg-${q.color}-50 dark:bg-${q.color}-900/20 rounded-lg border border-${q.color}-200 dark:border-${q.color}-800`}>
                      <div className={`text-2xl font-bold text-${q.color}-700 dark:text-${q.color}-400`}>{q.count}</div>
                      <div className={`text-xs text-${q.color}-600 dark:text-${q.color}-300`}>
                        {(q.count / scatterAnalysis.totalPoints * 100).toFixed(0)}% · {q.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{q.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Diagnóstico: Duración vs Tiempo Muerto
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Cada punto = 1 camión · {scatterAnalysis.totalPoints} analizados · {scatterAnalysis.outliers} outliers
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 text-sm"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-gray-600 dark:text-gray-400">Ocupación ≥ 60%</span></div>
                    <div className="flex items-center gap-1.5 text-sm"><div className="w-3 h-3 rounded-full bg-yellow-500"></div><span className="text-gray-600 dark:text-gray-400">40–59%</span></div>
                    <div className="flex items-center gap-1.5 text-sm"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-gray-600 dark:text-gray-400">&lt; 40%</span></div>
                    <button
                      onClick={() => setShowOutliers(!showOutliers)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        showOutliers
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {showOutliers ? 'Ocultar Outliers' : `Mostrar Outliers (${scatterAnalysis.outliers})`}
                    </button>
                  </div>
                </div>

                <div className="h-[480px]">
                  <ResponsiveContainer width="100%" height={480}>
                    <ScatterChart data={data.scatterData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                      <XAxis
                        type="number" dataKey="duracion" name="Duración" unit=" min"
                        tickCount={6} domain={[0, scatterAnalysis.duracionCap]}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        label={{ value: 'Duración de carga (min)', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#9ca3af' }}
                      />
                      <YAxis
                        type="number" dataKey="tiempo_muerto" name="Tiempo Muerto" unit=" min"
                        tickCount={6} domain={[0, scatterAnalysis.tiempoMuertoCap * 1.05]}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        label={{ value: 'Tiempo muerto (min)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9ca3af' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0].payload;
                          const isOutlier = p.duracion > (data.scatterCaps?.duracionP98 || 180) ||
                                            p.tiempo_muerto > (data.scatterCaps?.tiempoMuertoP95 || 25);
                          return (
                            <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg text-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">{p.matricula}</span>
                                {isOutlier && <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">Outlier</span>}
                              </div>
                              <div className="space-y-1">
                                {[
                                  ['Fecha', p.fecha, ''],
                                  ['Duración', `${p.duracion} min`, 'text-blue-600 dark:text-blue-400'],
                                  ['Tiempo Muerto', `${p.tiempo_muerto?.toFixed(1)} min`, 'text-orange-600 dark:text-orange-400'],
                                  ['Ocupación', `${p.ocupacion?.toFixed(1)}%`, ''],
                                  ['Destinos', p.cantidad_destinos, ''],
                                  ['ULs', p.uls, ''],
                                ].map(([label, val, cls]) => (
                                  <div key={label as string} className="flex justify-between gap-4">
                                    <span className="text-gray-500 dark:text-gray-400">{label}:</span>
                                    <span className={`font-medium text-gray-900 dark:text-gray-100 ${cls}`}>{val}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        name="Camiones"
                        dataKey="tiempo_muerto"
                        shape={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isOutlier = payload.duracion > (data.scatterCaps?.duracionP98 || 180) ||
                                            payload.tiempo_muerto > (data.scatterCaps?.tiempoMuertoP95 || 25);
                          const color = payload.ocupacion >= 60 ? '#10b981' : payload.ocupacion >= 40 ? '#eab308' : '#ef4444';
                          return <circle cx={cx} cy={cy} r={isOutlier ? 6 : 4} fill={color} fillOpacity={0.7} stroke={color} strokeWidth={isOutlier ? 2 : 1} strokeDasharray={isOutlier ? "2 2" : "0"} />;
                        }}
                      />
                      <ReferenceLine x={scatterAnalysis.baselineDuracion} stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={2}
                        label={{ value: `Baseline duración: ${scatterAnalysis.baselineDuracion.toFixed(0)} min`, position: "top", fill: "#3b82f6", fontSize: 11 }} />
                      <ReferenceLine y={scatterAnalysis.baselineTiempoMuerto} stroke="#f97316" strokeDasharray="5 5" strokeWidth={2}
                        label={{ value: `Baseline TM: ${scatterAnalysis.baselineTiempoMuerto.toFixed(0)} min`, position: "left", fill: "#f97316", fontSize: 11 }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                {/* Insight accionable */}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Insight Operativo</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {(() => {
                      const { optimo, carga, coordinacion, critico } = scatterAnalysis.cuadrantes;
                      const total = scatterAnalysis.totalPoints;
                      const pCoord = (coordinacion / total) * 100;
                      const pCarga = (carga / total) * 100;
                      const pCrit = (critico / total) * 100;
                      const pOpt = (optimo / total) * 100;

                      if (pOpt >= 70) return `Período saludable: ${pOpt.toFixed(0)}% de los camiones operaron dentro de los parámetros normales.`;
                      if (pCrit > 20) return `Situación crítica: ${critico} camiones (${pCrit.toFixed(0)}%) presentaron tanto demora en carga como en espera. Revisar coordinación de turnos y disponibilidad de muelles.`;
                      if (pCoord > pCarga && pCoord > 20) return `Problema principal: descoordinación entre preparación y playa. ${coordinacion} camiones (${pCoord.toFixed(0)}%) esperaron más de lo habitual sin problema de carga. Revisar sincronía entre armado de pedidos y asignación de muelles.`;
                      if (pCarga > pCoord && pCarga > 20) return `Problema principal: duración excesiva de carga. ${carga} camiones (${pCarga.toFixed(0)}%) tardaron más de lo normal pese a espera breve. Revisar dotación de operarios y procedimientos de carga.`;
                      return `Distribución mixta sin patrón dominante. ${(pCoord + pCarga + pCrit).toFixed(0)}% de camiones con algún tipo de ineficiencia.`;
                    })()}
                  </p>
                </div>
              </div>
            )}

            {/* Sección 3 — Eficiencia Logística */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                Eficiencia Logística
                <span className="text-xs text-gray-500 font-normal">Utilización y Rendimiento</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {eficienciaKPIs.map((kpi, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
                    <div className="absolute top-2 right-2">
                      <InfoTooltip content={kpi.tooltip} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                      {kpi.title}
                      {kpi.delta !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          kpi.delta > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                          kpi.delta < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {kpi.delta > 0 ? '↑' : kpi.delta < 0 ? '↓' : '→'} {Math.abs(kpi.delta).toFixed(1)}%
                        </span>
                      )}
                    </p>
                    <p className={`text-2xl font-semibold mb-1 ${
                      kpi.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      kpi.color === 'red' ? 'text-red-700 dark:text-red-400' :
                      kpi.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-gray-900 dark:text-gray-100'
                    }`}>
                      {kpi.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Contexto histórico 10 meses */}
        {benchmarkData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8 animate-fade-in relative">
            <div className="absolute top-2 right-2">
              <InfoTooltip content="Promedio histórico de los últimos 10 meses. Sirve de baseline dinámico para comparar el período actual. Se actualiza mensualmente." />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              Contexto Histórico — 10 meses
              <span className="text-xs text-gray-500 font-normal">Baseline y Tendencia</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Duración promedio 10m', value: `${benchmarkData.promedioDuracionHistorico?.toFixed(0) ?? 'N/A'} min`, sub: 'Baseline dinámico' },
                { label: 'P95 duración 10m', value: `${((benchmarkData.promedioDuracionHistorico || 120) * 1.5).toFixed(0)} min`, sub: 'Percentil 95 est.' },
                { label: 'Ocupación promedio 10m', value: `${benchmarkData.promedioOcupacionHistorico?.toFixed(1) ?? 'N/A'}%`, sub: 'Eficiencia base' },
                { label: 'Tiempo muerto promedio 10m', value: `${benchmarkData.promedioTiempoMuertoHistorico?.toFixed(1) ?? 'N/A'} min`, sub: 'Baseline dinámico' },
                { label: 'P95 tiempo muerto 10m', value: `${benchmarkData.p95TiempoMuertoHistorico?.toFixed(1) ?? 'N/A'} min`, sub: 'Percentil 95' },
              ].map((item) => (
                <div key={item.label} className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{item.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.sub}</p>
                </div>
              ))}
            </div>
            {benchmarkData.datosMensuales?.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Tendencia Mensual — Duración Promedio
                </h3>
                <ResponsiveContainer width="100%" height={128}>
                  <LineChart data={benchmarkData.datosMensuales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                    <XAxis dataKey="mesAnio" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip {...tooltipStyle} />
                    <Line type="monotone" dataKey="duracion_promedio" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Gráficos de tendencia diaria */}
        {data && data.totalCamiones > 0 && (
          <div className="grid grid-cols-1 gap-8 mb-8">

            {/* Duración y Ocupación por Día — dual Y axis */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Evolución diaria de la duración promedio de carga (eje izquierdo, minutos) y del nivel de ocupación promedio del contenedor (eje derecho, %). Las dos métricas tienen escalas distintas." />
              </div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Duración y Ocupación de Contenedores por Día
                </h2>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-blue-500"></div><span className="text-gray-600 dark:text-gray-400">Duración (min) ←</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-green-600"></div><span className="text-gray-600 dark:text-gray-400">Ocupación (%) →</span></div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.camionesPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }} label={{ value: 'min', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} domain={[0, 100]} label={{ value: '%', angle: 90, position: 'insideRight', fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg text-sm">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Duración:</span><span className="font-medium text-blue-600 dark:text-blue-400">{d.duracion_promedio?.toFixed(0)} min</span></div>
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Ocupación:</span><span className="font-medium text-green-600 dark:text-green-400">{d.ocupacion_promedio?.toFixed(1)}%</span></div>
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Camiones:</span><span className="font-medium text-gray-900 dark:text-gray-100">{d.camiones}</span></div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="duracion_promedio" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="ocupacion_promedio" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                  {benchmarkData && (
                    <ReferenceLine yAxisId="left" y={benchmarkData.promedioDuracionHistorico || 120}
                      stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'Baseline 10m', fontSize: 10, fill: '#ef4444' }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Duración vs Tiempo Muerto por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Comparación diaria entre duración de carga (azul) y tiempo muerto promedio (naranja). Permite detectar si los picos de demora son por carga lenta o por falta de coordinación." />
              </div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Duración vs Tiempo Muerto por Día
                </h2>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-blue-500"></div><span className="text-gray-600 dark:text-gray-400">Duración (min)</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-orange-500"></div><span className="text-gray-600 dark:text-gray-400">Tiempo Muerto (min)</span></div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.camionesPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg text-sm">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Duración:</span><span className="font-medium text-blue-600 dark:text-blue-400">{d.duracion_promedio?.toFixed(0)} min</span></div>
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Tiempo Muerto:</span><span className="font-medium text-orange-600 dark:text-orange-400">{d.tiempo_muerto_promedio?.toFixed(1)} min</span></div>
                            <div className="flex justify-between gap-4"><span className="text-gray-500">Camiones:</span><span className="font-medium text-gray-900 dark:text-gray-100">{d.camiones}</span></div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="duracion_promedio" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                  <Line type="monotone" dataKey="tiempo_muerto_promedio" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} />
                  {benchmarkData && (
                    <ReferenceLine y={benchmarkData.promedioTiempoMuertoHistorico || 5}
                      stroke="#f97316" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: 'Baseline TM 10m', fontSize: 10, fill: '#f97316' }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top Matrículas y Estado ULs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top 10 Matrículas por ULs */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
                <div className="absolute top-2 right-2">
                  <InfoTooltip content="Las 10 matrículas (vehículos) que más ULs transportaron en el período. Una UL (Unidad de Logística) es un contenedor o pallet preparado y cargado para despacho. Útil para identificar la flota más activa." />
                </div>
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Top 10 Matrículas por ULs</h2>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.topMatriculas} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} angle={-45} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => formatNumber(Number(v))} />
                    <Tooltip formatter={(v: any) => [formatNumber(Number(v)), 'ULs']} {...tooltipStyle} cursor={false} />
                    <Bar dataKey="uls_total" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Estado de ULs */}
              {data.estadoULs && data.estadoULs.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
                  <div className="absolute top-2 right-2">
                    <InfoTooltip content="Distribución de ULs (Unidades de Logística) por estado de procesamiento. Normales: procesadas sin incidencias. Sin Fin Prep: sin fecha/hora de fin de preparación registrada (posible problema de cierre en WMS). Sin Volumen: UL sin volumen de carga registrado. Overfill: supera la capacidad máxima del vehículo asignado." />
                  </div>
                  <div className="mb-4">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Estado de ULs</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      UL = Unidad de Logística (contenedor/pallet preparado para despacho)
                    </p>
                  </div>
                  <div className="flex flex-col lg:flex-row items-center gap-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={data.estadoULs.filter(e => (e.value ?? 0) > 0)}
                          cx="50%" cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          labelLine={true}
                          label={({ name, percent }: any) =>
                            (percent ?? 0) > 0.04 ? `${name}: ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                          }
                        >
                          {data.estadoULs.filter(e => (e.value ?? 0) > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={ulColor(entry.name, index)} stroke="#fff" strokeWidth={1} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => [formatNumber(Number(v)), 'ULs']} {...tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 min-w-[160px]">
                      {data.estadoULs.map((item, index) => {
                        const validTotal = data.estadoULs.filter(e => (e.value ?? 0) > 0).reduce((s, e) => s + e.value, 0);
                        const pct = validTotal > 0 && item.value > 0 ? ((item.value / validTotal) * 100).toFixed(1) : '0';
                        return (
                          <div key={index} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ulColor(item.name, index) }} />
                            <div className="flex flex-col">
                              <span className="font-medium leading-tight">{item.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(item.value)} · {pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Top 10 Camiones con Mayor Tiempo Muerto */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Los 10 viajes individuales con mayor tiempo de espera antes del inicio de carga en el período. Estos casos son candidatos directos a una investigación de causa raíz: turno, muelle asignado, tipo de ruta o problemas de coordinación con el preparador." />
              </div>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Top 10 Camiones con Mayor Tiempo Muerto
                </h2>
                {(() => {
                  const validTrucks = getValidTrucks(data);
                  const top10 = validTrucks.filter(t => t.tiempo_muerto > 0).sort((a, b) => b.tiempo_muerto - a.tiempo_muerto).slice(0, 10);
                  if (top10.length === 0) return null;
                  const totalTM = validTrucks.reduce((s, t) => s + t.tiempo_muerto, 0);
                  const top10TM = top10.reduce((s, t) => s + t.tiempo_muerto, 0);
                  const pct = totalTM > 0 ? (top10TM / totalTM * 100).toFixed(1) : '0';
                  return <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Top 10 explican {pct}% del tiempo muerto total del período</p>;
                })()}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={getValidTrucks(data).filter(t => t.tiempo_muerto > 0).sort((a, b) => b.tiempo_muerto - a.tiempo_muerto).slice(0, 10).map(t => ({ name: t.matricula || 'N/A', tiempo_muerto: t.tiempo_muerto, fecha: t.fecha }))}
                  margin={{ top: 4, right: 16, left: 8, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} angle={-45} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${v} min`} />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-gray-900 p-3 border border-gray-700 rounded-lg shadow-lg text-sm">
                          <p className="font-medium text-gray-100 mb-1">{d.name}</p>
                          <div className="flex justify-between gap-4"><span className="text-gray-400">Fecha:</span><span className="text-gray-100">{d.fecha}</span></div>
                          <div className="flex justify-between gap-4"><span className="text-gray-400">Tiempo Muerto:</span><span className="font-medium text-orange-400">{d.tiempo_muerto} min</span></div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="tiempo_muerto" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
        )}
      </main>
    </>
  );
}
