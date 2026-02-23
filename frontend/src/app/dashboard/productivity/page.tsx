"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ExpandableGrid from '@/components/dashboard/ExpandableGrid';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area } from "recharts";

// Tipos de datos
interface DailyData {
  fecha_operativa: string;
  unidades: number;
  movimientos: number;
  segundos: number;
  uni_x_h: number;
  mov_x_h: number;
}

interface CardsData {
  cajas: number;
  unidades_uom: number;
  packs: number;
  pallets: number;
  operarios: number;
  horas_promedio_por_operario: number;
  segundos_totales: number;
  horas_totales: number;
  productividad_periodo_uh: number;
}

interface PerOperatorData {
  usuario_id: number;
  legajo: string;
  operario: string;
  horas: number;
  movimientos: number;
  unidades: number;
  cajas: number;
  unidades_uom: number;
  packs: number;
  uni_x_h: number;
  mov_x_h: number;
  productividad_media: number;
  sample_low: number;
  percentil: number;
  grupo_percentil: string;
}

interface DailyPerOperatorData {
  fecha_operativa: string;
  usuario_id: number;
  operario: string;
  unidades: number;
  movimientos: number;
  segundos: number;
  uni_x_h: number;
  mov_x_h: number;
}

interface DailyDetailGridData {
  fecha_operativa: string;
  usuario_id: number;
  operario: string;
  legajo: string;
  bultos: number;
  minutos: number;
  productividad: number;
}

interface BenchmarkStats {
  promedio: number;
  mediana: number;
  p25: number;
  p75: number;
  p10: number;
  p90: number;
}

interface ProductivityData {
  from: string;
  to: string;
  operacion: string;
  daily: DailyData[];
  cards: CardsData;
  perOperator: PerOperatorData[];
  dailyPerOperator: DailyPerOperatorData[];
  dailyDetailGrid: DailyDetailGridData[];
  benchmark: BenchmarkStats | null;
}

