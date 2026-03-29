"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Area, BarChart } from "recharts";
import { DarkChartThemeProvider, darkChartConfig } from '@/components/dashboard/DarkChartTheme';
import { InfoTooltip } from '@/components/InfoTooltip';
import { clientName } from "@/lib/env";

// Tipos para los datos de recepciones
type BenchmarkStats = {
  promedio: number;
  mediana: number;
  p25: number;
  p75: number;
  p10: number;
  p90: number;
  stddev: number;
  cv: number;
};

type RecepcionesData = {
  databaseName: string;
  fechaInicio: string;
  fechaFin: string;
  filtros: {
    proveedor: string;
    sku: string;
  };
  // Datos para gráficos
  ulsPorDia: Array<{
    fecha: string;
    dia: string;
    uls: number;
  }>;
  cajasPorDia: Array<{
    fecha: string;
    dia: string;
    cajas: number;
  }>;
  tiempoRecepcionPorDia: Array<{
    fecha: string;
    dia: string;
    tiempo_promedio_horas: number;
    esOutlier?: boolean;
    esAtipico?: boolean;
  }>;
  tiempoCamionPorDia: Array<{
    fecha: string;
    dia: string;
    tiempo_promedio_horas: number;
    esOutlier?: boolean;
    esAtipico?: boolean;
  }>;
  recepcionesPorSeccion: Array<{
    sector: string;
    uls: number;
    porcentaje: number;
  }>;
  franjaHoraria: Array<{
    hora: number;
    label: string;
    camiones: number;
    uls: number;
  }>;
  rankingProveedores: Array<{
    proveedor: string;
    recepciones: number;
    total_uls: number;
    total_cajas: number;
    tiempo_recepcion_avg_h: number | null;
    cajas_por_ul: number | null;
  }>;
  throughputDiario: Array<{
    fecha: string;
    dia: string;
    uls_total: number;
    horas_operativas: number | null;
    uls_por_hora: number | null;
  }>;
  // Benchmarks estadísticos (con outliers)
  benchmarks: {
    tiempoRecepcion: BenchmarkStats | null;
    tiempoCamion: BenchmarkStats | null;
  };
  // Benchmarks robustos (sin outliers extremos)
  benchmarks_robust: {
    tiempoRecepcion: BenchmarkStats | null;
    tiempoCamion: BenchmarkStats | null;
    metodo: string;
    outliers_camion: {
      high_count: number;
      low_count: number;
    };
  };
  // KPIs originales (promedio diario)
  kpis: {
    totalUls: number;
    totalCajas: number;
    totalDias: number;
    tiempoPromedioRecepcion: number;
    totalSecciones: number;
    totalSectoresCatalogo: number;
  };
  // KPIs ponderados del período (promedio real por evento)
  kpis_periodo: {
    recepcion_avg_h_ponderado: number;
    recepcion_eventos: number;
    camion_avg_h_ponderado: number;
    camion_eventos: number;
  };
  generatedAt: string;
};

