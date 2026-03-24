"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { InfoTooltip } from "@/components/InfoTooltip";
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

// Tipos para los datos de stock
interface StockData {
  databaseName: string;
  filtros: {
    sku: string;
  };
  maxFechaDatos: Date;
  resumenEjecutivo: {
    coberturaGlobal: number;
    porcentajeRiesgoCritico: number;
    porcentajeSobrestock: number;
    porcentajeSinConsumo: number;
    totalSkus: number;
    stockTotal: number;
    consumoTotalDiario: number;
  };
  distribucionCobertura: Array<{
    rango: string;
    cantidadSkus: number;
    stockTotal: number;
    porcentaje: number;
  }>;
  stockEstado: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  riesgoQuiebre: Array<{
    sku: string;
    articulo: string;
    cobertura: number;
    stockActual: number;
    consumoDiario: number;
  }>;
  inmovilizados: Array<{
    sku: string;
    articulo: string;
    diasSinMovimiento: number;
    stockActual: number;
    consumoPromedioDiario: number;
    ultimaFechaMovimiento: string;
  }>;
  topStockSkus: Array<{
    sku: string;
    articulo: string;
    stockTotal: number;
    stockDisponible: number;
  }>;
  generatedAt: string;
};

// Componente para tarjeta de riesgo
const RiskCard = ({
  title,
  value,
  subtitle,
  color,
  badge,
  tooltip
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  badge?: { text: string; color: string };
  tooltip?: string;
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
  };

  const textClasses = {
    blue: 'text-blue-800 dark:text-blue-200',
    green: 'text-green-800 dark:text-green-200',
    red: 'text-red-800 dark:text-red-200',
    orange: 'text-orange-800 dark:text-orange-200',
    yellow: 'text-yellow-800 dark:text-yellow-200'
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-6 relative`}>
        {tooltip && (
          <div className="absolute top-2 right-2">
            <InfoTooltip content={tooltip} />
          </div>
        )}
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-sm font-medium pr-6 ${textClasses[color as keyof typeof textClasses]}`}>
          {title}
        </h3>
        {badge && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold ${textClasses[color as keyof typeof textClasses]} mb-1`}>
        {value}
      </div>
      {subtitle && (
        <div className={`text-xs ${textClasses[color as keyof typeof textClasses]} opacity-75`}>
          {subtitle}
        </div>
      )}
    </div>
    </>
  );
};

// Componente para gráfico Top 5 Stock Concentration
const Top5StockChart = ({ data }: { data: any[] }) => {
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('es-AR').format(Math.round(num));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Concentración de Stock – Top 5
        </h2>
        <InfoTooltip
          title="¿Qué muestra este gráfico?"
          content="Top 5 SKUs por volumen de stock. Stock Total incluye todas las unidades en el almacén (disponibles + reservadas + bloqueadas). Stock Disponible excluye reservas y ubicaciones bloqueadas — es el stock que puede usarse para nuevos pedidos. La brecha entre ambas barras indica unidades comprometidas o inaccesibles."
          position="right"
        />
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart 
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="sku"
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={80}
            tickFormatter={(value) => value.length > 8 ? value.slice(-4) : value}
          />
          <YAxis 
            tick={{ fontSize: 11 }} 
            tickFormatter={(value) => formatNumber(Number(value))}
          />
          <Tooltip
            cursor={false}
            formatter={(value: any, name: any) => {
              if (name === 'stockTotal') {
                return [formatNumber(Number(value)), 'Stock Total'];
              } else if (name === 'stockDisponible') {
                return [formatNumber(Number(value)), 'Stock Disponible'];
              }
              return [value, name];
            }}
            labelFormatter={(label: any) => {
              const item = data.find(d => d.sku === label);
              return item ? `SKU: ${label} - ${item.articulo}` : label;
            }}
            contentStyle={{ 
              backgroundColor: '#1f2937', 
              border: '1px solid #374151', 
              borderRadius: '6px' 
            }}
            labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
            itemStyle={{ color: '#f3f4f6' }}
          />
          <Bar 
            dataKey="stockTotal" 
            fill="#3b82f6"
            name="Stock Total"
            fillOpacity={1}
            stroke="transparent"
            strokeWidth={0}
            radius={[2, 2, 0, 0]}
          />
          <Bar 
            dataKey="stockDisponible" 
            fill="#10b981"
            name="Stock Disponible"
            fillOpacity={1}
            stroke="transparent"
            strokeWidth={0}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Componente para gráfico de barras horizontales de alertas
const AlertBarList = ({ 
  title, 
  data, 
  dataKey, 
  color 
}: { 
  title: string; 
  data: any[]; 
  dataKey: string; 
  color: string;
}) => {
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('es-AR').format(Math.round(num));
  };

  // Función para determinar color de cobertura
  const getCoberturaColor = (cobertura: number) => {
    if (cobertura === 0) return 'text-red-600 dark:text-red-400';
    if (cobertura < 7) return 'text-orange-600 dark:text-orange-400';
    return 'text-gray-700 dark:text-gray-300';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 h-full">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <InfoTooltip
          title="¿Qué muestra este gráfico?"
          content={title.includes("Riesgo de Quiebre")
            ? "SKUs con menor cobertura de stock. Cálculo: Stock actual ÷ Consumo diario promedio del período. Umbral de alerta: < 7 días (rojo) y < 15 días (naranja). El consumo diario es el promedio de salidas registradas. SKUs sin consumo no aparecen en esta lista."
            : "SKUs con mayor cantidad de días sin ningún movimiento de salida. Umbral de inclusión: más de 30 días sin movimiento. Cuanto mayor el valor, mayor el riesgo de obsolescencia o inmovilización de capital. La fecha de último movimiento permite identificar si el producto fue descontinuado."
          }
          position="right"
        />
      </div>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                  {item.sku}
                </span>
                <div className="flex items-center gap-2">
                  {dataKey === 'cobertura' && (
                    <>
                      <span className={`text-lg font-bold ${getCoberturaColor(item.cobertura)}`}>
                        {item.cobertura}d
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        cobertura
                      </span>
                    </>
                  )}
                  {dataKey === 'diasSinMovimiento' && (
                    <>
                      <span className={`text-lg font-bold ${color}`}>
                        {item.diasSinMovimiento}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        días
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`${color.replace('text', 'bg')} h-2 rounded-full`}
                  style={{ 
                    width: `${Math.min((item[dataKey] / Math.max(...data.map(d => d[dataKey]))) * 100, 100)}%` 
                  }}
                ></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                  {item.articulo}
                </span>
                <div className="text-xs text-gray-600 dark:text-gray-400 text-right">
                  {dataKey === 'cobertura' ? (
                    `Stock: ${formatNumber(item.stockActual)} | Consumo: ${formatNumber(item.consumoDiario)}/día`
                  ) : (
                    <div>
                      <div>{`Stock: ${formatNumber(item.stockActual)} | Consumo: ${formatNumber(item.consumoPromedioDiario)}/día`}</div>
                      {item.ultimaFechaMovimiento && (
                        <div>{`Últ. mov: ${new Date(item.ultimaFechaMovimiento).toLocaleDateString('es-AR')}`}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function StockPage() {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sku, setSku] = useState('');
  const [excluirCeroDias, setExcluirCeroDias] = useState(false);

  // Fetch data from API con filtro de SKU
  const fetchStockData = useCallback(
    async () => {
      setLoading(true);
      
      try {
        const params = new URLSearchParams();
        
        if (sku.trim()) {
          params.append('sku', sku.trim());
        }
        
        const url = `/api/stock?${params}`;

        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Error del backend: ${response.status}`);
        }

        const result = await response.json();
        setData(result.data);
      } catch (error) {

        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [sku]
  );

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // Función para formatear números
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('es-AR').format(Math.round(num));
  };

  // Filtrar datos de distribución de cobertura
  const distribucionFiltrada = useMemo(() => {
    if (!data?.distribucionCobertura) return [];
    return excluirCeroDias 
      ? data.distribucionCobertura.filter(item => item.rango !== '0 días')
      : data.distribucionCobertura;
  }, [data?.distribucionCobertura, excluirCeroDias]);

  // Determinar badge de cobertura
  const getCoberturaBadge = (dias: number) => {
    if (dias < 7) {
      return { text: 'Crítico', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
    } else if (dias >= 7 && dias < 15) {
      return { text: 'Bajo', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
    } else if (dias >= 15 && dias <= 120) {
      return { text: 'Saludable', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    } else if (dias > 120 && dias <= 180) {
      return { text: 'Alto', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
    } else {
      return { text: 'Sobrestock Alto', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="p-6">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Inventario / Stock — {clientName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gestión de riesgos y capital inmovilizado
            </p>
          </div>
          {data && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Datos al: {new Date(data.maxFechaDatos).toLocaleDateString('es-AR')}
              {(() => {
                const diasDesdeActualizacion = Math.floor((new Date().getTime() - new Date(data.maxFechaDatos).getTime()) / (1000 * 60 * 60 * 24));
                if (diasDesdeActualizacion > 30) {
                  return (
                    <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded">
                      Dataset histórico / no actualizado
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      </header>

      {/* Filtro SKU */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 mb-8">
        <div className="flex items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filtro por SKU
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Ingrese SKU..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchStockData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Cargando...' : 'Aplicar Filtro'}
            </button>
            <button
              onClick={() => {
                setSku('');
                setTimeout(fetchStockData, 100);
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* BLOQUE 1 - RESUMEN EJECUTIVO */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <RiskCard
              title="% SKUs sin Consumo Reciente"
              value={`${data.resumenEjecutivo?.porcentajeSinConsumo || 0}%`}
              subtitle={`${Math.round((data.resumenEjecutivo?.porcentajeSinConsumo || 0) * (data.resumenEjecutivo?.totalSkus || 0) / 100)} SKUs inactivos`}
              color="yellow"
              tooltip="SKUs que no registraron consumo diario > 0 en el período analizado. Pueden ser productos descontinuados, de baja rotación estacional o con errores en el maestro. Umbral: consumo diario = 0."
            />

            <RiskCard
              title="Cobertura Global (ponderada)"
              value={`${data.resumenEjecutivo?.coberturaGlobal || 0} días`}
              subtitle={`Stock total: ${formatNumber(data.resumenEjecutivo?.stockTotal || 0)} / Consumo diario: ${formatNumber(data.resumenEjecutivo?.consumoTotalDiario || 0)}`}
              color="blue"
              badge={getCoberturaBadge(data.resumenEjecutivo?.coberturaGlobal || 0)}
              tooltip="Días de stock disponible a nivel global. Cálculo: Stock Total ÷ Consumo Diario Total. El consumo diario es el promedio de salidas registradas en el período. Rangos: < 7 días = Crítico | 7–15 = Bajo | 15–120 = Saludable | 120–180 = Alto | > 180 = Sobrestock."
            />

            <RiskCard
              title="% SKUs en Sobrestock"
              value={`${data.resumenEjecutivo?.porcentajeSobrestock || 0}%`}
              subtitle={`${Math.round((data.resumenEjecutivo?.porcentajeSobrestock || 0) * (data.resumenEjecutivo?.totalSkus || 0) / 100)} SKUs con cobertura > 180 días`}
              color="orange"
              tooltip="Porcentaje de SKUs cuya cobertura supera los 180 días. Representa capital inmovilizado con riesgo de vencimiento u obsolescencia. Umbral: cobertura individual > 180 días."
            />

            <RiskCard
              title="% SKUs en Riesgo Crítico"
              value={`${data.resumenEjecutivo?.porcentajeRiesgoCritico || 0}%`}
              subtitle={`${Math.round((data.resumenEjecutivo?.porcentajeRiesgoCritico || 0) * (data.resumenEjecutivo?.totalSkus || 0) / 100)} de ${formatNumber(data.resumenEjecutivo?.totalSkus || 0)} SKUs`}
              color="red"
              tooltip="Porcentaje de SKUs con cobertura menor a 7 días. Requieren reposición urgente para evitar quiebre de stock. Umbral: cobertura individual < 7 días. Se excluyen SKUs sin consumo registrado."
            />
          </div>

          {/* BLOQUE 2 - DISTRIBUCIÓN DE COBERTURA */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Distribución de Cobertura por Rango
                </h2>
                <InfoTooltip
                  title="¿Qué muestra este gráfico?"
                  content="Cantidad de SKUs por rango de cobertura en días. Rangos: 0 días = sin stock o sin consumo registrado | 1–7 días = riesgo crítico (rojo) | 7–15 días = bajo (naranja) | 15–120 días = saludable (verde) | 120–180 días = alto (amarillo) | >180 días = sobrestock (naranja oscuro)."
                  position="right"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="excluirCeroDias"
                  checked={excluirCeroDias}
                  onChange={(e) => setExcluirCeroDias(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <label htmlFor="excluirCeroDias" className="text-sm text-gray-700 dark:text-gray-300">
                  Excluir SKUs sin consumo registrado (cobertura = 0)
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mb-3 text-xs">
              {[
                { color: '#6b7280', label: 'Sin consumo (0d)' },
                { color: '#ef4444', label: 'Crítico (1–7d)' },
                { color: '#f97316', label: 'Bajo (7–15d)' },
                { color: '#22c55e', label: 'Saludable (15–120d)' },
                { color: '#eab308', label: 'Alto (120–180d)' },
                { color: '#ea580c', label: 'Sobrestock (>180d)' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distribucionFiltrada} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="rango" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(Number(value))} />
                <Tooltip
                  cursor={false}
                  formatter={(value: any, name: any) => {
                    if (name === 'cantidadSkus') {
                      return [formatNumber(Number(value)), 'Cantidad SKUs'];
                    } else if (name === 'stockTotal') {
                      return [formatNumber(Number(value)), 'Stock Total'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label: any) => `Rango: ${label}`}
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
                  dataKey="cantidadSkus"
                  name="Cantidad SKUs"
                  fillOpacity={1}
                  stroke="transparent"
                  strokeWidth={0}
                  radius={[4, 4, 0, 0]}
                >
                  {distribucionFiltrada.map((entry, index) => {
                    const rango = entry.rango as string;
                    let color = '#3b82f6'; // azul default
                    if (rango === '0 días')                                         color = '#6b7280'; // gris
                    else if (rango.includes('1-7') || rango.startsWith('1–7'))     color = '#ef4444'; // rojo crítico
                    else if (rango.includes('7-15') || rango.startsWith('7–15'))   color = '#f97316'; // naranja bajo
                    else if (rango.includes('15-') || rango.startsWith('15–'))     color = '#22c55e'; // verde saludable
                    else if (rango.includes('120-') || rango.startsWith('120–'))   color = '#eab308'; // amarillo alto
                    else if (rango.includes('>180') || rango.includes('180+') || rango.startsWith('+180')) color = '#ea580c'; // naranja oscuro sobrestock
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* BLOQUE 3 - ESTADO DE STOCK */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Estado de Stock
                </h2>
                <InfoTooltip
                  title="¿Qué muestra este gráfico?"
                  content="Muestra la distribución de SKUs por estado de stock: Crítico (sin stock), Bajo (menos de 7 días), Saludable (7-120 días), Alto (120-180 días) y Sobrestock (más de 180 días)."
                  position="right"
                />
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.stockEstado || []}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => percent && percent > 0.04 ? `${name}: ${((percent || 0) * 100).toFixed(0)}%` : ''}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(data.stockEstado || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any, name: any) => [
                      `${formatNumber(Number(value))} (${((Number(value) / (data.stockEstado?.reduce((sum, item) => sum + item.value, 0) || 1)) * 100).toFixed(1)}%)`, 
                      'Cantidad'
                    ]}
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151', 
                      borderRadius: '6px' 
                    }}
                    labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry: any) => (
                      <span style={{ color: entry.color, fontSize: '12px' }}>
                        {value}: {formatNumber(entry.payload.value)}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* NUEVO GRÁFICO - TOP 5 STOCK */}
            <Top5StockChart data={data.topStockSkus || []} />
          </div>

          {/* BLOQUE 4 - ALERTAS OPERATIVAS EN PARALELO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Alerta Riesgo de Quiebre */}
            <AlertBarList
              title="⚠️ Top Riesgo de Quiebre"
              data={data.riesgoQuiebre || []}
              dataKey="cobertura"
              color="text-red-600 dark:text-red-400"
            />

            {/* Alerta Inmovilizados */}
            <AlertBarList
              title="⏰ Top Inmovilizados"
              data={data.inmovilizados || []}
              dataKey="diasSinMovimiento"
              color="text-orange-600 dark:text-orange-400"
            />
          </div>
        </>
      )}
    </main>
  );
}
