"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from "recharts";

// CSS for animations and custom chart styles
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 200ms ease-out forwards;
  }
  
  /* Custom bar chart styles */
  .recharts-bar-rectangle {
    transition: all 0.2s ease-in-out !important;
  }
  
  .recharts-bar-rectangle:hover {
    filter: brightness(1.1) !important;
    stroke: rgba(0, 0, 0, 0.3) !important;
    stroke-width: 1px !important;
  }
  
  .recharts-bar-rectangle.recharts-active-bar {
    filter: brightness(1.15) !important;
    stroke: rgba(0, 0, 0, 0.5) !important;
    stroke-width: 2px !important;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.2) !important;
  }
`;

// Debounce function to prevent rapid API calls
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
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
  camionesPorDia: Array<{
    dia: string;
    camiones: number;
    duracion_promedio: number;
    ocupacion_promedio: number;
    total_destinos: number;
    total_uls: number;
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

// Tipos para datos de benchmark histórico
type BenchmarkData = {
  databaseName: string;
  datosMensuales: Array<{
    anio: number;
    mes: number;
    mesAnio: string;
    total_camiones: number;
    duracion_promedio: number;
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
  duracionActual: number;
  ocupacionActual: number;
  brechaDuracionVsPromedio: number;
  brechaDuracionVsMejor: number;
  brechaOcupacionVsPromedio: number;
  brechaOcupacionVsMejor: number;
  generatedAt: string;
};

export default function ExpedicionesPage() {
  const [data, setData] = useState<ExpedicionesData | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [matricula, setMatricula] = useState('');
  const matriculaRef = useRef(matricula);

  // Fetch data from API con filtros de fecha y matrícula (debounced)
  const fetchExpedicionesData = useCallback(
    async () => {
      console.log('fetchExpedicionesData called with:', { fechaInicio, fechaFin, matricula: matriculaRef.current });
      
      if (!fechaInicio || !fechaFin) {
        console.log('Fechas no definidas, no se realiza la consulta');
        return;
      }

      setLoading(true);
      
      try {
        const params = new URLSearchParams();
        params.append('fechaInicio', fechaInicio);
        params.append('fechaFin', fechaFin);
        
        // Agregar matrícula solo si tiene un valor
        if (matriculaRef.current.trim()) {
          params.append('matricula', matriculaRef.current.trim());
        }
        
        const url = `/expediciones?${params}`;
        console.log('Requesting URL:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error.message || 'Error desconocido');
        }
        
        setData(result);
      } catch (error) {
        console.error('Error fetching expediciones data:', error);
        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [fechaInicio, fechaFin, matricula]
  );

  // Fetch benchmark data
  const fetchBenchmarkData = useCallback(
    async () => {
      console.log('fetchBenchmarkData called with:', { fechaInicio, fechaFin, matricula: matriculaRef.current });
      
      if (!fechaInicio || !fechaFin) {
        console.log('Fechas no definidas, no se realiza la consulta de benchmark');
        return;
      }
      
      try {
        const params = new URLSearchParams();
        params.append('fechaInicio', fechaInicio);
        params.append('fechaFin', fechaFin);
        
        // Agregar matrícula solo si tiene un valor
        if (matriculaRef.current.trim()) {
          params.append('matricula', matriculaRef.current.trim());
        }
        
        const url = `/expediciones/benchmark?${params}`;
        console.log('Requesting benchmark URL:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error.message || 'Error desconocido');
        }
        
        setBenchmarkData(result);
      } catch (error) {
        console.error('Error fetching benchmark data:', error);
        setBenchmarkData(null);
      }
    },
    [fechaInicio, fechaFin, matricula]
  );

  // Debounced version to prevent rapid API calls
  const debouncedFetchExpedicionesData = useCallback(
    debounce(fetchExpedicionesData, 1000),
    [fetchExpedicionesData]
  );

  // No cargar datos automáticamente - el usuario debe seleccionar fechas explícitamente
  // useEffect(() => {
  //   const sixtyDaysAgo = new Date();
  //   sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  //   const today = new Date();
  //   
  //   setFechaInicio(sixtyDaysAgo.toISOString().split('T')[0]);
  //   setFechaFin(today.toISOString().split('T')[0]);
  // }, []);

  // Cargar datos de benchmark cuando cambian las fechas
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      fetchBenchmarkData();
    }
  }, [fetchBenchmarkData]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("es-AR").format(num);
  };

  // Calcular total para porcentajes del PieChart
  const totalULs = useMemo(() => {
    if (!data?.estadoULs) {
      console.log('estadoULs is null or undefined');
      return 0;
    }
    console.log('estadoULs data:', data.estadoULs);
    const total = data.estadoULs.reduce((sum: number, item: any) => sum + item.value, 0);
    console.log('Calculated totalULs:', total);
    return total;
  }, [data?.estadoULs]);

  const kpiCards = useMemo(() => {
    if (!data) return [];
    
    return [
      {
        title: "Total Camiones",
        value: formatNumber(data.totalCamiones),
        subtitle: "Camiones procesados",
        color: "blue" as const
      },
      {
        title: "Duración Promedio",
        value: `${data.duracionPromedio.toFixed(0)} min`,
        subtitle: "Tiempo de carga",
        color: data.duracionPromedio <= 120 ? "green" as const :
               data.duracionPromedio <= 180 ? "yellow" as const : "red" as const
      },
      {
        title: "Ocupación Promedio",
        value: `${data.ocupacionPromedio.toFixed(1)}%`,
        subtitle: "Espacio utilizado",
        color: data.ocupacionPromedio >= 80 && data.ocupacionPromedio <= 95 ? "green" as const :
               data.ocupacionPromedio >= 60 && data.ocupacionPromedio < 80 ? "yellow" as const : "red" as const
      },
      {
        title: "Total Destinos",
        value: formatNumber(data.totalDestinos),
        subtitle: "Destinos atendidos",
        color: "neutral" as const
      }
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
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <main className="p-6">
      {/* Header Narrativo */}
      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Expediciones / Cargas | Macromercado
            </h1>
            {data && (
              <div className="text-base text-gray-600 dark:text-gray-400 mt-1">
                {(() => {
                  try {
                    console.log('=== DATE DEBUG ===');
                    console.log('fechaInicio input:', fechaInicio);
                    console.log('fechaFin input:', fechaFin);
                    
                    let startDateStr = 'Rango seleccionado';
                    let endDateStr = '';
                    
                    // Usar directamente los valores de los inputs del frontend
                    if (fechaInicio && fechaInicio !== null && fechaInicio !== undefined) {
                      const date = new Date(fechaInicio);
                      if (!isNaN(date.getTime())) {
                        startDateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
                      }
                    }
                    
                    if (fechaFin && fechaFin !== null && fechaFin !== undefined) {
                      const date = new Date(fechaFin);
                      if (!isNaN(date.getTime())) {
                        endDateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
                      }
                    }
                    
                    // Si ambas fechas son iguales, mostrar formato más claro
                    if (startDateStr === endDateStr && startDateStr !== 'Rango seleccionado') {
                      const date = new Date(fechaInicio);
                      const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                      return (
                        <>
                          {monthName} · {formatNumber(data.totalCamiones)} camiones · 
                          <span className={`font-semibold ${
                            data.duracionPromedio <= 120 ? 'text-green-600 dark:text-green-400' :
                            data.duracionPromedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {data.duracionPromedio.toFixed(0)} min avg
                          </span> (Meta 120 min)
                        </>
                      );
                    }
                    
                    if (startDateStr !== 'Rango seleccionado' && endDateStr) {
                      return (
                        <>
                          {startDateStr} - {endDateStr} · {formatNumber(data.totalCamiones)} camiones · 
                          <span className={`font-semibold ${
                            data.duracionPromedio <= 120 ? 'text-green-600 dark:text-green-400' :
                            data.duracionPromedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {data.duracionPromedio.toFixed(0)} min avg
                          </span> (Meta 120 min)
                        </>
                      );
                    }
                    
                    if (startDateStr !== 'Rango seleccionado') {
                      return (
                        <>
                          {startDateStr} · {formatNumber(data.totalCamiones)} camiones · 
                          <span className={`font-semibold ${
                            data.duracionPromedio <= 120 ? 'text-green-600 dark:text-green-400' :
                            data.duracionPromedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {data.duracionPromedio.toFixed(0)} min avg
                          </span> (Meta 120 min)
                        </>
                      );
                    }
                    
                    return (
                      <>
                        {startDateStr} · {formatNumber(data.totalCamiones)} camiones · 
                        <span className={`font-semibold ${
                          data.duracionPromedio <= 120 ? 'text-green-600 dark:text-green-400' :
                          data.duracionPromedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {data.duracionPromedio.toFixed(0)} min avg
                        </span> (Meta 120 min)
                      </>
                    );
                  } catch (error) {
                    console.log('Date formatting error:', error);
                    return 'Rango seleccionado · ';
                  }
                })()}
              </div>
            )}
          </div>
          {data && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Actualizado: {new Date(data.generatedAt).toLocaleString('es-AR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          )}
        </div>
      </header>

      
      {/* Filtros Simplificados */}
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
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={debouncedFetchExpedicionesData}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Filtrando...' : 'Filtrar'}
            </button>
            <button
              onClick={() => {
                setFechaInicio('');
                setFechaFin('');
                setMatricula('');
                setData(null);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Limpiar
            </button>
            <button
              onClick={() => {
                // Simular datos保持原有逻辑
                const simulatedData = {
                  databaseName: "MACROMERCADO",
                  fechaInicio: fechaInicio || "2026-01-01",
                  fechaFin: fechaFin || "2026-02-26",
                  matricula: matricula || null,
                  totalCamiones: 1250,
                  duracionPromedio: 115.5,
                  ocupacionPromedio: 87.3,
                  totalDestinos: 3420,
                  camionesPorDia: [
                    { dia: "01/01", camiones: 45, duracion_promedio: 118.2, ocupacion_promedio: 85.6, total_destinos: 120, total_uls: 890 },
                    { dia: "02/01", camiones: 52, duracion_promedio: 112.8, ocupacion_promedio: 88.1, total_destinos: 145, total_uls: 980 },
                    { dia: "03/01", camiones: 38, duracion_promedio: 125.5, ocupacion_promedio: 82.3, total_destinos: 98, total_uls: 720 },
                    { dia: "04/01", camiones: 41, duracion_promedio: 108.9, ocupacion_promedio: 90.2, total_destinos: 112, total_uls: 810 },
                    { dia: "05/01", camiones: 48, duracion_promedio: 119.7, ocupacion_promedio: 86.8, total_destinos: 135, total_uls: 950 }
                  ],
                  estadoULs: [
                    { name: "Normales", value: 3420, color: "#10b981" },
                    { name: "Sin Fin Prep", value: 180, color: "#f59e0b" },
                    { name: "Sin Volumen", value: 95, color: "#fb923c" },
                    { name: "Overfill", value: 45, color: "#ef4444" }
                  ],
                  topMatriculas: [
                    { name: "ABC123", uls_total: 1250, duracion_promedio: 105.2, viajes: 15 },
                    { name: "DEF456", uls_total: 1180, duracion_promedio: 112.8, viajes: 14 },
                    { name: "GHI789", uls_total: 980, duracion_promedio: 98.5, viajes: 12 },
                    { name: "JKL012", uls_total: 890, duracion_promedio: 125.3, viajes: 11 },
                    { name: "MNO345", uls_total: 750, duracion_promedio: 108.7, viajes: 9 }
                  ],
                  matriculasMasUsadas: [
                    { name: "ABC123", viajes: 25, uls_total: 1250, duracion_promedio: 105.2, ocupacion_promedio: 88.5, total_destinos: 180 },
                    { name: "DEF456", viajes: 22, uls_total: 1180, duracion_promedio: 112.8, ocupacion_promedio: 91.2, total_destinos: 165 },
                    { name: "GHI789", viajes: 18, uls_total: 980, duracion_promedio: 98.5, ocupacion_promedio: 85.3, total_destinos: 142 },
                    { name: "JKL012", viajes: 15, uls_total: 890, duracion_promedio: 125.3, ocupacion_promedio: 82.7, total_destinos: 118 },
                    { name: "MNO345", viajes: 12, uls_total: 750, duracion_promedio: 108.7, ocupacion_promedio: 89.1, total_destinos: 95 }
                  ],
                  generatedAt: new Date().toISOString()
                };
                setData(simulatedData);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Simular datos
            </button>
          </div>
        </div>
      </div>
      
      {/* Empty State */}
      {data && data.totalCamiones === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 mb-8 text-center">
          <div className="text-6xl mb-4">🚚</div>
          <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            No hay datos en este rango
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 mb-6">
            No se encontraron registros de expediciones para el período seleccionado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700 dark:text-yellow-300">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">💡 Sugerencias:</h4>
              <ul className="space-y-1 text-left">
                <li>• Prueba fechas de 2024 o 2025</li>
                <li>• Usa rangos más amplios (60+ días)</li>
                <li>• Verifica fechas de fin de mes</li>
                <li>• Prueba períodos de alta actividad</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">📅 Rangos recomendados:</h4>
              <div className="space-y-2 text-left">
                <button 
                  onClick={() => {
                    const lastYear = new Date();
                    lastYear.setFullYear(lastYear.getFullYear() - 1);
                    const start = new Date(lastYear.getFullYear(), 0, 1);
                    const end = new Date(lastYear.getFullYear(), 11, 31);
                    setFechaInicio(start.toISOString().split('T')[0]);
                    setFechaFin(end.toISOString().split('T')[0]);
                  }}
                  className="w-full text-left px-3 py-2 bg-yellow-100 dark:bg-yellow-800 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
                >
                  📅 Todo el año pasado
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
      
      {/* KPI Cards */}
      {!data && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Selecciona un rango de fechas
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Para ver los datos de expediciones, selecciona las fechas de inicio y fin, luego haz clic en "Filtrar".
            </p>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              También puedes usar "Simular datos" para ver una vista previa del dashboard.
            </div>
          </div>
        )}

        {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpiCards.map((kpi, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-7 border border-gray-200 dark:border-gray-700 animate-fade-in relative group">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                  <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center cursor-help">
                    <span className="text-white text-xs">?</span>
                  </div>
                  <div className="absolute right-0 top-5 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    {kpi.title === "Total Camiones" && "Total de camiones procesados en el período seleccionado. COUNT(*) de la tabla fact_carga_camion_dia."}
                    {kpi.title === "Duración Promedio" && "Promedio de tiempo de carga por camión en minutos. AVG(duracion_carga_min). Meta: ≤120 min."}
                    {kpi.title === "Ocupación Promedio" && "Promedio de ocupación de contenedores en porcentaje. AVG(ocupacion_contenedores). Meta: 80-95%."}
                    {kpi.title === "Total Destinos" && "Suma total de destinos atendidos por todos los camiones. SUM(cantidad_destinos)."}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{kpi.title}</p>
                <p className={`text-3xl font-semibold mb-1 ${
                  kpi.color === 'green' ? 'text-green-600 dark:text-green-400' :
                  kpi.color === 'red' ? 'text-red-700 dark:text-red-400' :
                  kpi.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                  kpi.color === 'neutral' ? 'text-gray-900 dark:text-gray-100' :
                  'text-blue-600 dark:text-blue-400'
                }`}>
                  {kpi.value}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Benchmark Histórico */}
      {benchmarkData && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8 animate-fade-in relative group">
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="relative">
              <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center cursor-help">
                <span className="text-white text-xs">?</span>
              </div>
              <div className="absolute right-0 top-5 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                Contexto histórico de los últimos 10 meses. Compara el período actual vs promedio histórico y mejor mes registrado. Calcula AVG() y MIN()/MAX() de duración y ocupación mensuales.
              </div>
            </div>
          </div>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Contexto Histórico (10 meses)
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Duración de Carga</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Actual</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {benchmarkData.duracionActual.toFixed(0)} min
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Promedio</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {benchmarkData.promedioDuracionHistorico.toFixed(0)} min
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Mejor</p>
                  <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                    {benchmarkData.mejorDuracion.toFixed(0)} min
                  </p>
                </div>
              </div>
              <div className="text-center">
                <p className={`text-sm font-medium ${
                  benchmarkData.brechaDuracionVsPromedio <= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {benchmarkData.brechaDuracionVsPromedio <= 0 ? '' : '+'}{benchmarkData.brechaDuracionVsPromedio.toFixed(0)} min vs promedio
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Ocupación Contenedores</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Actual</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {benchmarkData.ocupacionActual.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Promedio</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {benchmarkData.promedioOcupacionHistorico.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Mejor</p>
                  <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                    {benchmarkData.mejorOcupacion.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="text-center">
                <p className={`text-sm font-medium ${
                  benchmarkData.brechaOcupacionVsPromedio >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {benchmarkData.brechaOcupacionVsPromedio >= 0 ? '+' : ''}{benchmarkData.brechaOcupacionVsPromedio.toFixed(1)} pp vs promedio
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {data && data.totalCamiones > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Line Chart - Duración y Ocupación por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative group">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                  <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center cursor-help">
                    <span className="text-white text-xs">?</span>
                  </div>
                  <div className="absolute right-0 top-5 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    Evolución diaria de duración promedio de carga (minutos) y ocupación de contenedores (%). Agrupado por fecha con AVG() de cada métrica.
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Duración y Ocupación por Día
                </h2>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-blue-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Duración (min)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-green-600"></div>
                    <span className="text-gray-600 dark:text-gray-400">Ocupación (%)</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.camionesPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Duración:</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400">{data.duracion_promedio?.toFixed(0) || 0} min</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Ocupación:</span>
                                <span className="font-medium text-green-600 dark:text-green-400">{data.ocupacion_promedio?.toFixed(1) || 0}%</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Camiones:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{data.camiones}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="linear" 
                    dataKey="duracion_promedio" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    name="Duración"
                  />
                  <Line 
                    type="linear" 
                    dataKey="ocupacion_promedio" 
                    stroke="#16a34a" 
                    strokeWidth={2}
                    dot={false}
                    name="Ocupación"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Estado de ULs - Pie Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative group">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                  <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center cursor-help">
                    <span className="text-white text-xs">?</span>
                  </div>
                  <div className="absolute right-0 top-5 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    Distribución de ULs por estado: Normales (sin problemas), Sin Fin Prep, Sin Volumen, Overfill (exceso de carga). Calculado con SUM() de cada campo y CASE para clasificación.
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Distribución de ULs por Estado (Debug)
                </h2>
                <div className="text-xs text-gray-500 mb-2">
                  Total ULs: {totalULs} | Datos: {JSON.stringify(data?.estadoULs)}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Normales", value: 3420, color: "#10b981" },
                      { name: "Sin Fin Prep", value: 180, color: "#f59e0b" },
                      { name: "Sin Volumen", value: 95, color: "#fb923c" },
                      { name: "Overfill", value: 45, color: "#ef4444" }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => {
                      console.log('PieChart label - name:', name, 'percent:', percent);
                      const safePercent = Math.abs(percent || 0);
                      return `${name}: ${(safePercent * 100).toFixed(1)}%`;
                    }}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {[
                      { name: "Normales", value: 3420, color: "#10b981" },
                      { name: "Sin Fin Prep", value: 180, color: "#f59e0b" },
                      { name: "Sin Volumen", value: 95, color: "#fb923c" },
                      { name: "Overfill", value: 45, color: "#ef4444" }
                    ].map((entry: any, index: number) => {
                      console.log('PieChart Cell - index:', index, 'entry:', entry);
                      return (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      );
                    })}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        const total = 3740; // Hardcoded para debug
                        const percentage = ((item.value / total) * 100).toFixed(1);
                        console.log('Tooltip - item:', item, 'percentage:', percentage);
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: item.color }}
                              ></div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Cantidad:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(item.value)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Porcentaje:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{percentage}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Top Matrículas - Bar Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative group">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                  <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center cursor-help">
                    <span className="text-white text-xs">?</span>
                  </div>
                  <div className="absolute right-0 top-5 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    Top 10 matrículas con mayor volumen de ULs transportadas. Ordenado por SUM(uls) DESC. Incluye AVG() de duración y COUNT() de viajes.
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Top 10 Matrículas por ULs
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topMatriculas} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(value) => formatNumber(Number(value))} />
                  <Tooltip 
                    formatter={(value: any) => [formatNumber(Number(value)), 'ULs']}
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151', 
                      borderRadius: '6px' 
                    }}
                    labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f3f4f6' }}
                    cursor={false}
                  />
                  <Bar dataKey="uls_total" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Matrículas Más Usadas - Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative group">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                  <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center cursor-help">
                    <span className="text-white text-xs">?</span>
                  </div>
                  <div className="absolute right-0 top-5 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    Top 5 matrículas más utilizadas en el período filtrado. Ordenado por COUNT(*) DESC. Incluye SUM() de ULs, AVG() de duración y ocupación.
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Matrículas Más Usadas
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 text-gray-700 dark:text-gray-300">Matrícula</th>
                      <th className="text-center py-2 px-2 text-gray-700 dark:text-gray-300">Viajes</th>
                      <th className="text-center py-2 px-2 text-gray-700 dark:text-gray-300">ULs Total</th>
                      <th className="text-center py-2 px-2 text-gray-700 dark:text-gray-300">Duración Avg</th>
                      <th className="text-center py-2 px-2 text-gray-700 dark:text-gray-300">Ocupación Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.matriculasMasUsadas.map((matricula: any, index: number) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-2 font-medium text-gray-900 dark:text-gray-100">{matricula.name}</td>
                        <td className="py-2 px-2 text-center text-gray-900 dark:text-gray-100">{matricula.viajes}</td>
                        <td className="py-2 px-2 text-center text-gray-900 dark:text-gray-100">{formatNumber(matricula.uls_total)}</td>
                        <td className={`py-2 px-2 text-center font-medium ${
                          matricula.duracion_promedio <= 120 ? 'text-green-600 dark:text-green-400' :
                          matricula.duracion_promedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {matricula.duracion_promedio.toFixed(0)} min
                        </td>
                        <td className={`py-2 px-2 text-center font-medium ${
                          matricula.ocupacion_promedio >= 80 && matricula.ocupacion_promedio <= 95 ? 'text-green-600 dark:text-green-400' :
                          matricula.ocupacion_promedio >= 60 && matricula.ocupacion_promedio < 80 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {matricula.ocupacion_promedio.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
      </main>
    </>
  );
}
