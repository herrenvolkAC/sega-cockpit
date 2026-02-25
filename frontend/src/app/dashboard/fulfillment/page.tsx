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

// Tipos para los datos de fulfillment
type FulfillmentData = {
  databaseName: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  totalPedidos: number;
  totalSolicitado: number;
  totalFaltantes: number;
  tasaSatisfaccion: number;
  pedidosPorDia: Array<{
    dia: string;
    pedidos: number;
    qty_solicitada: number;
    faltantes: number;
    entregados: number; // qty_solicitada - faltantes
    fulfillment_pct: number; // ((qty_solicitada - faltantes) / qty_solicitada) * 100
  }>;
  estadoFulfillment: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  productosConShortage: Array<{
    sku: string;
    name: string;
    qty_solicitada: number;
    shortage: number;
    entregados: number;
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
    solicitado: number;
    entregado: number;
    nivelServicio: number;
  }>;
  promedioHistorico: number;
  mejorMes: number;
  peorMes: number;
  nivelActual: number;
  brechaVsPromedio: number;
  brechaVsMejor: number;
  generatedAt: string;
};

export default function FulfillmentPage() {
  const [data, setData] = useState<FulfillmentData | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [sku, setSku] = useState(''); // Nuevo campo para SKU
  const skuRef = useRef(sku); // Ref para mantener el valor estable

  // Fetch data from API con filtros de fecha y SKU (debounced)
  const fetchFulfillmentData = useCallback(
    async () => {
      console.log('fetchFulfillmentData called with:', { fechaInicio, fechaFin, sku: skuRef.current });
      
      if (!fechaInicio || !fechaFin) {
        console.log('Fechas no definidas, no se realiza la consulta');
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
        
        // Agregar SKU solo si tiene un valor
        if (skuRef.current.trim()) {
          params.append('sku', skuRef.current.trim());
        }
        
        const url = `/fulfillment?${params}`;
        console.log('Requesting URL:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error.message || 'Error desconocido');
        }
        
        // Calcular campo entregados y fulfillment_pct para cada día
        if (result.pedidosPorDia) {
          result.pedidosPorDia = result.pedidosPorDia.map((dia: any) => ({
            ...dia,
            entregados: dia.qty_solicitada - dia.faltantes,
            fulfillment_pct: dia.qty_solicitada > 0 ? ((dia.qty_solicitada - dia.faltantes) / dia.qty_solicitada) * 100 : 0
          }));
        }
        
        // Truncar nombres largos de productos para mejor visualización
        if (result.productosConShortage) {
          result.productosConShortage = result.productosConShortage.map((producto: any) => ({
            ...producto,
            name: producto.name.length > 40 ? producto.name.substring(0, 37) + '...' : producto.name
          }));
        }
        
        setData(result);
      } catch (error) {
        console.error('Error fetching fulfillment data:', error);
        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [fechaInicio, fechaFin, sku] // Agregar sku a las dependencias
  );

  // Fetch benchmark data
  const fetchBenchmarkData = useCallback(
    async () => {
      console.log('fetchBenchmarkData called with:', { fechaInicio, fechaFin, sku: skuRef.current });
      
      if (!fechaInicio || !fechaFin) {
        console.log('Fechas no definidas, no se realiza la consulta de benchmark');
        return;
      }
      
      try {
        const params = new URLSearchParams();
        params.append('fechaInicio', fechaInicio);
        params.append('fechaFin', fechaFin);
        
        // Agregar SKU solo si tiene un valor
        if (skuRef.current.trim()) {
          params.append('sku', skuRef.current.trim());
        }
        
        const url = `/fulfillment/benchmark?${params}`;
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
    [fechaInicio, fechaFin, sku]
  );

  // Debounced version to prevent rapid API calls
  const debouncedFetchFulfillmentData = useCallback(
    debounce(fetchFulfillmentData, 1000), // 1 second delay
    [fetchFulfillmentData]
  );

  // Cargar datos iniciales (últimos 90 días por defecto)
  useEffect(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const today = new Date();
    
    setFechaInicio(ninetyDaysAgo.toISOString().split('T')[0]);
    setFechaFin(today.toISOString().split('T')[0]);
  }, []);

  // Cargar datos de benchmark cuando cambian las fechas
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      fetchBenchmarkData();
    }
  }, [fetchBenchmarkData]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("es-AR").format(num);
  };

  // Calcular límites dinámicos para el eje Y
  const calculateYAxisDomain = useCallback(() => {
    if (!benchmarkData || !benchmarkData.datosMensuales.length) return [0, 100];
    
    const fillRates = benchmarkData.datosMensuales.map(d => d.nivelServicio);
    const minRate = Math.min(...fillRates);
    const maxRate = Math.max(...fillRates);
    
    const minY = Math.max(0, minRate - 3); // Nunca menor a 0%
    const maxY = Math.min(100, maxRate + 3); // Nunca mayor a 100%
    
    return [minY, maxY];
  }, [benchmarkData]);
  const kpiCards = useMemo(() => {
    if (!data) return [];
    
    return [
      {
        title: "Total Pedidos",
        value: formatNumber(data.totalPedidos),
        subtitle: "Pedidos procesados",
        color: "blue" as const
      },
      {
        title: "Total Solicitado",
        value: formatNumber(data.totalSolicitado),
        subtitle: "Unidades solicitadas",
        color: "neutral" as const
      },
      {
        title: "Total Faltantes",
        value: formatNumber(data.totalFaltantes),
        subtitle: "Unidades no entregadas",
        color: "red" as const
      },
      {
        title: "Tasa Satisfacción",
        value: `${data.tasaSatisfaccion.toFixed(1)}%`,
        subtitle: "Fill Rate (Unidades)",
        color: data.tasaSatisfaccion >= 95 ? "green" as const :
               data.tasaSatisfaccion >= 90 ? "yellow" as const : "red" as const
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
              Fulfillment | Macromercado
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
                          {monthName} · {formatNumber(data.totalPedidos)} pedidos · 
                          <span className={`font-semibold ${
                            data.tasaSatisfaccion >= 95 ? 'text-green-600 dark:text-green-400' :
                            data.tasaSatisfaccion >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {data.tasaSatisfaccion.toFixed(1)}% Nivel de Servicio
                          </span> (Meta 95%)
                        </>
                      );
                    }
                    
                    if (startDateStr !== 'Rango seleccionado' && endDateStr) {
                      return (
                        <>
                          {startDateStr} - {endDateStr} · {formatNumber(data.totalPedidos)} pedidos · 
                          <span className={`font-semibold ${
                            data.tasaSatisfaccion >= 95 ? 'text-green-600 dark:text-green-400' :
                            data.tasaSatisfaccion >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {data.tasaSatisfaccion.toFixed(1)}% Nivel de Servicio
                          </span> (Meta 95%)
                        </>
                      );
                    }
                    
                    if (startDateStr !== 'Rango seleccionado') {
                      return (
                        <>
                          {startDateStr} · {formatNumber(data.totalPedidos)} pedidos · 
                          <span className={`font-semibold ${
                            data.tasaSatisfaccion >= 95 ? 'text-green-600 dark:text-green-400' :
                            data.tasaSatisfaccion >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {data.tasaSatisfaccion.toFixed(1)}% Nivel de Servicio
                          </span> (Meta 95%)
                        </>
                      );
                    }
                    
                    return (
                      <>
                        {startDateStr} · {formatNumber(data.totalPedidos)} pedidos · 
                        <span className={`font-semibold ${
                          data.tasaSatisfaccion >= 95 ? 'text-green-600 dark:text-green-400' :
                          data.tasaSatisfaccion >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {data.tasaSatisfaccion.toFixed(1)}% Nivel de Servicio
                        </span> (Meta 95%)
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
              SKU (Opcional)
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Filtrar por SKU..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={debouncedFetchFulfillmentData}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Filtrando...' : 'Filtrar'}
            </button>
            <button
              onClick={() => {
                setFechaInicio('');
                setFechaFin('');
                setSku('');
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
                  fechaInicio: fechaInicio || "2025-01-01",
                  fechaFin: fechaFin || "2025-01-31",
                  totalPedidos: 4118,
                  totalSolicitado: 125000,
                  totalFaltantes: 8500,
                  tasaSatisfaccion: 93.2,
                  pedidosPorDia: [
                    { dia: "01/01", pedidos: 145, qty_solicitada: 4200, faltantes: 280, entregados: 3920, fulfillment_pct: 93.3 },
                    { dia: "02/01", pedidos: 132, qty_solicitada: 3800, faltantes: 320, entregados: 3480, fulfillment_pct: 91.6 },
                    { dia: "03/01", pedidos: 156, qty_solicitada: 4500, faltantes: 180, entregados: 4320, fulfillment_pct: 96.0 },
                    { dia: "04/01", pedidos: 128, qty_solicitada: 3700, faltantes: 410, entregados: 3290, fulfillment_pct: 88.9 },
                    { dia: "05/01", pedidos: 167, qty_solicitada: 4800, faltantes: 290, entregados: 4510, fulfillment_pct: 94.0 }
                  ],
                  estadoFulfillment: [
                    { name: "Entregado", value: 93.2, color: "#10b981" },
                    { name: "Faltante", value: 6.8, color: "#ef4444" }
                  ],
                  productosConShortage: [
                    { sku: "SKU12345", name: "Producto A - SKU12345", qty_solicitada: 1000, shortage: 450, entregados: 550 },
                    { sku: "SKU67890", name: "Producto B - SKU67890", qty_solicitada: 800, shortage: 380, entregados: 420 },
                    { sku: "SKU11111", name: "Producto C - SKU11111", qty_solicitada: 900, shortage: 320, entregados: 580 },
                    { sku: "SKU22222", name: "Producto D - SKU22222", qty_solicitada: 750, shortage: 290, entregados: 460 },
                    { sku: "SKU33333", name: "Producto E - SKU33333", qty_solicitada: 650, shortage: 260, entregados: 390 }
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
      {data && data.totalPedidos === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 mb-8 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            No hay datos en este rango
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 mb-6">
            No se encontraron registros de fulfillment para el período seleccionado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700 dark:text-yellow-300">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">💡 Sugerencias:</h4>
              <ul className="space-y-1 text-left">
                <li>• Prueba fechas de 2024 o 2025</li>
                <li>• Usa rangos más amplios (90+ días)</li>
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
      {data && data.totalPedidos > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpiCards.map((kpi: any, index: number) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-7 border border-gray-200 dark:border-gray-700 animate-fade-in">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8 animate-fade-in">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Contexto Histórico (10 meses)
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Nivel actual</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {benchmarkData.nivelActual.toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Promedio histórico</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {benchmarkData.promedioHistorico.toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Mejor mes</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {benchmarkData.mejorMes.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="text-center">
              <p className={`text-lg font-medium ${
                benchmarkData.brechaVsPromedio >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {benchmarkData.brechaVsPromedio >= 0 ? '+' : ''}{benchmarkData.brechaVsPromedio.toFixed(1)} pp vs promedio
              </p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-medium ${
                benchmarkData.brechaVsMejor >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {benchmarkData.brechaVsMejor >= 0 ? '+' : ''}{benchmarkData.brechaVsMejor.toFixed(1)} pp vs mejor mes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {data && data.totalPedidos > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Line Chart - Pedidos y Faltantes */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Pedidos y Faltantes por Día
                </h2>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-blue-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Solicitado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-green-600"></div>
                    <span className="text-gray-600 dark:text-gray-400">Entregado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-red-700"></div>
                    <span className="text-gray-600 dark:text-gray-400">Faltantes</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.pedidosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(Number(value))} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Solicitado:</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400">{formatNumber(data.qty_solicitada)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Entregado:</span>
                                <span className="font-medium text-green-600 dark:text-green-400">{formatNumber(data.entregados)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Faltantes:</span>
                                <span className="font-medium text-red-700 dark:text-red-400">{formatNumber(data.faltantes)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">% del día:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{data.fulfillment_pct.toFixed(1)}%</span>
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
                    dataKey="qty_solicitada" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    name="Solicitado"
                  />
                  <Line 
                    type="linear" 
                    dataKey="entregados" 
                    stroke="#16a34a" 
                    strokeWidth={2}
                    dot={false}
                    name="Entregado"
                  />
                  <Line 
                    type="linear" 
                    dataKey="faltantes" 
                    stroke="#b91c1c" 
                    strokeWidth={2}
                    dot={false}
                    name="Faltantes"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Estado de Fulfillment - Line Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  % Fulfillment por Día
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="w-3 h-0.5 bg-gray-400"></div>
                  <span>Meta 95%</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={275}>
                <LineChart data={data.pedidosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis 
                    domain={[60, 100]} 
                    tick={{ fontSize: 11 }} 
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const isBelowTarget = data.fulfillment_pct < 95;
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Fulfillment:</span>
                                <span className={`font-medium ${isBelowTarget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                  {data.fulfillment_pct.toFixed(1)}%
                                </span>
                              </div>
                              {isBelowTarget && (
                                <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                                  Debajo de meta
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Banda visual de zona saludable 95-100% */}
                  <ReferenceArea y1={95} y2={100} fill="#16a34a" fillOpacity={0.05} />
                  {/* Línea de meta 95% */}
                  <Line 
                    type="monotone" 
                    dataKey={() => 95} 
                    stroke="#9ca3af" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Meta 95%"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="fulfillment_pct" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="% Fulfillment"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart - Top 10 Productos */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Top 10 Productos con más Faltantes
              </h2>
              {data.productosConShortage.length > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Los 3 principales SKUs concentran el {((data.productosConShortage.slice(0, 3).reduce((sum, p) => sum + p.shortage, 0) / data.totalFaltantes * 100).toFixed(1))}% de los faltantes del período
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={450}>
              <BarChart 
                data={data.productosConShortage.slice(0, 10).map((item, index) => {
                  // Truncado para nombres largos
                  const originalName = item.name || '';
                  const displayName = originalName.length > 20 ? 
                    originalName.substring(0, 17) + '...' : 
                    originalName;
                  
                  return {
                    ...item,
                    displayName: displayName,
                    originalName: originalName // Guardar para tooltip
                  };
                })}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.3} horizontal={true} vertical={false} />
                <XAxis 
                  dataKey="displayName"
                  tick={{ fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tick={{ fontSize: 11 }} 
                  tickFormatter={(value) => formatNumber(Number(value))}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const percentage = ((data.shortage / data.totalFaltantes) * 100).toFixed(1);
                      return (
                        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{data.originalName}</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-600 dark:text-gray-400">Faltantes:</span>
                              <span className="font-medium text-red-700 dark:text-red-400">{formatNumber(data.shortage)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-600 dark:text-gray-400">% del total:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{percentage}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="shortage" 
                  fill="#b91c1c"
                  fillOpacity={1}
                  stroke="transparent"
                  strokeWidth={0}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Gráfico Mensual Consolidado */}
      {benchmarkData && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8 animate-fade-in">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Evolución Mensual - Nivel de Servicio
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={benchmarkData.datosMensuales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.25} />
              <XAxis 
                dataKey="mesAnio" 
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                domain={calculateYAxisDomain()}
                tick={{ fontSize: 11 }} 
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{data.mesAnio}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Solicitado:</span>
                            <span className="font-medium text-blue-600 dark:text-blue-400">{formatNumber(data.solicitado)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Entregado:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">{formatNumber(data.entregado)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Nivel %:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{data.nivelServicio.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Línea del promedio histórico */}
              <Line 
                type="monotone" 
                dataKey={() => benchmarkData.promedioHistorico} 
                stroke="#9ca3af" 
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Promedio Histórico"
              />
              {/* Línea principal de nivel de servicio */}
              <Line 
                type="monotone" 
                dataKey="nivelServicio" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: "#8b5cf6", strokeWidth: 1, r: 3 }}
                activeDot={{ r: 6 }}
                name="Nivel de Servicio"
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Resumen textual debajo del gráfico */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>
                Rango histórico (10 meses): {Math.min(...benchmarkData.datosMensuales.map(d => d.nivelServicio)).toFixed(1)}% – {Math.max(...benchmarkData.datosMensuales.map(d => d.nivelServicio)).toFixed(1)}%
              </div>
              <div>
                Promedio histórico: <span className="font-medium text-gray-900 dark:text-gray-100">{benchmarkData.promedioHistorico.toFixed(1)}%</span>
              </div>
              <div>
                Nivel actual: 
                <span className={`font-medium ${
                  benchmarkData.brechaVsPromedio > 0.5 ? 'text-green-600 dark:text-green-400' :
                  benchmarkData.brechaVsPromedio < -0.5 ? 'text-red-600 dark:text-red-400' :
                  'text-gray-500 dark:text-gray-400'
                }`}>
                  {benchmarkData.nivelActual.toFixed(1)}% 
                </span>
                <span className={`ml-1 ${
                  benchmarkData.brechaVsPromedio > 0.5 ? 'text-green-600 dark:text-green-400' :
                  benchmarkData.brechaVsPromedio < -0.5 ? 'text-red-600 dark:text-red-400' :
                  'text-gray-500 dark:text-gray-400'
                }`}>
                  ({benchmarkData.brechaVsPromedio >= 0 ? '+' : ''}{benchmarkData.brechaVsPromedio.toFixed(1)} pp vs promedio)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  );
}