export default function RecepcionesPage() {
  const [data, setData] = useState<RecepcionesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [sku, setSku] = useState('');
  const [useRobustBenchmarks, setUseRobustBenchmarks] = useState(true);
  const [queriedRange, setQueriedRange] = useState<{ start: string; end: string } | null>(null);
  const [statsTab, setStatsTab] = useState<'analisis' | 'metodologia'>('analisis');

  // Fetch data from API con filtros de fecha, proveedor y SKU
  const fetchRecepcionesData = useCallback(
    async () => {

      
      if (!fechaInicio || !fechaFin) {
        alert('Por favor seleccione un rango de fechas');
        return;
      }

      setLoading(true);
      
      try {
        // Convertir fechas al formato que espera el backend
        const convertToBackendFormat = (dateStr: string): string => {
          return dateStr.replace(/-/g, ''); // YYYY-MM-DD -> YYYYMMDD
        };
        
        const params = new URLSearchParams();
        params.append('fechaInicio', convertToBackendFormat(fechaInicio));
        params.append('fechaFin', convertToBackendFormat(fechaFin));
        
        // Agregar proveedor solo si tiene un valor
        if (proveedor.trim()) {
          params.append('proveedor', proveedor.trim());
        }
        
        // Agregar SKU solo si tiene un valor
        if (sku.trim()) {
          params.append('sku', sku.trim());
        }
        
        const url = `/api/recepciones?${params}`;

        
        const response = await fetch(url);
        
if (!response.ok) {
  throw new Error(`Error del backend: ${response.status}`);
}

const result = await response.json();
setData(result.data);
setQueriedRange({ start: fechaInicio, end: fechaFin });
      } catch (error) {

        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [fechaInicio, fechaFin, proveedor, sku]
  );

  // Cargar datos iniciales
  useEffect(() => {
    setFechaInicio('2025-01-01');
    setFechaFin('2025-02-01');
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("es-AR").format(num);
  };

  // KPI Cards — grid único de 8 tarjetas (4 columnas × 2 filas en desktop)
  const kpiCards = useMemo(() => {
    if (!data) return [];

    return [
        {
          title: "Total ULs",
          value: formatNumber(data.kpis.totalUls),
          icon: "🏗️",
          color: "blue" as const,
          tooltip: "Total de Unidades Logísticas (pallets, cajas, bultos) recibidas en el período. Refleja el volumen físico procesado en el sector de recepción."
        },
        {
          title: "Total Cajas",
          value: formatNumber(data.kpis.totalCajas),
          icon: "📦",
          color: "green" as const,
          tooltip: "Total de cajas recibidas como parte de las unidades logísticas del período. Permite medir el volumen desagregado por tipo de unidad."
        },
        {
          title: "Días con Recepción",
          value: formatNumber(data.kpis.totalDias),
          icon: "📅",
          color: "orange" as const,
          tooltip: "Cantidad de días del período que tuvieron al menos una recepción registrada. Indica el nivel de actividad operativa del área."
        },
        {
          title: "Sectores Activos",
          value: data.kpis.totalSectoresCatalogo > 0
            ? `${data.kpis.totalSecciones} / ${data.kpis.totalSectoresCatalogo}`
            : formatNumber(data.kpis.totalSecciones),
          subtitle: data.kpis.totalSectoresCatalogo > 0
            ? `${Math.round((data.kpis.totalSecciones / data.kpis.totalSectoresCatalogo) * 100)}% con actividad`
            : "Con recepciones en el período",
          icon: "🏭",
          color: "yellow" as const,
          tooltip: "Sectores del almacén que recibieron mercadería en el período, sobre el total de sectores disponibles en el catálogo. Un porcentaje bajo puede indicar concentración de carga o sectores inactivos."
        },
        ...(() => {
          const cajasUl = data.kpis.totalUls > 0 ? (data.kpis.totalCajas / data.kpis.totalUls) : 0;
          const brechaH = data.kpis_periodo.camion_avg_h_ponderado - data.kpis_periodo.recepcion_avg_h_ponderado;
          const brechaMin = Math.round(brechaH * 60);
          return [
            {
              title: "Tiempo de Recepción",
              value: `${data.kpis_periodo.recepcion_avg_h_ponderado.toFixed(1)}h`,
              subtitle: `${formatNumber(data.kpis_periodo.recepcion_eventos)} eventos`,
              icon: "⏱️",
              color: "purple" as const,
              tooltip: "Tiempo promedio ponderado desde el ingreso de la UL hasta su ubicación definitiva, calculado sobre cada evento individual del período."
            },
            {
              title: "Estadía Camión",
              value: `${data.kpis_periodo.camion_avg_h_ponderado.toFixed(1)}h`,
              subtitle: `${formatNumber(data.kpis_periodo.camion_eventos)} eventos`,
              icon: "🚛",
              color: "indigo" as const,
              tooltip: "Tiempo promedio ponderado que un camión permanece en las instalaciones. Incluye espera, descarga y documentación."
            },
            {
              title: "Brecha de Muelle",
              value: brechaH >= 0 ? `+${brechaMin} min` : `${brechaMin} min`,
              subtitle: "Estadía − recepción activa",
              icon: brechaMin > 60 ? "🔴" : brechaMin > 30 ? "🟡" : "🟢",
              color: (brechaMin > 60 ? "red" : brechaMin > 30 ? "orange" : "green") as any,
              tooltip: `Tiempo improductivo en muelle (${data.kpis_periodo.camion_avg_h_ponderado.toFixed(1)}h estadía − ${data.kpis_periodo.recepcion_avg_h_ponderado.toFixed(1)}h recepción). > 60 min = crítico.`
            },
            {
              title: "Densidad (Cajas/UL)",
              value: cajasUl > 0 ? cajasUl.toFixed(1) : "—",
              subtitle: `${formatNumber(data.kpis.totalCajas)} cajas / ${formatNumber(data.kpis.totalUls)} ULs`,
              icon: "📐",
              color: "yellow" as const,
              tooltip: "Promedio de cajas por Unidad Logística. Alta densidad = más trabajo de desconsolidación por pallet."
            }
          ];
        })()
      ];
  }, [data]);

  if (loading) {
    return (
      <main className="p-6">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg">Cargando dashboard...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <DarkChartThemeProvider>
      <main className="p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Recepciones — {clientName}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {queriedRange
            ? `Período consultado: ${new Date(queriedRange.start + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })} – ${new Date(queriedRange.end + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}`
            : 'Seleccione un rango de fechas y presione Filtrar'}
        </p>
      </header>

      
      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 mb-8">
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
              Proveedor (Opcional)
            </label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Dejar vacío para todos los proveedores"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SKU (Opcional)
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Dejar vacío para todos los SKUs"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={fetchRecepcionesData}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Cargando...' : 'Filtrar'}
            </button>
            <button
              onClick={() => {
                setProveedor('');
                setSku('');
                setData(null);
                setQueriedRange(null);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>
      
      {/* Empty State */}
      {data && data.kpis.totalDias === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 mb-8 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            No hay datos en este rango
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 mb-6">
            No se encontraron registros de recepciones para el período seleccionado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700 dark:text-yellow-300">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">💡 Sugerencias:</h4>
              <ul className="space-y-1 text-left">
                <li>• Prueba fechas de 2024 o 2025</li>
                <li>• Usa rangos más amplios (30+ días)</li>
                <li>• Verifica fechas de fin de mes</li>
                <li>• Prueba períodos de alta actividad</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">📅 Rangos recomendados:</h4>
              <div className="space-y-2 text-left">
                <button 
                  onClick={() => {
                    const lastMonth = new Date();
                    lastMonth.setMonth(lastMonth.getMonth() - 1);
                    const start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
                    const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
                    setFechaInicio(start.toISOString().split('T')[0]);
                    setFechaFin(end.toISOString().split('T')[0]);
                  }}
                  className="w-full text-left px-3 py-2 bg-yellow-100 dark:bg-yellow-800 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
                >
                  📅 Mes pasado
                </button>
                <button 
                  onClick={() => {
                    const start = new Date(2024, 0, 1);
                    const end = new Date(2024, 11, 31);
                    setFechaInicio(start.toISOString().split('T')[0]);
                    setFechaFin(end.toISOString().split('T')[0]);
                  }}
                  className="w-full text-left px-3 py-2 bg-yellow-100 dark:bg-yellow-800 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
                >
                  📅 Todo 2024
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* KPI Cards — grid único uniforme */}
      {data && data.kpis.totalDias > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {kpiCards.map((kpi: any, index: number) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 relative">
              {kpi.tooltip && <div className="absolute top-2 right-2"><InfoTooltip content={kpi.tooltip} /></div>}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate pr-4">{kpi.title}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{kpi.value}</p>
                  {kpi.subtitle && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{kpi.subtitle}</p>
                  )}
                </div>
                <div className="text-xl flex-shrink-0">{kpi.icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts - Reportes */}
      {data && data.kpis.totalDias > 0 && (
        <>
          {/* Gráfico Combinado de Volumen */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8 relative">
            <div className="absolute top-2 right-2">
              <InfoTooltip content="Evolución diaria del volumen recepcionado. Las barras azules (eje izquierdo) representan ULs (pallets/bultos). La línea verde (eje derecho) representa cajas. Ambas métricas tienen escalas independientes — verificar los ejes Y al comparar magnitudes." />
            </div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              📊 Volumen Recepcionado por Día
            </h2>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={data.ulsPorDia.map((uls, index) => ({
                ...uls,
                cajas: data.cajasPorDia[index]?.cajas || 0
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis 
                  yAxisId="left" 
                  tick={{ fontSize: 11 }} 
                  tickFormatter={(value) => formatNumber(Number(value))}
                  label={{ value: 'ULs', angle: -90, position: 'insideLeft' }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  tick={{ fontSize: 11 }} 
                  tickFormatter={(value) => formatNumber(Number(value))}
                  label={{ value: 'Cajas', angle: 90, position: 'insideRight' }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            {payload[0].payload.dia}
                          </p>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex justify-between gap-4 text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                {entry.name === 'uls' ? 'ULs:' : 'Cajas:'}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {formatNumber(Number(entry.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="uls" 
                  fill="#3b82f6" 
                  name="ULs"
                  fillOpacity={1}
                  stroke="transparent"
                  strokeWidth={0}
                  radius={[2, 2, 0, 0]}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="cajas" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Cajas"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Grid 2x2 para los gráficos de tiempo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

            {/* 3. Tiempo Medio de Recepción por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Evolución diaria del tiempo promedio de recepción por UL. La banda amarilla representa el rango normal histórico (P10-P90). Las líneas punteadas grises marcan los percentiles P25 y P75. Los puntos rojos son días atípicos (outliers) que se salen del rango esperado." />
              </div>
              <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100">
                ⏱️ Tiempo Medio de Recepción (Horas)
              </h2>
              <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 rounded-sm bg-amber-100 dark:bg-amber-900/40 border border-amber-300"></span> Banda P10-P90</span>
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-0 border-t-2 border-dashed border-gray-400"></span> P25 / P75</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500 border-2 border-white"></span> Outlier</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.tiempoRecepcionPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value.toFixed(1)}h`} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              {data.dia}
                            </p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Tiempo:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {data.tiempo_promedio_horas.toFixed(1)}h
                                </span>
                              </div>
                              {data.esOutlier && (
                                <div className="text-xs text-orange-600 dark:text-orange-400">
                                  ⚠️ Valor fuera de rango ampliado
                                </div>
                              )}
                              {data.esAtipico && (
                                <div className="text-xs text-red-600 dark:text-red-400">
                                  🚨 Evento Atípico
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  
                  {/* Bandas P10-P90 */}
                  {data.benchmarks.tiempoRecepcion && (
                    <>
                      <Area
                        type="monotone"
                        dataKey={() => data.benchmarks.tiempoRecepcion!.p90}
                        fill="#fef3c7"
                        stroke="none"
                        fillOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey={() => data.benchmarks.tiempoRecepcion!.p10}
                        fill="#ffffff"
                        stroke="none"
                        fillOpacity={1}
                      />
                      
                      {/* Líneas de referencia */}
                      <Line
                        type="monotone"
                        dataKey={() => data.benchmarks.tiempoRecepcion!.promedio}
                        stroke="#6b7280"
                        strokeDasharray="5 5"
                        strokeWidth={1.5}
                        dot={false}
                        name="Promedio"
                      />
                      <Line
                        type="monotone"
                        dataKey={() => data.benchmarks.tiempoRecepcion!.p75}
                        stroke="#d1d5db"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        dot={false}
                        name="P75"
                      />
                      <Line
                        type="monotone"
                        dataKey={() => data.benchmarks.tiempoRecepcion!.p25}
                        stroke="#d1d5db"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        dot={false}
                        name="P25"
                      />
                    </>
                  )}
                  
                  <Line 
                    type="monotone" 
                    dataKey="tiempo_promedio_horas" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.esOutlier) {
                        return <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />;
                      }
                      return <circle cx={cx} cy={cy} r={3} fill="#f59e0b" />;
                    }}
                    activeDot={{ r: 6 }}
                    name="Tiempo Promedio (h)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 4. Tiempo Medio de Estadía de Camión por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Evolución diaria del tiempo promedio de estadía del camión en las instalaciones (ingreso → retiro). La banda violeta representa el rango normal histórico (P10-P90). Los puntos rojos son días atípicos. Si el modo Robusto está activo, los outliers extremos quedan excluidos del cálculo de la banda." />
              </div>
              <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100">
                🚛 Tiempo Medio de Estadía de Camión (Horas)
              </h2>
              <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 rounded-sm bg-violet-100 dark:bg-violet-900/40 border border-violet-300"></span> Banda P10-P90</span>
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-0 border-t-2 border-dashed border-gray-400"></span> P25 / P75</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500 border-2 border-white"></span> Outlier</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.tiempoCamionPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value.toFixed(1)}h`} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              {data.dia}
                            </p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Tiempo:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {data.tiempo_promedio_horas.toFixed(1)}h
                                </span>
                              </div>
                              {data.esOutlier && (
                                <div className="text-xs text-orange-600 dark:text-orange-400">
                                  ⚠️ Valor fuera de rango ampliado
                                </div>
                              )}
                              {data.esAtipico && (
                                <div className="text-xs text-red-600 dark:text-red-400">
                                  🚨 Evento Atípico
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  
                  {/* Bandas P10-P90 */}
                  {(() => {
                    const camionBenchmarks = useRobustBenchmarks && data.benchmarks_robust.tiempoCamion 
                      ? data.benchmarks_robust.tiempoCamion 
                      : data.benchmarks.tiempoCamion;
                    
                    return camionBenchmarks && (
                      <>
                        <Area 
                          type="monotone" 
                          dataKey={() => camionBenchmarks.p90} 
                          fill="#ede9fe" 
                          stroke="none" 
                          fillOpacity={0.3} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey={() => camionBenchmarks.p10} 
                          fill="#ffffff" 
                          stroke="none" 
                          fillOpacity={1} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey={() => camionBenchmarks.promedio} 
                          stroke="#6b7280" 
                          strokeDasharray="5 5" 
                          strokeWidth={1.5} 
                          dot={false} 
                          name="Promedio" 
                        />
                        <Line 
                          type="monotone" 
                          dataKey={() => camionBenchmarks.p75} 
                          stroke="#d1d5db" 
                          strokeDasharray="3 3" 
                          strokeWidth={1} 
                          dot={false} 
                          name="P75" 
                        />
                        <Line 
                          type="monotone" 
                          dataKey={() => camionBenchmarks.p25} 
                          stroke="#d1d5db" 
                          strokeDasharray="3 3" 
                          strokeWidth={1} 
                          dot={false} 
                          name="P25" 
                        />
                      </>
                    );
                  })()}
                  
                  <Line 
                    type="monotone" 
                    dataKey="tiempo_promedio_horas" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.esOutlier) {
                        return <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />;
                      }
                      return <circle cx={cx} cy={cy} r={3} fill="#8b5cf6" />;
                    }}
                    activeDot={{ r: 6 }}
                    name="Tiempo Promedio Camión (h)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

          </div>

          {/* Panel de Análisis Estadístico del Período */}
          {(data.benchmarks.tiempoRecepcion || data.benchmarks.tiempoCamion) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-8">
              {/* Header con tabs */}
              <div className="flex items-center justify-between px-6 pt-5 pb-0 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    📈 Análisis Estadístico del Período
                  </h3>
                  <div className="flex gap-0">
                    {(['analisis', 'metodologia'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setStatsTab(tab)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                          statsTab === tab
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        {tab === 'analisis' ? 'Análisis' : 'Metodología'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Toggle solo visible en tab analisis */}
                {statsTab === 'analisis' && data.benchmarks_robust.tiempoCamion && (
                  <div className="flex items-center gap-2 pb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Benchmark:</span>
                    <button
                      onClick={() => setUseRobustBenchmarks(!useRobustBenchmarks)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useRobustBenchmarks ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useRobustBenchmarks ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {useRobustBenchmarks ? 'Robusto' : 'Con outliers'}
                    </span>
                    <InfoTooltip content="Robusto: excluye días atípicos del cálculo de rangos. Con outliers: incluye todos los días, incluso feriados o situaciones excepcionales." position="bottom" />
                  </div>
                )}
              </div>

              <div className="p-6">
                {/* Tab Análisis */}
                {statsTab === 'analisis' && (
                  <>
                    {useRobustBenchmarks && data.benchmarks_robust.tiempoCamion && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          📊 <strong>Modo robusto activado:</strong> {data.benchmarks_robust.metodo} |{' '}
                          Outliers camión: {data.benchmarks_robust.outliers_camion.high_count} altos, {data.benchmarks_robust.outliers_camion.low_count} bajos
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Tiempo de Recepción */}
                      {(() => {
                        const b = useRobustBenchmarks && data.benchmarks_robust.tiempoRecepcion
                          ? data.benchmarks_robust.tiempoRecepcion
                          : data.benchmarks.tiempoRecepcion;
                        return b && (
                          <div>
                            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">⏱️ Tiempo de Recepción</h4>
                            <div className="space-y-3">
                              {[
                                ['Rango Normal (P25-P75)', `${b.p25.toFixed(1)} – ${b.p75.toFixed(1)} h`],
                                ['Rango Ampliado (P10-P90)', `${b.p10.toFixed(1)} – ${b.p90.toFixed(1)} h`],
                                ['Mediana', `${b.mediana.toFixed(1)} h`],
                              ].map(([label, val]) => (
                                <div key={label} className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">{label}:</span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{val}</span>
                                </div>
                              ))}
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">CV:</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.cv.toFixed(1)}%</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    b.cv < 15 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : b.cv < 30 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  }`}>
                                    {b.cv < 15 ? 'Estabilidad Alta' : b.cv < 30 ? 'Estabilidad Media' : 'Estabilidad Baja'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {/* Estadía Camión */}
                      {(() => {
                        const b = useRobustBenchmarks && data.benchmarks_robust.tiempoCamion
                          ? data.benchmarks_robust.tiempoCamion
                          : data.benchmarks.tiempoCamion;
                        return b && (
                          <div>
                            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">🚛 Tiempo de Estadía Camión</h4>
                            <div className="space-y-3">
                              {[
                                ['Rango Normal (P25-P75)', `${b.p25.toFixed(1)} – ${b.p75.toFixed(1)} h`],
                                ['Rango Ampliado (P10-P90)', `${b.p10.toFixed(1)} – ${b.p90.toFixed(1)} h`],
                                ['Mediana', `${b.mediana.toFixed(1)} h`],
                              ].map(([label, val]) => (
                                <div key={label} className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">{label}:</span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{val}</span>
                                </div>
                              ))}
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">CV:</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.cv.toFixed(1)}%</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    b.cv < 15 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : b.cv < 30 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  }`}>
                                    {b.cv < 15 ? 'Estabilidad Alta' : b.cv < 30 ? 'Estabilidad Media' : 'Estabilidad Baja'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}

                {/* Tab Metodología */}
                {statsTab === 'metodologia' && (
                  <div className="max-w-2xl space-y-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Mediana</p>
                        <p className="text-xs">El valor del día del medio si ordenás todos los días de menor a mayor tiempo. No se ve afectada por un día muy atípico. <em>Ejemplo: si 19 días tardaron entre 1 y 3 horas y un día tardó 12 horas, la mediana sigue siendo ~2h. El promedio sería ~2.5h — menos representativo.</em></p>
                      </div>
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Rango Normal · banda amarilla (P25–P75)</p>
                        <p className="text-xs">El 50% central de los días cae dentro de esta banda. Es lo que se considera "normal" para la operación. <em>Ejemplo: P25 = 1.5h y P75 = 2.8h → en la mitad de los días el tiempo estuvo entre 1.5 y 2.8 horas.</em></p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Rango Ampliado · banda exterior (P10–P90)</p>
                        <p className="text-xs">El 80% de los días cae dentro de este rango. Los días que quedan fuera son verdaderamente excepcionales. Los gráficos anteriores muestran esta banda de fondo para que puedas ver qué días salieron del patrón habitual.</p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Outliers · puntos rojos en el gráfico</p>
                        <p className="text-xs">Días con tiempo muy fuera de lo habitual, detectados automáticamente. No necesariamente son errores — pueden ser feriados, fallas, proveedores problemáticos, o picos de volumen. Cada punto rojo merece una explicación operativa.</p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">CV — Coeficiente de Variación <span className="font-normal text-gray-500 dark:text-gray-400 text-xs">(qué tan "pareja" es la operación)</span></p>
                      <p className="text-xs mb-3">Mide cuánto varían los tiempos de un día para otro en relación al promedio. Un CV bajo significa que la operación es predecible y estable. Un CV alto indica que hay días muy distintos entre sí — lo que dificulta planificar personal y muelles.</p>
                      <div className="grid grid-cols-3 gap-2 text-xs text-center">
                        <div className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 rounded p-2">
                          <p className="font-bold text-base">{'< 15%'}</p>
                          <p className="font-semibold mt-0.5">Estabilidad Alta</p>
                          <p className="mt-1 text-green-700 dark:text-green-300">Operación predecible. Los tiempos son consistentes día a día.</p>
                        </div>
                        <div className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded p-2">
                          <p className="font-bold text-base">15–30%</p>
                          <p className="font-semibold mt-0.5">Estabilidad Media</p>
                          <p className="mt-1 text-yellow-700 dark:text-yellow-300">Variabilidad moderada. Hay algunos días que se alejan del promedio.</p>
                        </div>
                        <div className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 rounded p-2">
                          <p className="font-bold text-base">{'> 30%'}</p>
                          <p className="font-semibold mt-0.5">Estabilidad Baja</p>
                          <p className="mt-1 text-red-700 dark:text-red-300">Proceso inestable. Investigar qué factores generan los días atípicos.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs">
                      <p className="font-semibold text-blue-800 dark:text-blue-200 mb-1">¿Para qué sirve el modo Robusto?</p>
                      <p className="text-blue-700 dark:text-blue-300">Cuando hay días excepcionales (feriados, incidentes, cortes de luz), sus tiempos distorsionan los rangos y el CV. El modo <strong>Robusto</strong> los excluye automáticamente para que los indicadores reflejen la operación normal. Usá <strong>Con outliers</strong> solo cuando querés analizar específicamente esos días excepcionales y entender qué pasó.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Participación por Sector - Barras Verticales (Funcional) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8 relative">
            <div className="absolute top-2 right-2">
              <InfoTooltip content="Top 10 sectores del almacén con mayor volumen de ULs recepcionadas en el período. Permite identificar los sectores de mayor carga para balancear recursos y priorizar mejoras de proceso." />
            </div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              🏭 Participación por Sector – ULs
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={data.recepcionesPorSeccion.slice(0, 10)}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="sector"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis 
                  tick={{ fontSize: 11 }} 
                  tickFormatter={(value) => formatNumber(Number(value))}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm">
                        <p className="font-semibold text-gray-100 mb-1">Sector: {label}</p>
                        {payload.map((p: any, i: number) => (
                          <p key={i} className="text-gray-300">
                            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: p.fill }} />
                            {'ULs: '}<span className="font-medium text-white">{formatNumber(Number(p.value))}</span>
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="uls" 
                  fill="#3b82f6"
                  name="ULs"
                  radius={[2, 2, 0, 0]}
                  {...darkChartConfig.barCommonProps}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* ── THROUGHPUT DIARIO ── */}
          {(data.throughputDiario ?? []).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="ULs procesadas por hora de operación activa por día. Se calcula como: ULs totales del día ÷ (hora fin última operación − hora inicio primera operación). Días con pocas horas operativas pero mucho volumen = alta productividad puntual. Útil para detectar jornadas de baja eficiencia." />
              </div>
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                ⚡ Throughput Diario — ULs por Hora Operativa
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.throughputDiario} margin={{ top: 10, right: 30, left: 10, bottom: 40 }}>
                  <CartesianGrid {...darkChartConfig.gridCommonProps} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => formatNumber(v)} label={{ value: 'ULs/h', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11 } }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${v.toFixed(1)}h`} label={{ value: 'Hs operativas', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 11 } }} />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm">
                          <p className="font-semibold text-gray-100 mb-1">{label}</p>
                          {payload.map((p: any, i: number) => (
                            <p key={i} className="text-gray-300">
                              <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: p.color || p.fill }} />
                              {p.name}{': '}<span className="font-medium text-white">
                                {p.dataKey === 'uls_por_hora' ? `${formatNumber(p.value)} ULs/h`
                                  : p.dataKey === 'horas_operativas' ? `${Number(p.value).toFixed(1)}h`
                                  : formatNumber(p.value)}
                              </span>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar yAxisId="left" dataKey="uls_por_hora" name="ULs/hora" fill="#3b82f6" radius={[2,2,0,0]} {...darkChartConfig.barCommonProps} />
                  <Line yAxisId="right" type="monotone" dataKey="horas_operativas" name="Hs operativas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── FRANJA HORARIA DE LLEGADA DE CAMIONES ── */}
          {(data.franjaHoraria ?? []).some(r => r.camiones > 0) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Distribución de llegada de camiones por hora del día, acumulada en el período consultado. Permite identificar picos de ingreso para planificar la disponibilidad de muelles y operarios. Las barras verdes son horas con mayor actividad." />
              </div>
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                🚛 Franja Horaria de Llegada de Camiones
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.franjaHoraria} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid {...darkChartConfig.gridCommonProps} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => String(v)} />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm">
                          <p className="font-semibold text-gray-100 mb-1">{label}</p>
                          <p className="text-gray-300">Camiones: <span className="font-medium text-white">{payload[0]?.value ?? 0}</span></p>
                          {payload[1] && <p className="text-gray-300">ULs: <span className="font-medium text-white">{formatNumber(payload[1].value as number)}</span></p>}
                        </div>
                      );
                    }}
                  />
                  {(() => {
                    const maxCam = Math.max(...data.franjaHoraria.map(r => r.camiones));
                    return (
                      <Bar dataKey="camiones" name="Camiones" radius={[2,2,0,0]} {...darkChartConfig.barCommonProps}>
                        {data.franjaHoraria.map((entry, i) => (
                          <Cell key={i} fill={entry.camiones === maxCam ? '#10b981' : entry.camiones > maxCam * 0.6 ? '#3b82f6' : '#6b7280'} />
                        ))}
                      </Bar>
                    );
                  })()}
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                * Acumulado del período — camiones únicos por hora de entrada
              </p>
            </div>
          )}

          {/* ── RANKING DE PROVEEDORES ── */}
          {(data.rankingProveedores ?? []).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Top 15 proveedores por volumen de ULs recepcionadas. La columna 'T. Recep.' es el promedio de tiempo activo de recepción por UL (inicio → fin RF). 'Cajas/UL' es la densidad de carga: un valor alto implica más trabajo de desconsolidación por pallet." />
              </div>
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                🏆 Ranking de Proveedores — Volumen y Eficiencia
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Proveedor</th>
                      <th className="pb-2 pr-4 text-right">Recepciones</th>
                      <th className="pb-2 pr-4 text-right">ULs</th>
                      <th className="pb-2 pr-4 text-right">Cajas</th>
                      <th className="pb-2 pr-4 text-right">T. Recep.</th>
                      <th className="pb-2 text-right">Cajas/UL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const maxUls = Math.max(...(data.rankingProveedores ?? []).map(r => r.total_uls), 1);
                      return data.rankingProveedores.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-2 pr-4 text-gray-400 dark:text-gray-500 font-mono">{i + 1}</td>
                          <td className="py-2 pr-4 text-gray-900 dark:text-gray-100 font-medium max-w-[200px] truncate">{r.proveedor}</td>
                          <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">{formatNumber(r.recepciones)}</td>
                          <td className="py-2 pr-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.round((r.total_uls / maxUls) * 100)}%` }} />
                              </div>
                              <span className="text-gray-700 dark:text-gray-300 w-12 text-right">{formatNumber(r.total_uls)}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">{formatNumber(r.total_cajas)}</td>
                          <td className="py-2 pr-4 text-right">
                            {r.tiempo_recepcion_avg_h != null ? (
                              <span className={`font-medium ${r.tiempo_recepcion_avg_h > 2 ? 'text-red-500' : r.tiempo_recepcion_avg_h > 1 ? 'text-amber-500' : 'text-green-500'}`}>
                                {r.tiempo_recepcion_avg_h.toFixed(1)}h
                              </span>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-2 text-right text-gray-700 dark:text-gray-300">
                            {r.cajas_por_ul != null ? r.cajas_por_ul.toFixed(1) : '—'}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </main>
    </DarkChartThemeProvider>
  );
}
