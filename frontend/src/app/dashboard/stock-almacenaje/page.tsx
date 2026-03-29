"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { InfoTooltip } from "@/components/InfoTooltip";
import { clientName } from "@/lib/env";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// CSS for animations and custom chart styles
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 200ms ease-out forwards;
  }

  .recharts-bar-rectangle {
    transition: all 0.15s ease-in-out !important;
  }

  .recharts-bar-rectangle:hover {
    filter: brightness(1.08) !important;
    stroke: rgba(255, 255, 255, 0.2) !important;
    stroke-width: 1px !important;
  }

  .recharts-bar-rectangle.recharts-active-bar {
    filter: brightness(1.12) !important;
    stroke: rgba(255, 255, 255, 0.3) !important;
    stroke-width: 1.5px !important;
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

// Tipos para los datos de stock y almacenaje
interface StockAlmacenajeData {
  databaseName: string;
  fechaFoto: {
    snapshot_dt: string;
    fecha_operativa: string;
  };
  filtros: {
    sku: string | null;
    proveedor: string | null;
  };
  kpis: {
    pallets: number;
    stockCajas: number;
    stockUnidades: number;
    contenedoresFueraAlmacenaje: number;
    contenedoresBloqueados: number;
    ubicacionesBloqueadas: number;
    contenedoresVencidos: number;
  };
  graficos: {
    palletsPorSector: Array<{
      Sector: string;
      Pallets: number;
    }>;
    palletsPorSeccion: Array<{
      Seccion: string;
      Pallets: number;
    }>;
    contenedoresPorCanal: Array<{
      TipoCanal: string;
      Contenedores: number;
    }>;
  };
  generatedAt: string;
}

// Colores fijos para el gráfico de torta (determinísticos)
const PIE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
];