export default function ProductivityPage() {
  const [data, setData] = useState<ProductivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [operacion, setOperacion] = useState('PICKING');

  // Debug: Log inicial
  console.log('ProductivityPage mounted');

  // Fetch data from API
  const fetchProductivityData = useCallback(async () => {
    console.log('fetchProductivityData called', { fechaInicio, fechaFin, operacion });
    
    if (!fechaInicio || !fechaFin) {
      alert('Por favor seleccione un rango de fechas');
      return;
    }

    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      params.append('operacion', operacion);
      params.append('fromDate', fechaInicio);
      params.append('toDate', fechaFin);
      
      const url = `/api/productividad?${params}`;
      console.log('Requesting URL:', url);
      
      const response = await fetch(url);
      const result = await response.json();
      
      console.log('=== FRONTEND API RESPONSE ===');
      console.log('Raw response:', result);
      console.log('Response structure:', {
        hasDaily: !!result.daily,
        dailyLength: result.daily?.length,
        hasCards: !!result.cards,
        hasPerOperator: !!result.perOperator,
        perOperatorLength: result.perOperator?.length
      });
      
      if (!response.ok) {
        throw new Error(result.error?.message || 'Error desconocido');
      }
      
      setData(result);
    } catch (error) {
      console.error('Error fetching productivity data:', error);
      alert('Error al cargar datos de productividad: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, operacion]);

  useEffect(() => {
    console.log('useEffect running');
    // Establecer fechas por defecto (últimos 7 días)
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const inicioStr = today.toISOString().split('T')[0];
    const finStr = sevenDaysAgo.toISOString().split('T')[0];
    
    console.log('Setting default dates:', { inicioStr, finStr });
    
    setFechaFin(inicioStr);
    setFechaInicio(finStr);
  }, []);

  const handleLimpiar = () => {
    console.log('handleLimpiar called');
    setFechaInicio('');
    setFechaFin('');
    setData(null);
  };

  console.log('Current state:', { data, loading, fechaInicio, fechaFin });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Productividad - {operacion === 'PICKING' ? 'Picking' : operacion === 'CROSSDOCKING' ? 'Crossdocking' : operacion === 'EXTRACCION' ? 'Extracción' : operacion === 'REPOSICION' ? 'Reposición' : operacion === 'ALMACENAJE' ? 'Almacenaje' : 'Recepción'} - Macromercado
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Panel de control de productividad de operaciones {operacion}
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
              Operación
            </label>
            <select
              value={operacion}
              onChange={(e) => setOperacion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="PICKING">Picking</option>
              <option value="CROSSDOCKING">Crossdocking</option>
              <option value="EXTRACCION">Extracción</option>
              <option value="REPOSICION">Reposición</option>
              <option value="ALMACENAJE">Almacenaje</option>
              <option value="RECEPCION">Recepción</option>
            </select>
          </div>
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={fetchProductivityData}
              disabled={loading}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap font-medium shadow-sm"
            >
              {loading ? 'Cargando...' : 'Filtrar'}
            </button>
            <button
              onClick={() => {
                setFechaInicio('');
                setFechaFin('');
                setData(null);
              }}
              disabled={loading}
              className="px-6 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed whitespace-nowrap font-medium"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards - Primera fila (principales) */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-7 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Unidades Totales</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.cards.unidades_uom.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-2xl">📋</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-7 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Horas registradas (RF)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.cards.horas_totales.toLocaleString('es-AR', { maximumFractionDigits: 1 })}
                </p>
              </div>
              <div className="text-2xl">⏱️</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-7 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Productividad Promedio</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.cards.productividad_periodo_uh.toLocaleString('es-AR', { maximumFractionDigits: 1 })} U/H
                </p>
              </div>
              <div className="text-2xl">📊</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-7 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Operarios</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.cards.operarios.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-2xl">👥</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-7 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total UoM (mixto)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {(data.cards.cajas + data.cards.packs + data.cards.pallets).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-2xl">📦</div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards - Segunda fila (secundarios) */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Cajas</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {data.cards.cajas.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-lg">📦</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Packs</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {data.cards.packs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-lg">📦</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Pallets</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {data.cards.pallets.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-lg">🏗️</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Horas registradas por operario (RF)</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {data.cards.horas_promedio_por_operario.toFixed(1)}h
                </p>
              </div>
              <div className="text-lg">⏱️</div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Productividad Diaria Media */}
      {data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Productividad Media Diaria
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Unidades por hora (promedio del día)
            </p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.25} />
              <XAxis 
                dataKey="fecha_operativa" 
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                }}
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                labelFormatter={(value) => value ? new Date(value).toLocaleDateString('es-AR') : ''}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length && label) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          {new Date(label).toLocaleDateString('es-AR')}
                        </p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Productividad:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{data.uni_x_h.toFixed(1)} U/H</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Unidades:</span>
                            <span className="font-medium text-blue-600 dark:text-blue-400">{data.unidades.toLocaleString('es-AR')}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Horas:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">{(data.segundos / 3600).toFixed(1)}h</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              
              {/* Línea principal de productividad */}
              <Line 
                type="monotone" 
                dataKey="uni_x_h" 
                stroke="#10b981" 
                name="Productividad Media"
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 1, r: 3 }}
                activeDot={{ r: 6 }}
              />
              
              {/* Benchmark - solo si hay datos */}
              {data.benchmark && (
                <>
                  {/* Línea de promedio */}
                  <Line 
                    type="monotone" 
                    dataKey={() => data.benchmark!.promedio}
                    stroke="#6b7280" 
                    name="Promedio"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={false}
                  />
                  
                  {/* Área P25-P75 */}
                  <Area
                    type="monotone"
                    dataKey={() => data.benchmark!.p75}
                    fill="#e5e7eb"
                    stroke="none"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey={() => data.benchmark!.p25}
                    fill="#ffffff"
                    stroke="none"
                    fillOpacity={1}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Resumen de Benchmark Estadístico */}
      {data && data.benchmark && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Análisis Estadístico del Período
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rango Normal (P25-P75)</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {data.benchmark.p25.toFixed(1)} - {data.benchmark.p75.toFixed(1)} U/H
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rango Ampliado (P10-P90)</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {data.benchmark.p10.toFixed(1)} - {data.benchmark.p90.toFixed(1)} U/H
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Mediana</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {data.benchmark.mediana.toFixed(1)} U/H
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay benchmark */}
      {data && !data.benchmark && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Sin datos suficientes para calcular benchmark estadístico en el período seleccionado.
          </p>
        </div>
      )}

      {/* Top 10 Operarios por Productividad */}
      {data && data.perOperator && data.perOperator.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Top 10 Operarios por Productividad
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Unidades por hora (promedio del período)
            </p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart 
              data={data.perOperator
                .filter(op => op.sample_low === 0) // Excluir muestras bajas
                .sort((a, b) => b.uni_x_h - a.uni_x_h)
                .slice(0, 10)
                .map(item => ({
                  ...item,
                  operarioDisplay: item.operario.length > 15 
                    ? item.operario.substring(0, 15) + '...' 
                    : item.operario
                }))
              }
              margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.25} />
              <XAxis 
                type="category" 
                dataKey="operarioDisplay" 
                tick={{ fontSize: 9 }}
                height={80}
                tickFormatter={(value) => value}
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          {data.operario}
                        </p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Productividad:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{data.uni_x_h.toFixed(1)} U/H</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Unidades:</span>
                            <span className="font-medium text-blue-600 dark:text-blue-400">{data.unidades.toLocaleString('es-AR')}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Horas:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">{data.horas.toFixed(1)}h</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-600 dark:text-gray-400">Legajo:</span>
                            <span className="font-medium text-gray-500 dark:text-gray-400">{data.legajo}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="uni_x_h" 
                fill="#3b82f6" 
                name="Productividad (U/H)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grilla Expandible de Productividad por Operario */}
      {data && data.perOperator && data.perOperator.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Resumen de Productividad por Operario
          </h2>
          <ExpandableGrid
            data={data.perOperator}
            detailKey="usuario_id"
            columns={[
              {
                key: 'operario',
                label: 'Operario',
                render: (value: any, row: any) => {
                  const sortedData = [...data.perOperator].sort((a, b) => b.uni_x_h - a.uni_x_h);
                  const top3 = sortedData.slice(0, 3).map(d => d.usuario_id);
                  const bottom3 = sortedData.slice(-3).map(d => d.usuario_id);
                  const isTop = top3.includes(row.usuario_id);
                  const isBottom = bottom3.includes(row.usuario_id);
                  
                  return (
                    <div className={`px-3 py-2 rounded ${isTop ? 'bg-green-50 dark:bg-green-900/20' : isBottom ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{value}</div>
                        {row.sample_low === 1 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Muestra baja
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Legajo: {row.legajo}</div>
                    </div>
                  );
                }
              },
              {
                key: 'unidades',
                label: 'Unidades',
                render: (value: any) => (
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </span>
                )
              },
              {
                key: 'movimientos',
                label: 'Movimientos',
                render: (value: any) => (
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </span>
                )
              },
              {
                key: 'horas',
                label: 'Horas',
                render: (value: any) => (
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {value.toFixed(1)}
                  </span>
                )
              },
              {
                key: 'uni_x_h',
                label: 'U/H',
                render: (value: any) => (
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                    {value.toFixed(1)}
                  </span>
                )
              },
              {
                key: 'mov_x_h',
                label: 'Mov/H',
                render: (value: any) => (
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {value.toFixed(1)}
                  </span>
                )
              },
              {
                key: 'productividad_media',
                label: 'Prod. Media',
                render: (value: any) => (
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {value.toFixed(1)}
                  </span>
                )
              },
              {
                key: 'grupo_percentil',
                label: 'Grupo',
                render: (value: any) => {
                  const getGroupColor = (grupo: string) => {
                    switch (grupo) {
                      case 'Top 20%': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
                      case 'Rango Medio Alto': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
                      case 'Rango Medio': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
                      case 'Rango Medio Bajo': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
                      case 'Bottom 20%': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
                      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
                    }
                  };
                  
                  return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGroupColor(value)}`}>
                      {value}
                    </span>
                  );
                }
              },
            ]}
            detailColumns={[
              {
                key: 'fecha_operativa',
                label: 'Fecha',
                render: (value: any) => new Date(value).toLocaleDateString('es-AR')
              },
              {
                key: 'bultos',
                label: 'Bultos',
                render: (value: any) => value.toLocaleString('es-AR', { maximumFractionDigits: 0 })
              },
              {
                key: 'minutos',
                label: 'Minutos',
                render: (value: any) => value.toFixed(1)
              },
              {
                key: 'productividad',
                label: 'Productividad',
                render: (value: any) => value.toFixed(1)
              }
            ]}
            getDetailData={async (row) => {
              // Filtrar datos diarios para este operario
              return data.dailyDetailGrid.filter(detail => detail.usuario_id === row.usuario_id);
            }}
          />
        </div>
      )}

      </main>
  );
}
