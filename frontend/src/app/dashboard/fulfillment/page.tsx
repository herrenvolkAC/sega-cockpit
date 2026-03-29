"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from "recharts";
import { InfoTooltip } from '@/components/InfoTooltip';
import { clientName } from "@/lib/env";

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
      if (!fechaInicio || !fechaFin) {
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
      } catch {
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
      if (!fechaInicio || !fechaFin) {
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
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error.message || 'Error desconocido');
        }
        
        setBenchmarkData(result);
      } catch {
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

  // Cargar datos iniciales
  useEffect(() => {
    setFechaInicio('2025-01-01');
    setFechaFin('2025-02-01');
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

  // Dominio dinámico para % Fulfillment diario
  const dailyFulfillmentDomain = useMemo(() => {
    if (!data?.pedidosPorDia?.length) return [60, 100];
    const values = data.pedidosPorDia.map(d => d.fulfillment_pct);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [Math.max(0, Math.floor(min - 3)), Math.min(100, Math.ceil(max + 2))];
  }, [data]);

  const kpiCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        title: "Total Pedidos",
        value: formatNumber(data.totalPedidos),
        subtitle: "Pedidos procesados",
        color: "blue" as const,
        tooltip: "Cantidad de pedidos procesados en el período. Un pedido puede contener múltiples SKUs con cantidades solicitadas."
      },
      {
        title: "Total Solicitado",
        value: formatNumber(data.totalSolicitado),
        subtitle: "Unidades solicitadas",
        color: "neutral" as const,
        tooltip: "Suma total de unidades pedidas por los clientes en el período. Representa la demanda real a satisfacer."
      },
      {
        title: "Total Faltantes",
        value: formatNumber(data.totalFaltantes),
        subtitle: `${data.totalSolicitado > 0 ? ((data.totalFaltantes / data.totalSolicitado) * 100).toFixed(1) : '0'}% del total solicitado`,
        color: "red" as const,
        tooltip: "Unidades que no pudieron ser entregadas por falta de stock disponible al momento del armado del pedido (shortage). A reducir al mínimo posible."
      },
      {
        title: "Fill Rate",
        value: `${data.tasaSatisfaccion.toFixed(1)}%`,
        subtitle: "Unidades entregadas / solicitadas",
        color: data.tasaSatisfaccion >= 95 ? "green" as const :
               data.tasaSatisfaccion >= 90 ? "yellow" as const : "red" as const,
        progress: { value: data.tasaSatisfaccion, target: 95 },
        tooltip: "Fill Rate = (Unidades Entregadas / Unidades Solicitadas) × 100. Meta operativa: ≥ 95%. Verde ≥ 95%, Amarillo 90–95%, Rojo < 90%."
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
              Fulfillment | {clientName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Panel de control de cumplimiento de pedidos</p>
            {data && fechaInicio && fechaFin && (
              <div className="text-base text-gray-600 dark:text-gray-400 mt-1">
                {new Date(fechaInicio + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                {' – '}
                {new Date(fechaFin + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                {` · ${formatNumber(data.totalPedidos)} pedidos · `}
                <span className={`font-semibold ${
                  data.tasaSatisfaccion >= 95 ? 'text-green-600 dark:text-green-400' :
                  data.tasaSatisfaccion >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {data.tasaSatisfaccion.toFixed(1)}% Fill Rate
                </span>
                {' (Meta 95%)'}
              </div>
            )}
            {!data && (
              <p className="text-gray-500 dark:text-gray-400 mt-1">Seleccioná un rango de fechas y presioná Filtrar</p>
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
              onClick={() => { setSku(''); setData(null); }}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Limpiar
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
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 animate-fade-in relative">
              {kpi.tooltip && <div className="absolute top-2 right-2"><InfoTooltip content={kpi.tooltip} /></div>}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 pr-6">{kpi.title}</p>
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
              {kpi.progress && (
                <div className="mt-3">
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        kpi.progress.value >= kpi.progress.target ? 'bg-green-500' :
                        kpi.progress.value >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, (kpi.progress.value / kpi.progress.target) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Meta: {kpi.progress.target}%</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {data && data.totalPedidos > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Line Chart - Pedidos y Faltantes */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Evolución diaria del volumen. Eje izquierdo (azul/verde): unidades solicitadas y entregadas. Eje derecho (rojo): faltantes en escala independiente para que sean visibles aunque sean una fracción del total. El área entre solicitado y entregado es el shortage diario." />
              </div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Pedidos y Faltantes por Día
                </h2>
                <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-500"></span>Solicitado</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-600"></span>Entregado</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-600"></span>Faltantes →</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.pedidosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(Number(v))} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(Number(v))} />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm">
                            <p className="font-semibold text-gray-100 mb-1">{label}</p>
                            <div className="space-y-0.5 text-gray-300">
                              <div className="flex justify-between gap-4"><span>Solicitado:</span><span className="text-blue-400 font-medium">{formatNumber(d.qty_solicitada)}</span></div>
                              <div className="flex justify-between gap-4"><span>Entregado:</span><span className="text-green-400 font-medium">{formatNumber(d.entregados)}</span></div>
                              <div className="flex justify-between gap-4"><span>Faltantes:</span><span className="text-red-400 font-medium">{formatNumber(d.faltantes)}</span></div>
                              <div className="flex justify-between gap-4"><span>Fill Rate:</span><span className="text-white font-medium">{d.fulfillment_pct.toFixed(1)}%</span></div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line yAxisId="left" type="linear" dataKey="qty_solicitada" stroke="#3b82f6" strokeWidth={2} dot={false} name="Solicitado" />
                  <Line yAxisId="left" type="linear" dataKey="entregados" stroke="#16a34a" strokeWidth={2} dot={false} name="Entregado" />
                  <Line yAxisId="right" type="linear" dataKey="faltantes" stroke="#b91c1c" strokeWidth={2} dot={false} name="Faltantes" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Estado de Fulfillment - Line Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Fill Rate diario = unidades entregadas / unidades solicitadas ese día. La línea punteada gris marca la meta del 95%. Los días en rojo están por debajo de la meta. El eje Y se ajusta automáticamente al rango real de datos." />
              </div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Fill Rate por Día
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="w-3 h-0.5 bg-gray-400 border-dashed border-t"></div>
                  <span>Meta 95%</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={275}>
                <LineChart data={data.pedidosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis
                    domain={dailyFulfillmentDomain}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8 relative">
            <div className="absolute top-2 right-2">
              <InfoTooltip content="Muestra los 10 SKUs con mayor cantidad de unidades faltantes en el período. Los primeros concentran la mayor parte del shortage total — atacarlos primero maximiza el impacto en el Fill Rate." />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Top 10 Productos con más Faltantes
            </h2>
            {data.productosConShortage.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Los 3 principales concentran el{' '}
                <strong className="text-gray-700 dark:text-gray-300">
                  {((data.productosConShortage.slice(0, 3).reduce((sum, p) => sum + p.shortage, 0) / data.totalFaltantes) * 100).toFixed(1)}%
                </strong>{' '}
                de los faltantes del período
              </p>
            )}
            <ResponsiveContainer width="100%" height={Math.max(240, data.productosConShortage.slice(0, 10).length * 36)}>
              <BarChart
                layout="vertical"
                data={data.productosConShortage.slice(0, 10).map((item) => ({
                  ...item,
                  label: (item.name || '').length > 35 ? (item.name || '').substring(0, 32) + '…' : (item.name || ''),
                }))}
                margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatNumber(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={200}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload;
                    const pct = data.totalFaltantes > 0
                      ? ((item.shortage / data.totalFaltantes) * 100).toFixed(1)
                      : '0';
                    return (
                      <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg text-sm">
                        <p className="font-semibold text-gray-100 mb-1">{item.name}</p>
                        <div className="space-y-0.5 text-gray-300">
                          <div className="flex justify-between gap-4">
                            <span>Faltantes:</span>
                            <span className="text-red-400 font-medium">{formatNumber(item.shortage)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>% del total:</span>
                            <span className="text-white font-medium">{pct}%</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Solicitado:</span>
                            <span className="text-gray-300">{formatNumber(item.qty_solicitada)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="shortage"
                  fill="#ef4444"
                  radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fontSize: 11, fill: '#9ca3af', formatter: (v: any) => formatNumber(Number(v)) }}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Tabla detalle Top 10 */}
            {data.productosConShortage.length > 0 && (
              <div className="mt-4 overflow-x-auto border-t border-gray-100 dark:border-gray-700 pt-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 font-medium">SKU</th>
                      <th className="text-left py-2 px-3 font-medium">Producto</th>
                      <th className="text-right py-2 px-3 font-medium">Faltantes</th>
                      <th className="text-right py-2 px-3 font-medium">% del total</th>
                      <th className="text-right py-2 px-3 font-medium">% Entregado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.productosConShortage.slice(0, 10).map((p, i) => {
                      const pctTotal = data.totalFaltantes > 0 ? (p.shortage / data.totalFaltantes) * 100 : 0;
                      const pctEntregado = p.qty_solicitada > 0 ? (p.entregados / p.qty_solicitada) * 100 : 0;
                      return (
                        <tr key={i} className={`border-b border-gray-100 dark:border-gray-700/50 ${i % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-700/20'}`}>
                          <td className="py-2 px-3 font-mono text-gray-500 dark:text-gray-400">{p.sku}</td>
                          <td className="py-2 px-3 text-gray-700 dark:text-gray-300 max-w-[220px]">
                            <span className="block truncate" title={p.name}>{p.name}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-red-600 dark:text-red-400">{formatNumber(p.shortage)}</td>
                          <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">{pctTotal.toFixed(1)}%</td>
                          <td className="py-2 px-3 text-right">
                            <span className={`font-medium ${pctEntregado >= 95 ? 'text-green-600 dark:text-green-400' : pctEntregado >= 80 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                              {p.qty_solicitada > 0 ? `${pctEntregado.toFixed(1)}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Contexto Histórico — al final */}
      {benchmarkData && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Contexto Histórico ({benchmarkData.datosMensuales.length} meses)
            </h2>
            <InfoTooltip content="Comparación del Fill Rate del período consultado contra el histórico disponible. La brecha vs promedio indica si el período analizado está por encima o debajo del rendimiento habitual." />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Nivel período', value: `${benchmarkData.nivelActual.toFixed(1)}%`, neutral: true },
              { label: 'Promedio histórico', value: `${benchmarkData.promedioHistorico.toFixed(1)}%`, neutral: true },
              { label: 'Mejor mes', value: `${benchmarkData.mejorMes.toFixed(1)}%`, neutral: true },
              { label: 'Vs promedio', value: `${benchmarkData.brechaVsPromedio >= 0 ? '+' : ''}${benchmarkData.brechaVsPromedio.toFixed(1)} pp`, positive: benchmarkData.brechaVsPromedio >= 0 },
            ].map(({ label, value, neutral, positive }) => (
              <div key={label} className="text-center p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                <p className={`text-xl font-semibold ${neutral ? 'text-gray-900 dark:text-gray-100' : positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico Mensual Consolidado */}
      {benchmarkData && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8 animate-fade-in">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Evolución Mensual — Fill Rate
              </h2>
              <InfoTooltip content="Tendencia mensual del Fill Rate (% de unidades entregadas sobre solicitadas). Permite identificar meses problemáticos y comparar la evolución del nivel de servicio a lo largo del tiempo." />
            </div>
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
          
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex gap-6">
            <span>Rango: <strong className="text-gray-700 dark:text-gray-300">{Math.min(...benchmarkData.datosMensuales.map(d => d.nivelServicio)).toFixed(1)}% – {Math.max(...benchmarkData.datosMensuales.map(d => d.nivelServicio)).toFixed(1)}%</strong></span>
            <span>Promedio: <strong className="text-gray-700 dark:text-gray-300">{benchmarkData.promedioHistorico.toFixed(1)}%</strong></span>
          </div>
        </div>
      )}
    </main>
    </>
  );
}
