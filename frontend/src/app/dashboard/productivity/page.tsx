"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clientName } from "@/lib/env";
import ExpandableGrid from '@/components/dashboard/ExpandableGrid';
import { DarkChartThemeProvider, darkChartConfig } from '@/components/dashboard/DarkChartTheme';
import { KpiCardWithTooltip } from '@/components/dashboard/KpiCardWithTooltip';
import { ChartReferenceLabel } from '@/components/dashboard/ChartReferenceLabel';
import { InfoTooltip } from '@/components/InfoTooltip';
import {
  ComposedChart, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Constants ───────────────────────────────────────────────────────────────

const OPERACION_LABELS: Record<string, string> = {
  PICKING: 'Picking',
  CROSSDOCKING: 'Crossdocking',
  EXTRACCION: 'Extracción',
  REPOSICION: 'Reposición',
  ALMACENAJE: 'Almacenaje',
  RECEPCION: 'Recepción',
};

const TOP5_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductivityPage() {
  const [data, setData] = useState<ProductivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [operacion, setOperacion] = useState('PICKING');
  const [queriedRange, setQueriedRange] = useState<{ start: string; end: string } | null>(null);
  const [filterError, setFilterError] = useState('');

  const operacionLabel = OPERACION_LABELS[operacion] ?? operacion;

  const fetchProductivityData = useCallback(async () => {
    if (!fechaInicio || !fechaFin) {
      setFilterError('Por favor seleccione un rango de fechas');
      return;
    }
    setFilterError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('operacion', operacion);
      params.append('fromDate', fechaInicio);
      params.append('toDate', fechaFin);
      const response = await fetch(`/api/productividad?${params}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Error desconocido');
      }
      setData(result);
      setQueriedRange({ start: fechaInicio, end: fechaFin });
    } catch (error) {
      setFilterError('Error al cargar datos: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, operacion]);

  useEffect(() => {
    setFechaInicio('2025-01-01');
    setFechaFin('2025-02-01');
  }, []);

  const handleLimpiar = () => {
    setData(null);
    setQueriedRange(null);
    setFilterError('');
    // Note: fechaInicio / fechaFin are intentionally kept
  };

  // Top 5 operators by U/H (valid sample only)
  const top5Operators = useMemo(() => {
    if (!data?.perOperator) return [];
    return [...data.perOperator]
      .filter(op => op.sample_low === 0)
      .sort((a, b) => b.uni_x_h - a.uni_x_h)
      .slice(0, 5);
  }, [data?.perOperator]);

  // Pivot dailyPerOperator into one row per date with columns per operator
  const dailyEvolutionData = useMemo(() => {
    if (!data?.dailyPerOperator || top5Operators.length === 0) return [];
    // Normalize dates to YYYY-MM-DD (API may return full ISO timestamps)
    const toDateStr = (s: string) => s.length > 10 ? s.substring(0, 10) : s;
    const allDates = [...new Set(data.dailyPerOperator.map(d => toDateStr(d.fecha_operativa)))].sort();
    return allDates.map(fecha => {
      const row: Record<string, any> = { fecha };
      top5Operators.forEach(op => {
        const entry = data.dailyPerOperator.find(
          d => toDateStr(d.fecha_operativa) === fecha && d.usuario_id === op.usuario_id
        );
        row[`op_${op.usuario_id}`] = entry?.uni_x_h ?? null;
      });
      return row;
    });
  }, [data?.dailyPerOperator, top5Operators]);

  // Days active per operator (count of distinct dates in dailyPerOperator)
  const diasActivosMap = useMemo(() => {
    const map = new Map<number, number>();
    data?.dailyPerOperator?.forEach(d => {
      map.set(d.usuario_id, (map.get(d.usuario_id) ?? 0) + 1);
    });
    return map;
  }, [data?.dailyPerOperator]);

  // Reference average for % vs promedio column
  const promedioRef = useMemo(() => {
    if (data?.benchmark) return data.benchmark.promedio;
    if (!data?.perOperator?.length) return null;
    const valid = data.perOperator.filter(op => op.sample_low === 0);
    if (!valid.length) return null;
    return valid.reduce((s, op) => s + op.uni_x_h, 0) / valid.length;
  }, [data]);

  // Subtitle date range
  const subtitleRange = useMemo(() => {
    if (!queriedRange) return null;
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const start = new Date(queriedRange.start + 'T12:00:00').toLocaleDateString('es-AR', opts);
    const end = new Date(queriedRange.end + 'T12:00:00').toLocaleDateString('es-AR', opts);
    return `${start} – ${end}`;
  }, [queriedRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <DarkChartThemeProvider>
      <main className="p-6">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Productividad — {operacionLabel} — {clientName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {subtitleRange
              ? `Período consultado: ${subtitleRange}`
              : 'Seleccione un rango de fechas y presione Filtrar'}
          </p>
        </header>

        {/* Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operación</label>
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
            <div className="flex gap-2">
              <button
                onClick={fetchProductivityData}
                disabled={loading}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap font-medium shadow-sm"
              >
                {loading ? 'Cargando...' : 'Filtrar'}
              </button>
              <button
                onClick={handleLimpiar}
                disabled={loading}
                className="px-6 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed whitespace-nowrap font-medium"
              >
                Limpiar
              </button>
            </div>
          </div>
          {filterError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{filterError}</p>
          )}
        </div>

        {/* KPI Row 1 — Main */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
            <KpiCardWithTooltip
              title="Unidades Totales"
              value={data.cards.unidades_uom.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              icon="📋"
              tooltip="Suma total de unidades procesadas en el período (todas las UoM registradas por el sistema RF)."
            />
            <KpiCardWithTooltip
              title="Horas Registradas (RF)"
              value={data.cards.horas_totales.toLocaleString('es-AR', { maximumFractionDigits: 1 })}
              icon="⏱️"
              tooltip="Total de horas trabajadas según el sistema RF. Calculado como suma de segundos ÷ 3600."
            />
            <KpiCardWithTooltip
              title="Productividad Promedio"
              value={`${data.cards.productividad_periodo_uh.toLocaleString('es-AR', { maximumFractionDigits: 1 })} U/H`}
              icon="📊"
              tooltip="Total Unidades ÷ Total Horas del período. Mide la eficiencia global de la operación."
            />
            <KpiCardWithTooltip
              title="Operarios Activos"
              value={data.cards.operarios.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              icon="👥"
              tooltip="Cantidad de operarios únicos con actividad registrada en el período según el sistema RF."
            />
          </div>
        )}

        {/* KPI Row 2 — Secondary */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCardWithTooltip
              title="Cajas"
              value={data.cards.cajas.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              icon="📦"
              tooltip="Total de cajas procesadas en el período."
              size="small"
            />
            <KpiCardWithTooltip
              title="Packs"
              value={data.cards.packs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              icon="📦"
              tooltip="Total de packs procesados en el período."
              size="small"
            />
            <KpiCardWithTooltip
              title="Pallets"
              value={data.cards.pallets.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              icon="🏗️"
              tooltip="Total de pallets procesados en el período."
              size="small"
            />
            <KpiCardWithTooltip
              title="Hs Prom/Operario"
              value={`${data.cards.horas_promedio_por_operario.toFixed(1)}h`}
              icon="⏱️"
              tooltip="Promedio de horas trabajadas por operario. Total Horas ÷ Nº Operarios."
              size="small"
            />
          </div>
        )}

        {/* Gráfico de Productividad Diaria */}
        {data && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8 relative">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Productividad Media Diaria
                </h2>
                <InfoTooltip content={`Unidades por Hora (U/H) promedio por día para la operación ${operacionLabel}. La línea roja muestra el promedio del período. La banda azul representa el rango normal (P25–P75).`} />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unidades por hora (promedio del día)</p>
            </div>

            {/* Band legend */}
            <div className="flex items-center gap-5 text-xs text-gray-500 dark:text-gray-400 mb-3">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 border-t-2 border-dashed border-red-500"></span>
                Promedio período
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-3 rounded-sm bg-indigo-400 dark:bg-indigo-600 opacity-60"></span>
                Rango normal (P25–P75)
              </span>
            </div>

            {data.benchmark && (
              <ChartReferenceLabel
                value={data.benchmark.promedio}
                label="Promedio"
                unit="U/H"
                lineColor="#ef4444"
                lineStyle="dashed"
                position="top-right"
              />
            )}

            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.25} />
                <XAxis
                  dataKey="fecha_operativa"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    new Date(value + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                  }
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length && label) {
                      const dayData = payload[0].payload;
                      return (
                        <div className="bg-gray-900 p-3 border border-gray-700 rounded-lg shadow-lg">
                          <p className="text-sm font-semibold text-gray-100 mb-2">
                            {new Date(label + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-400">Productividad:</span>
                              <span className="font-medium text-emerald-400">{dayData.uni_x_h.toFixed(1)} U/H</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-400">Unidades:</span>
                              <span className="font-medium text-blue-400">{dayData.unidades.toLocaleString('es-AR')}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-400">Horas:</span>
                              <span className="font-medium text-green-400">{(dayData.segundos / 3600).toFixed(1)}h</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Benchmark band P25–P75 */}
                {data.benchmark && (
                  <ReferenceArea
                    y1={data.benchmark.p25}
                    y2={data.benchmark.p75}
                    fill="#6366f1"
                    fillOpacity={0.12}
                    stroke="none"
                  />
                )}

                {/* Promedio reference line */}
                {data.benchmark && (
                  <Line
                    type="monotone"
                    dataKey={() => data.benchmark!.promedio}
                    stroke="#ef4444"
                    strokeDasharray="8 4"
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    opacity={0.85}
                    isAnimationActive={false}
                  />
                )}

                {/* Main productivity line */}
                <Line
                  type="monotone"
                  dataKey="uni_x_h"
                  stroke="#10b981"
                  name="Productividad Media"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 1, r: 3 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Benchmark stats panel */}
        {data && data.benchmark && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Análisis Estadístico del Período
              </h3>
              <InfoTooltip content="Distribución estadística de la productividad del período. P25-P75 es el rango donde se ubica el 50% central de los operarios (rango normal). P10-P90 cubre el 80% y excluye los extremos. La mediana es el valor central." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rango Normal (P25–P75)</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {data.benchmark.p25.toFixed(1)} – {data.benchmark.p75.toFixed(1)} U/H
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rango Ampliado (P10–P90)</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {data.benchmark.p10.toFixed(1)} – {data.benchmark.p90.toFixed(1)} U/H
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

        {data && !data.benchmark && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Sin datos suficientes para calcular benchmark estadístico en el período seleccionado.
            </p>
          </div>
        )}

        {/* Evolución Diaria — Top 5 Operarios */}
        {data && dailyEvolutionData.length > 0 && top5Operators.length > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Evolución Diaria — Top 5 Operarios
                </h2>
                <InfoTooltip content="Productividad diaria (U/H) de los 5 operarios con mayor rendimiento promedio en el período. Permite ver si el rendimiento es consistente o hay picos aislados." />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unidades por hora por día</p>
            </div>

            {/* Custom legend */}
            <div className="flex flex-wrap gap-4 mb-3">
              {top5Operators.map((op, i) => (
                <span key={op.usuario_id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <span
                    className="inline-block w-5 rounded"
                    style={{ height: '2px', backgroundColor: TOP5_COLORS[i] }}
                  ></span>
                  {op.operario.length > 22 ? op.operario.substring(0, 22) + '…' : op.operario}
                </span>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.25} />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => {
                    const d = new Date(value.includes('T') ? value : value + 'T12:00:00');
                    return isNaN(d.getTime()) ? value : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length && label) {
                      return (
                        <div className="bg-gray-900 p-3 border border-gray-700 rounded-lg shadow-lg min-w-[200px]">
                          <p className="text-sm font-semibold text-gray-100 mb-2">
                            {(() => { const s = String(label); const d = new Date(s.includes('T') ? s : s + 'T12:00:00'); return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); })()}
                          </p>
                          <div className="space-y-1 text-sm">
                            {top5Operators.map((op, i) => {
                              const entry = payload.find(p => p.dataKey === `op_${op.usuario_id}`);
                              return (
                                <div key={op.usuario_id} className="flex justify-between gap-4">
                                  <span style={{ color: TOP5_COLORS[i] }}>
                                    {op.operario.length > 16 ? op.operario.substring(0, 16) + '…' : op.operario}:
                                  </span>
                                  <span className="font-medium text-gray-200">
                                    {entry?.value != null ? `${Number(entry.value).toFixed(1)} U/H` : '–'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {top5Operators.map((op, i) => (
                  <Line
                    key={op.usuario_id}
                    type="monotone"
                    dataKey={`op_${op.usuario_id}`}
                    stroke={TOP5_COLORS[i]}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top 10 Operarios — Horizontal bars */}
        {data && data.perOperator && data.perOperator.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8 relative">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Top 10 Operarios por Productividad
                </h2>
                <InfoTooltip content="Los 10 operarios con mayor productividad (U/H) en el período. Se excluyen operarios con muestra baja (pocos registros) para evitar distorsiones estadísticas." />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unidades por hora (promedio del período)</p>
            </div>
            {(() => {
              const chartData = [...data.perOperator]
                .filter(op => op.sample_low === 0)
                .sort((a, b) => b.uni_x_h - a.uni_x_h)
                .slice(0, 10)
                .map((op, idx, arr) => ({
                  ...op,
                  label: op.operario.length > 24 ? op.operario.substring(0, 24) + '…' : op.operario,
                  barColor: idx < 3 ? '#10b981' : idx >= arr.length - 3 ? '#ef4444' : '#3b82f6',
                }));
              return (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 42)}>
                    <BarChart
                      layout="vertical"
                      data={chartData}
                      margin={{ top: 0, right: 70, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toFixed(0)} />
                      <YAxis type="category" dataKey="label" width={185} tick={{ fontSize: 11 }} />
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const opData = payload[0].payload;
                            return (
                              <div className="bg-gray-900 p-3 border border-gray-700 rounded-lg shadow-lg">
                                <p className="text-sm font-semibold text-gray-100 mb-2">{opData.operario}</p>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-400">Productividad:</span>
                                    <span className="font-medium text-blue-400">{opData.uni_x_h.toFixed(1)} U/H</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-400">Unidades:</span>
                                    <span className="font-medium text-blue-400">{opData.unidades.toLocaleString('es-AR')}</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-400">Horas:</span>
                                    <span className="font-medium text-green-400">{opData.horas.toFixed(1)}h</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-400">Legajo:</span>
                                    <span className="font-medium text-gray-400">{opData.legajo}</span>
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
                        name="Productividad (U/H)"
                        radius={[0, 4, 4, 0]}
                        label={{ position: 'right', fontSize: 11, fill: '#9ca3af', formatter: (v: any) => Number(v).toFixed(1) }}
                        {...darkChartConfig.barCommonProps}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.barColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500"></span>Top 3
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-blue-500"></span>Rango medio
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-red-500"></span>Bottom 3
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Resumen de Productividad por Operario */}
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
                  key: 'horas',
                  label: 'Horas',
                  render: (value: any) => (
                    <span className="font-mono text-gray-900 dark:text-gray-100">{value.toFixed(1)}</span>
                  )
                },
                {
                  key: 'uni_x_h',
                  label: 'U/H',
                  render: (value: any) => (
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{value.toFixed(1)}</span>
                  )
                },
                {
                  key: 'usuario_id',
                  label: 'Días activos',
                  render: (_value: any, row: any) => {
                    const dias = diasActivosMap.get(row.usuario_id) ?? 0;
                    return <span className="font-mono text-gray-900 dark:text-gray-100">{dias}</span>;
                  }
                },
                {
                  key: 'percentil',
                  label: '% vs Prom.',
                  render: (_value: any, row: any) => {
                    if (promedioRef == null || promedioRef === 0) return <span className="text-gray-400">–</span>;
                    const pct = ((row.uni_x_h - promedioRef) / promedioRef) * 100;
                    const color = pct >= 10
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : pct <= -10
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400';
                    return (
                      <span className={`font-mono text-sm font-medium ${color}`}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                      </span>
                    );
                  }
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
                  render: (value: any) => new Date(value + 'T12:00:00').toLocaleDateString('es-AR')
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
                return data.dailyDetailGrid.filter(detail => detail.usuario_id === row.usuario_id);
              }}
            />
          </div>
        )}

      </main>
    </DarkChartThemeProvider>
  );
}
