"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Area, BarChart } from "recharts";
import { DarkChartThemeProvider, darkChartConfig } from '@/components/dashboard/DarkChartTheme';

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
  const [useRobustBenchmarks, setUseRobustBenchmarks] = useState(true); // Por defecto usar robustos

  // Fetch data from API con filtros de fecha, proveedor y SKU
  const fetchRecepcionesData = useCallback(
    async () => {
      console.log('fetchRecepcionesData called with:', { fechaInicio, fechaFin, proveedor, sku });
      
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
        console.log('Requesting URL:', url);
        
        const response = await fetch(url);
        
if (!response.ok) {
  throw new Error(`Error del backend: ${response.status}`);
}

const result = await response.json();
setData(result.data);
      } catch (error) {
        console.error('Error fetching recepciones data:', error);
        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [fechaInicio, fechaFin, proveedor, sku]
  );

  // Cargar datos iniciales (últimos 30 días por defecto)
  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();
    
    setFechaInicio(thirtyDaysAgo.toISOString().split('T')[0]);
    setFechaFin(today.toISOString().split('T')[0]);
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("es-AR").format(num);
  };

  // KPI Cards - Reorganizados en 3 bloques lógicos
  const kpiCards = useMemo(() => {
    if (!data) return { volumen: [], actividad: [], eficiencia: [] };
    
    return {
      // 🔵 Bloque 1 - Volumen
      volumen: [
        {
          title: "Total ULs",
          value: formatNumber(data.kpis.totalUls),
          icon: "🏗️",
          color: "blue" as const
        },
        {
          title: "Total Cajas",
          value: formatNumber(data.kpis.totalCajas),
          icon: "📦",
          color: "green" as const
        }
      ],
      // 🟡 Bloque 2 - Actividad
      actividad: [
        {
          title: "Días con Recepción",
          value: formatNumber(data.kpis.totalDias),
          icon: "📅",
          color: "orange" as const
        },
        {
          title: "Sectores Activos",
          value: formatNumber(data.kpis.totalSecciones),
          icon: "🏭",
          color: "yellow" as const
        }
      ],
      // 🟣 Bloque 3 - Eficiencia
      eficiencia: [
        {
          title: "Tiempo Promedio Recepción (h)",
          value: `${data.kpis.tiempoPromedioRecepcion.toFixed(1)}h`,
          subtitle: "Promedio diario",
          icon: "⏱️",
          color: "purple" as const
        },
        {
          title: "Tiempo Recepción Período (h)",
          value: `${data.kpis_periodo.recepcion_avg_h_ponderado.toFixed(1)}h`,
          subtitle: `Basado en ${formatNumber(data.kpis_periodo.recepcion_eventos)} eventos`,
          icon: "⚡",
          color: "violet" as const
        },
        {
          title: "Tiempo Promedio Estadía Camión (h)",
          value: (() => {
            const benchmarks = useRobustBenchmarks ? data.benchmarks_robust : data.benchmarks;
            return benchmarks.tiempoCamion ? `${benchmarks.tiempoCamion.promedio.toFixed(1)}h` : "N/A";
          })(),
          subtitle: useRobustBenchmarks ? "Benchmark robusto" : "Con outliers",
          icon: "🚛",
          color: "indigo" as const
        },
        {
          title: "Estadía Camión Período (h)",
          value: `${data.kpis_periodo.camion_avg_h_ponderado.toFixed(1)}h`,
          subtitle: `Basado en ${formatNumber(data.kpis_periodo.camion_eventos)} eventos`,
          icon: "⏰",
          color: "blue" as const
        }
      ]
    };
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
          Recepciones - Macromercado
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Panel de control de recepciones de mercancía
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
                setFechaInicio('');
                setFechaFin('');
                setProveedor('');
                setSku('');
                setData(null);
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
      
      {/* KPI Cards - 3 Bloques Lógicos */}
      {data && data.kpis.totalDias > 0 && (
        <div className="space-y-8 mb-8">
          {/* 🔵 Bloque 1 - Volumen */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              Volumen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {kpiCards.volumen.map((kpi: any, index: number) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{kpi.title}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
                      {kpi.subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{kpi.subtitle}</p>
                      )}
                    </div>
                    <div className="text-2xl">{kpi.icon}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 🟡 Bloque 2 - Actividad */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
              Actividad
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {kpiCards.actividad.map((kpi: any, index: number) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{kpi.title}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
                      {kpi.subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{kpi.subtitle}</p>
                      )}
                    </div>
                    <div className="text-2xl">{kpi.icon}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 🟣 Bloque 3 - Eficiencia */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
              Eficiencia
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {kpiCards.eficiencia.map((kpi: any, index: number) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{kpi.title}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
                      {kpi.subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{kpi.subtitle}</p>
                      )}
                    </div>
                    <div className="text-2xl">{kpi.icon}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts - Reportes */}
      {data && data.kpis.totalDias > 0 && (
        <>
          {/* Gráfico Combinado de Volumen */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                ⏱️ Tiempo Medio de Recepción (Horas)
              </h2>
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

            {/* 4. Tiempo Medio de Estada de Camión por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                🚛 Tiempo Medio de Estada de Camión (Horas)
              </h2>
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  📈 Análisis Estadístico del Período
                </h3>
                {data.benchmarks_robust.tiempoCamion && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Benchmark:</span>
                    <button
                      onClick={() => setUseRobustBenchmarks(!useRobustBenchmarks)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useRobustBenchmarks ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          useRobustBenchmarks ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {useRobustBenchmarks ? 'Robusto' : 'Con outliers'}
                    </span>
                  </div>
                )}
              </div>
              
              {useRobustBenchmarks && data.benchmarks_robust.tiempoCamion && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    📊 <strong>Modo robusto activado:</strong> {data.benchmarks_robust.metodo} | 
                    Outliers camión: {data.benchmarks_robust.outliers_camion.high_count} altos, {data.benchmarks_robust.outliers_camion.low_count} bajos
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tiempo de Recepción */}
                {(() => {
                  const recepcionBenchmarks = useRobustBenchmarks && data.benchmarks_robust.tiempoRecepcion 
                    ? data.benchmarks_robust.tiempoRecepcion 
                    : data.benchmarks.tiempoRecepcion;
                  
                  return recepcionBenchmarks && (
                    <div>
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
                        ⏱️ Tiempo de Recepción
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Rango Normal (P25-P75):</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {recepcionBenchmarks.p25.toFixed(1)} - {recepcionBenchmarks.p75.toFixed(1)} h
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Rango Ampliado (P10-P90):</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {recepcionBenchmarks.p10.toFixed(1)} - {recepcionBenchmarks.p90.toFixed(1)} h
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Mediana:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {recepcionBenchmarks.mediana.toFixed(1)} h
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">CV:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {recepcionBenchmarks.cv.toFixed(1)}%
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              recepcionBenchmarks.cv < 15 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : recepcionBenchmarks.cv < 30
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {recepcionBenchmarks.cv < 15 ? 'Estabilidad Alta' : 
                               recepcionBenchmarks.cv < 30 ? 'Estabilidad Media' : 'Estabilidad Baja'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Tiempo de Estadía Camión */}
                {(() => {
                  const camionBenchmarks = useRobustBenchmarks && data.benchmarks_robust.tiempoCamion 
                    ? data.benchmarks_robust.tiempoCamion 
                    : data.benchmarks.tiempoCamion;
                  
                  return camionBenchmarks && (
                    <div>
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
                        🚛 Tiempo de Estadía Camión
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Rango Normal (P25-P75):</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {camionBenchmarks.p25.toFixed(1)} - {camionBenchmarks.p75.toFixed(1)} h
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Rango Ampliado (P10-P90):</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {camionBenchmarks.p10.toFixed(1)} - {camionBenchmarks.p90.toFixed(1)} h
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Mediana:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {camionBenchmarks.mediana.toFixed(1)} h
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">CV:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {camionBenchmarks.cv.toFixed(1)}%
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              camionBenchmarks.cv < 15 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : camionBenchmarks.cv < 30
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {camionBenchmarks.cv < 15 ? 'Estabilidad Alta' : 
                               camionBenchmarks.cv < 30 ? 'Estabilidad Media' : 'Estabilidad Baja'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Participación por Sector - Barras Verticales (Funcional) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
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
                  formatter={(value: any, name: any) => {
                    if (name === 'uls') {
                      return [formatNumber(Number(value)), 'ULs'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label: any) => `Sector: ${label}`}
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151', 
                    borderRadius: '6px' 
                  }}
                  labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                  itemStyle={{ color: '#f3f4f6' }}
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
        </>
      )}
    </main>
    </DarkChartThemeProvider>
  );
}