// Componente para tarjeta de KPI
const KPICard = ({
  title,
  value,
  subtitle,
  color,
  tooltip
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  tooltip?: string;
}) => {
  const colorClasses: Record<string, string> = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green:  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    red:    'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  };

  const textClasses: Record<string, string> = {
    blue:   'text-blue-800 dark:text-blue-200',
    green:  'text-green-800 dark:text-green-200',
    red:    'text-red-800 dark:text-red-200',
    orange: 'text-orange-800 dark:text-orange-200',
    yellow: 'text-yellow-800 dark:text-yellow-200',
    purple: 'text-purple-800 dark:text-purple-200',
  };

  return (
    <div className={`${colorClasses[color] ?? colorClasses.blue} border rounded-lg p-6 relative`}>
      {tooltip && (
        <div className="absolute top-2 right-2">
          <InfoTooltip content={tooltip} />
        </div>
      )}
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
        {title}
      </div>
      <div className={`text-2xl font-bold ${textClasses[color] ?? textClasses.blue} mb-1`}>
        {value}
      </div>
      {subtitle && (
        <div className={`text-xs ${textClasses[color] ?? textClasses.blue} opacity-75`}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default function StockAlmacenajePage() {
  const [data, setData] = useState<StockAlmacenajeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sku, setSku] = useState('');
  const [proveedor, setProveedor] = useState('');

  const fetchStockAlmacenajeData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (sku.trim()) params.append('sku', sku.trim());
      if (proveedor.trim()) params.append('proveedor', proveedor.trim());

      const response = await fetch(`/api/stock-almacenaje?${params}`);
      if (!response.ok) throw new Error(`Error del backend: ${response.status}`);

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('No se pudieron cargar los datos. Verificá la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [sku, proveedor]);

  useEffect(() => {
    fetchStockAlmacenajeData();
  }, [fetchStockAlmacenajeData]);

  const formatNumber = (num: number): string =>
    new Intl.NumberFormat('es-AR').format(Math.round(num));

  const kpiCards = useMemo(() => {
    if (!data) return [];

    return [
      {
        title: "Total Pallets",
        value: formatNumber(data.kpis.pallets),
        color: "blue",
        tooltip: "Cantidad total de pallets físicamente almacenados en el depósito en la fecha de la foto."
      },
      {
        title: "Stock Cajas",
        value: formatNumber(Number(data.kpis.stockCajas)),
        color: "green",
        tooltip: "Total de cajas en stock, independientemente de su estado de bloqueo o canal asignado."
      },
      {
        title: "Stock Unidades",
        value: formatNumber(Number(data.kpis.stockUnidades)),
        color: "purple",
        tooltip: "Total de unidades individuales en stock. Equivale a la suma de (cajas × unidades por caja) de todos los contenedores."
      },
      {
        title: "Contenedores Fuera de Almacén",
        value: formatNumber(Number(data.kpis.contenedoresFueraAlmacenaje)),
        subtitle: "Fuera del área de almacenamiento",
        color: "orange",
        tooltip: "Contenedores registrados en el sistema pero que físicamente no están en una ubicación de almacenaje (en recepción, staging, tránsito interno, etc.). Requieren revisión y reubicación."
      },
      {
        title: "Contenedores Bloqueados",
        value: formatNumber(Number(data.kpis.contenedoresBloqueados)),
        subtitle: "Por bloqueo de contenedor",
        color: "orange",
        tooltip: "Contenedores bloqueados a nivel de contenedor: no disponibles para picking ni despacho hasta que se levante el bloqueo. Causas habituales: cuarentena de calidad, discrepancia de conteo, mercadería dañada."
      },
      {
        title: "Ubicaciones Bloqueadas",
        value: formatNumber(Number(data.kpis.ubicacionesBloqueadas)),
        subtitle: "Por bloqueo de ubicación",
        color: "orange",
        tooltip: "Contenedores en ubicaciones físicas bloqueadas (piso, pasillo o posición fuera de servicio). Todo el stock en esas posiciones queda inoperable hasta que se habilite la ubicación."
      },
      {
        title: "Contenedores Vencidos",
        value: formatNumber(Number(data.kpis.contenedoresVencidos)),
        subtitle: "Con fecha de vencimiento pasada",
        color: Number(data.kpis.contenedoresVencidos) > 0 ? "red" : "green",
        tooltip: "Contenedores cuya fecha de vencimiento ya pasó. Deben ser revisados, retirados del stock disponible y gestionados según el procedimiento de merma. Se excluyen contenedores sin fecha de vencimiento registrada."
      }
    ];
  }, [data]);

  const filteredPalletsPorSector = useMemo(
    () => data?.graficos?.palletsPorSector ?? [],
    [data?.graficos?.palletsPorSector]
  );

  const filteredPalletsPorSeccion = useMemo(
    () => data?.graficos?.palletsPorSeccion ?? [],
    [data?.graficos?.palletsPorSeccion]
  );

  const canalData = useMemo(
    () => (data?.graficos?.contenedoresPorCanal ?? [])
      .filter(item => item.TipoCanal !== "Sin canal")
      .sort((a, b) => b.Contenedores - a.Contenedores),
    [data?.graficos?.contenedoresPorCanal]
  );

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#1f2937',
      border: '1px solid #374151',
      borderRadius: '6px'
    },
    labelStyle: { color: '#f3f4f6', fontWeight: 'bold' as const },
    itemStyle: { color: '#f3f4f6' }
  };

  const hasData = data && (
    Number(data.kpis.pallets) > 0 ||
    Number(data.kpis.stockCajas) > 0 ||
    Number(data.kpis.stockUnidades) > 0
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <main className="p-6">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Stock y Almacenaje — {clientName}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Visión general del inventario y ocupación del almacén
              </p>
            </div>
            {data && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Fecha de datos: {new Date(data.fechaFoto.fecha_operativa).toLocaleDateString('es-AR')}
              </div>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
            <span className="text-red-600 dark:text-red-400 font-medium">{error}</span>
            <button
              onClick={fetchStockAlmacenajeData}
              className="ml-auto text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 border border-gray-200 dark:border-gray-700 mb-8">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Filtros de búsqueda
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SKU (Opcional)
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ingrese SKU..."
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
                placeholder="Ingrese proveedor..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchStockAlmacenajeData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Consultando...' : 'Aplicar Filtros'}
              </button>
              <button
                onClick={() => {
                  setSku('');
                  setProveedor('');
                }}
                disabled={loading}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {data && !hasData && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 mb-8 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              No hay datos para los filtros aplicados
            </h3>
            <p className="text-yellow-700 dark:text-yellow-300 mb-6">
              No se encontraron registros de stock y almacenaje para los criterios seleccionados.
            </p>
            <button
              onClick={() => { setSku(''); setProveedor(''); }}
              className="px-4 py-2 bg-yellow-100 dark:bg-yellow-800 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors text-yellow-800 dark:text-yellow-200"
            >
              Ver todos los registros
            </button>
          </div>
        )}

        {/* KPI Cards */}
        {hasData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {kpiCards.map((kpi, index) => (
              <KPICard key={index} {...kpi} />
            ))}
          </div>
        )}

        {/* Gráficos */}
        {hasData && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Pallets por Sector */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Pallets por Sector
                    </h2>
                    <InfoTooltip content="Distribución de pallets almacenados por sector del depósito. Permite identificar zonas de alta concentración y balancear la ocupación del almacén." />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={filteredPalletsPorSector} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                    <XAxis dataKey="Sector" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => formatNumber(Number(v))} />
                    <Tooltip
                      formatter={(value: any) => [formatNumber(Number(value)), 'Pallets']}
                      {...tooltipStyle}
                      cursor={false}
                    />
                    <Bar dataKey="Pallets" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pallets por Sección */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Pallets por Sección
                    </h2>
                    <InfoTooltip content="Cantidad de pallets por sección o pasillo del depósito. Útil para detectar secciones saturadas y planificar reubicaciones de mercadería." />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={filteredPalletsPorSeccion} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => formatNumber(Number(v))} />
                    <YAxis
                      type="category"
                      dataKey="Seccion"
                      width={140}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatNumber(Number(value)), 'Pallets']}
                      {...tooltipStyle}
                      cursor={false}
                    />
                    <Bar dataKey="Pallets" fill="#10b981" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribución de Contenedores por Canal */}
            {canalData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Distribución de Contenedores por Canal
                    </h2>
                    <InfoTooltip content="Porcentaje de contenedores asignados a cada canal de despacho (supermercados, mayoristas, etc.). Permite visualizar el peso operativo de cada canal sobre el stock almacenado." />
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={canalData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ TipoCanal, percent }: any) =>
                          (percent ?? 0) > 0.04 ? `${TipoCanal}: ${((percent ?? 0) * 100).toFixed(0)}%` : ''
                        }
                        outerRadius={100}
                        dataKey="Contenedores"
                      >
                        {canalData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                            stroke="#fff"
                            strokeWidth={1}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => [formatNumber(Number(value)), 'Contenedores']}
                        {...tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Leyenda */}
                  <div className="space-y-2 w-[220px] flex-shrink-0 pr-6">
                    {canalData.map((item, index) => {
                      const total = canalData.reduce((sum, c) => sum + c.Contenedores, 0);
                      const pct = ((item.Contenedores / total) * 100).toFixed(1);
                      return (
                        <div key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span
                            className="inline-block w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium leading-snug">{item.TipoCanal}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">
                              {formatNumber(item.Contenedores)} cont. · {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
