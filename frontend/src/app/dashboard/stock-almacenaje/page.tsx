"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// CSS for animations and custom chart styles
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 200ms ease-out forwards;
  }
  
  /* Custom bar chart styles - Dark theme optimized */
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
  
  /* Remove any background overlays */
  .recharts-active-bar-background,
  .recharts-bar-background-rectangle {
    display: none !important;
    opacity: 0 !important;
  }
  
  /* Dark mode tooltip adjustments */
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
};

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
      <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-6 relative group`}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full cursor-help"></div>
          {tooltip && (
            <div className="absolute right-0 top-5 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              {tooltip}
            </div>
          )}
        </div>
      </div>
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
        {title}
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

export default function StockAlmacenajePage() {
  console.log('StockAlmacenajePage mounted');
  
  const [data, setData] = useState<StockAlmacenajeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sku, setSku] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [selectedSeccion, setSelectedSeccion] = useState<string | null>(null);
  const [selectedTipoCanal, setSelectedTipoCanal] = useState<string | null>(null);
  const [hoveredSectorIndex, setHoveredSectorIndex] = useState<number | null>(null);
  const [hoveredCanalIndex, setHoveredCanalIndex] = useState<number | null>(null);

  // Fetch data from API con filtros (debounced)
  const fetchStockAlmacenajeData = useCallback(
    async () => {
      setLoading(true);
      
      try {
        const params = new URLSearchParams();
        
        if (sku.trim()) {
          params.append('sku', sku.trim());
        }
        if (proveedor.trim()) {
          params.append('proveedor', proveedor.trim());
        }
        
        const url = `/api/stock-almacenaje?${params}`;
        console.log('Requesting URL:', url);
        
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          console.error('Response not OK:', response.status, response.statusText);
          throw new Error(`Error del backend: ${response.status}`);
        }

        const result = await response.json();
        console.log('API Response:', result);
        setData(result);
      } catch (error) {
        console.error('Error fetching stock almacenaje data:', error);
        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [sku, proveedor]
  );

  // Cargar datos al montar el componente
  useEffect(() => {
    console.log('useEffect triggered, calling fetchStockAlmacenajeData');
    fetchStockAlmacenajeData();
  }, [fetchStockAlmacenajeData]);

  // Función para formatear números
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('es-AR').format(Math.round(num));
  };

  // Función para formatear etiquetas
  const formatChipLabel = (value: string | null, placeholder: string, truncate: boolean = false) => {
    if (!value) return placeholder;
    if (truncate && value.length > 15) return value.substring(0, 12) + '...';
    return value;
  };

  // Tarjetas KPI
  const kpiCards = useMemo(() => {
    if (!data) return [];
    
    return [
      {
        title: "Total Pallets",
        value: formatNumber(data.kpis.pallets),
        color: "blue" as const,
        tooltip: "Número total de pallets en almacenamiento"
      },
      {
        title: "Stock Cajas",
        value: formatNumber(Number(data.kpis.stockCajas)),
        color: "green" as const,
        tooltip: "Total de cajas en stock"
      },
      {
        title: "Stock Unidades",
        value: formatNumber(Number(data.kpis.stockUnidades)),
        color: "purple" as const,
        tooltip: "Total de unidades individuales en stock"
      },
      {
        title: "Contenedores Fuera de Almacén",
        value: formatNumber(Number(data.kpis.contenedoresFueraAlmacenaje)),
        subtitle: "Fuera del área de almacenamiento",
        color: "orange" as const,
        tooltip: "Contenedores con FueraDeAlmacenaje=1"
      },
      {
        title: "Contenedores Bloqueados",
        value: formatNumber(Number(data.kpis.contenedoresBloqueados)),
        subtitle: "Por bloqueo de contenedor",
        color: "orange" as const,
        tooltip: "Contenedores con Bloqueo_Contenedor=1"
      },
      {
        title: "Ubicaciones Bloqueadas",
        value: formatNumber(Number(data.kpis.ubicacionesBloqueadas)),
        subtitle: "Por bloqueo de ubicación",
        color: "orange" as const,
        tooltip: "Contenedores en ubicaciones con Ubicacion_Bloqueada=1"
      },
      {
        title: "Contenedores Vencidos",
        value: formatNumber(Number(data.kpis.contenedoresVencidos)),
        subtitle: "Con fecha de vencimiento pasada",
        color: Number(data.kpis.contenedoresVencidos) > 0 ? "red" as const : "green" as const,
        tooltip: "Contenedores vencidos (excluye fecha 1900-01-01 como sin vencimiento)"
      }
    ];
  }, [data]);

  // Datos filtrados para gráficos
  const filteredPalletsPorSector = useMemo(() => {
    if (!data?.graficos?.palletsPorSector) return [];
    return data.graficos.palletsPorSector;
  }, [data?.graficos?.palletsPorSector]);

  const filteredPalletsPorSeccion = useMemo(() => {
    if (!data?.graficos?.palletsPorSeccion) return [];
    return data.graficos.palletsPorSeccion;
  }, [data?.graficos?.palletsPorSeccion]);

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
                Stock y Almacenaje
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
                  fetchStockAlmacenajeData();
                }}
                disabled={loading}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Limpiar
              </button>
            </div>
          </div>
          {(selectedSector || selectedSeccion || selectedTipoCanal) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Filtros por interacción:</span>
              {selectedSector && (
                <button
                  onClick={() => setSelectedSector(null)}
                  className="flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                >
                  Sector: {formatChipLabel(selectedSector, 'Sin sector', true)} <span className="opacity-70">x</span>
                </button>
              )}
              {selectedSeccion && (
                <button
                  onClick={() => setSelectedSeccion(null)}
                  className="flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                >
                  Sección: {formatChipLabel(selectedSeccion, 'Sin sección', true)} <span className="opacity-70">x</span>
                </button>
              )}
              {selectedTipoCanal && (
                <button
                  onClick={() => setSelectedTipoCanal(null)}
                  className="flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                >
                  Tipo: {formatChipLabel(selectedTipoCanal, 'Sin tipo', true)} <span className="opacity-70">x</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Empty State */}
        {data && (Number(data.kpis.pallets) === 0 && Number(data.kpis.stockCajas) === 0 && Number(data.kpis.stockUnidades) === 0) && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 mb-8 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              No hay datos para los filtros aplicados
            </h3>
            <p className="text-yellow-700 dark:text-yellow-300 mb-6">
              No se encontraron registros de stock y almacenaje para los criterios seleccionados.
            </p>
            <div className="text-left">
              <h4 className="font-medium mb-2">💡 Sugerencias:</h4>
              <ul className="space-y-1 text-left">
                <li>• Prueba con diferentes SKU o proveedores</li>
                <li>• Deja los filtros vacíos para ver todos los datos</li>
                <li>• Verifica la ortografía de los términos</li>
              </ul>
            </div>
            <button
              onClick={() => {
                setSku('');
                setProveedor('');
                fetchStockAlmacenajeData();
              }}
              className="mt-6 w-full text-left px-3 py-2 bg-yellow-100 dark:bg-yellow-800 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
            >
              📋 Ver todos los registros
            </button>
          </div>
        )}
        
        {/* KPI Cards */}
        {data && (Number(data.kpis.pallets) > 0 || Number(data.kpis.stockCajas) > 0 || Number(data.kpis.stockUnidades) > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {kpiCards.map((kpi: any, index: number) => (
              <KPICard key={index} {...kpi} />
            ))}
          </div>
        )}

        {/* Gráficos */}
        {data && (Number(data.kpis.pallets) > 0 || Number(data.kpis.stockCajas) > 0 || Number(data.kpis.stockUnidades) > 0) && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Pallets por Sector */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Pallets por Sector
                  </h2>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={filteredPalletsPorSector} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                    <XAxis type="category" dataKey="Sector" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(value) => formatNumber(Number(value))} />
                    <Tooltip 
                      formatter={(value: any) => [formatNumber(Number(value)), 'Pallets']}
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151', 
                        borderRadius: '6px' 
                      }}
                      labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                      itemStyle={{ color: '#f3f4f6' }}
                      cursor={false}
                    />
                    <Bar 
                      dataKey="Pallets" 
                      fill="#3b82f6"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pallets por Sección */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Pallets por Sección
                  </h2>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={filteredPalletsPorSeccion} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(value) => formatNumber(Number(value))} />
                    <YAxis
                      type="category"
                      dataKey="Seccion"
                      width={140}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatNumber(Number(value)), 'Pallets']}
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151', 
                        borderRadius: '6px' 
                      }}
                      labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                      itemStyle={{ color: '#f3f4f6' }}
                      cursor={false}
                    />
                    <Bar 
                      dataKey="Pallets" 
                      fill="#10b981"
                      radius={[0, 2, 2, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribución de Contenedores en Canales */}
            {data.graficos.contenedoresPorCanal && data.graficos.contenedoresPorCanal.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Distribución de Contenedores en Canales
                  </h2>
                </div>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.graficos.contenedoresPorCanal
                          .filter(item => item.TipoCanal !== "Sin canal")
                          .map(item => ({
                          ...item,
                          cantidad: item.Contenedores,
                          color: `hsl(${Math.random() * 360}, 70%, 50%)`
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ TipoCanal, percent }: any) => `${TipoCanal}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="cantidad"
                      >
                        {data.graficos.contenedoresPorCanal
                          .filter(item => item.TipoCanal !== "Sin canal")
                          .map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={`hsl(${index * 36}, 70%, 50%)`} stroke="#fff" strokeWidth={1} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [formatNumber(Number(value)), 'Contenedores']}
                        contentStyle={{ 
                          backgroundColor: '#1f2937', 
                          border: '1px solid #374151', 
                          borderRadius: '6px' 
                        }}
                        labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                        itemStyle={{ color: '#f3f4f6' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Etiquetas de texto en esquina superior derecha */}
                  <div className="absolute top-0 right-0 space-y-1 max-w-xs">
                    {data.graficos.contenedoresPorCanal
                      .filter(item => item.TipoCanal !== "Sin canal")
                      .sort((a, b) => b.Contenedores - a.Contenedores)
                      .map((item, index) => {
                        const total = data.graficos.contenedoresPorCanal
                          .filter(c => c.TipoCanal !== "Sin canal")
                          .reduce((sum, c) => sum + c.Contenedores, 0);
                        const percentage = ((item.Contenedores / total) * 100).toFixed(1);
                        return (
                          <div key={index} className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            <span className="font-medium">{item.TipoCanal}</span>
                            {" -> "}
                            <span>{formatNumber(item.Contenedores)} Cont</span>
                            {" -> "}
                            <span>{percentage}%</span>
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
