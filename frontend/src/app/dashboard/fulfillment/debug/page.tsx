"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Componentes simplificados pero más cercanos al original
function DebugDashboardLayout({ 
  title, 
  subtitle, 
  children 
}: { 
  title: string; 
  subtitle: string; 
  children: React.ReactNode; 
}) {
  console.log('🏗️ DebugDashboardLayout render');
  return (
    <main className="p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
      </header>
      {children}
    </main>
  );
}

function DebugDateRangeFilter({ 
  fechaInicio, 
  fechaFin, 
  onFechaInicioChange, 
  onFechaFinChange, 
  onApply, 
  loading 
}: {
  fechaInicio: string;
  fechaFin: string;
  onFechaInicioChange: (value: string) => void;
  onFechaFinChange: (value: string) => void;
  onApply: () => void;
  loading: boolean;
}) {
  console.log('📅 DebugDateRangeFilter render', { fechaInicio, fechaFin, loading });
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Filtro de Fechas
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fecha Inicio
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => {
              console.log('📅 Fecha inicio cambiada:', e.target.value);
              onFechaInicioChange(e.target.value);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fecha Fin
          </label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => {
              console.log('📅 Fecha fin cambiada:', e.target.value);
              onFechaFinChange(e.target.value);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
      
      <div className="flex gap-4">
        <button 
          onClick={() => {
            console.log('🔍 Botón aplicar filtro clickeado');
            onApply();
          }}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Consultando...' : 'Aplicar Filtro'}
        </button>
      </div>
    </div>
  );
}

export default function DebugFulfillmentPage() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderCount, setRenderCount] = useState(0);

  // Contador de renders para detectar bucles infinitos
  useEffect(() => {
    setRenderCount(prev => prev + 1);
    console.log(`🔄 DebugFulfillmentPage render #${renderCount + 1}`);
  });

  // useEffect para montaje
  useEffect(() => {
    console.log('🚀 Componente montado');
    setMounted(true);
    
    // Establecer fechas por defecto
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const today = new Date();
    
    const inicio = ninetyDaysAgo.toISOString().split('T')[0];
    const fin = today.toISOString().split('T')[0];
    
    console.log('📅 Estableciendo fechas por defecto:', { inicio, fin });
    
    setFechaInicio(inicio);
    setFechaFin(fin);
  }, []);

  // useEffect para cambios de fechas (similar al original)
  useEffect(() => {
    console.log('🔄 useEffect de fechas disparado', { fechaInicio, fechaFin, mounted });
    
    // Comentado para evitar auto-fetch
    // if (mounted && fechaInicio && fechaFin) {
    //   console.log('🔄 Auto-fetch por cambio de fechas');
    //   fetchFulfillmentData();
    // }
  }, [fechaInicio, fechaFin, mounted]);

  // useCallback para la función de consulta (similar al original)
  const fetchFulfillmentData = useCallback(async () => {
    console.log('🌐 Iniciando fetchFulfillmentData');
    
    if (!fechaInicio || !fechaFin) {
      console.log('❌ Fechas no válidas');
      alert('Por favor seleccione un rango de fechas');
      return;
    }

    console.log('🌐 Iniciando consulta API con fechas:', { fechaInicio, fechaFin });
    setLoading(true);
    setError(null);
    
    try {
      // Convertir fechas al formato que espera el backend
      const convertToBackendFormat = (dateStr: string): string => {
        return dateStr.replace(/-/g, ''); // YYYY-MM-DD -> YYYYMMDD
      };
      
      const params = new URLSearchParams();
      params.append('fechaInicio', convertToBackendFormat(fechaInicio));
      params.append('fechaFin', convertToBackendFormat(fechaFin));
      
      console.log('🌐 Haciendo llamada a:', `/api/fulfillment?${params}`);
      
      const response = await fetch(`/api/fulfillment?${params}`);
      console.log('🌐 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('🌐 Datos recibidos:', result);
      
      if (result.error) {
        throw new Error(result.error.message || 'Error en la respuesta del servidor');
      }
      
      setData(result);
      console.log('✅ Datos cargados exitosamente');
    } catch (error) {
      console.error('❌ Error en consulta API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMessage);
      alert(`Error al consultar datos: ${errorMessage}`);
    } finally {
      setLoading(false);
      console.log('🌐 fetchFulfillmentData finalizado');
    }
  }, [fechaInicio, fechaFin]);

  // Debounce function (similar al original)
  const debounce = (func: Function, delay: number) => {
    console.log('⏱️ Creando debounce function');
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      console.log('⏱️ Debounce llamado');
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('⏱️ Ejecutando función debounced');
        func.apply(null, args);
      }, delay);
    };
  };

  // Debounced version (similar al original)
  const debouncedFetchFulfillmentData = useCallback(
    debounce(fetchFulfillmentData, 1000),
    [fetchFulfillmentData]
  );

  // useMemo para KPIs
  const kpiCards = useMemo(() => {
    console.log('📊 Calculando KPIs');
    if (!data) return [];
    
    return [
      {
        title: "Total Pedidos",
        value: data.totalPedidos?.toLocaleString('es-AR') || '0',
        icon: "📦",
        color: "blue" as const
      },
      {
        title: "Total Solicitado",
        value: data.totalSolicitado?.toLocaleString('es-AR') || '0',
        icon: "📋",
        color: "green" as const
      },
      {
        title: "Total Faltantes",
        value: data.totalFaltantes?.toLocaleString('es-AR') || '0',
        icon: "⚠️",
        color: "red" as const
      },
      {
        title: "Tasa Satisfacción",
        value: `${data.tasaSatisfaccion || 0}%`,
        icon: "✅",
        color: "purple" as const
      }
    ];
  }, [data]);

  if (!mounted) {
    console.log('🔄 Mostrando loading state');
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  console.log('🔄 Renderizando componente principal');

  return (
    <DebugDashboardLayout
      title="FullFillment - Versión Debug"
      subtitle="Panel de control con logging detallado"
    >
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">🔍 Debug Info:</h3>
        <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 space-y-1">
          <p>Render count: {renderCount}</p>
          <p>Mounted: {mounted ? '✅' : '❌'}</p>
          <p>Loading: {loading ? '✅' : '❌'}</p>
          <p>Fecha Inicio: {fechaInicio || 'N/A'}</p>
          <p>Fecha Fin: {fechaFin || 'N/A'}</p>
          <p>Data: {data ? '✅' : '❌'}</p>
          <p>Error: {error ? '✅' : '❌'}</p>
        </div>
      </div>
      
      <DebugDateRangeFilter
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        onFechaInicioChange={setFechaInicio}
        onFechaFinChange={setFechaFin}
        onApply={fetchFulfillmentData}
        loading={loading}
      />
      
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => {
            console.log('🔍 Botón consultar API real clickeado');
            fetchFulfillmentData();
          }}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Consultando API...' : 'Consultar API Real'}
        </button>
        
        <button 
          onClick={() => {
            console.log('🔍 Botón consulta simulada clickeado');
            // Simular datos
            const mockData = {
              databaseName: "macromercado",
              generatedAt: new Date().toISOString(),
              totalPedidos: 1234,
              totalSolicitado: 5678,
              totalFaltantes: 90,
              tasaSatisfaccion: 98.4,
              pedidosPorDia: [
                { date: '2024-01-01', pedidos: 45, faltantes: 5 },
                { date: '2024-01-02', pedidos: 52, faltantes: 3 },
                { date: '2024-01-03', pedidos: 38, faltantes: 7 },
              ],
              estadoFulfillment: [
                { name: 'Completado', value: 85, color: '#10b981' },
                { name: 'Parcial', value: 12, color: '#f59e0b' },
                { name: 'Pendiente', value: 3, color: '#ef4444' },
              ],
              productosConShortage: [
                { name: 'Producto A', shortage: 15 },
                { name: 'Producto B', shortage: 12 },
                { name: 'Producto C', shortage: 8 },
              ]
            };
            setData(mockData);
          }}
          disabled={loading}
          className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Consultando...' : 'Consulta Simulada'}
        </button>
        
        <button 
          onClick={() => {
            console.log('🔍 Botón debounce clickeado');
            debouncedFetchFulfillmentData();
          }}
          disabled={loading}
          className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Consultando...' : 'Consulta con Debounce'}
        </button>
      </div>
      
      {error && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error:</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        </div>
      )}
      
      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {kpiCards.map((kpi, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{kpi.title}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
                  </div>
                  <div className="text-2xl">{kpi.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Gráficos simplificados */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Datos Simplificados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Pedidos por Día</h3>
                <div className="space-y-1">
                  {data.pedidosPorDia?.map((item: any, index: number) => (
                    <div key={index} className="text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      {item.date}: {item.pedidos} pedidos, {item.faltantes} faltantes
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Estado de Fulfillment</h3>
                <div className="space-y-1">
                  {data.estadoFulfillment?.map((item: any, index: number) => (
                    <div key={index} className="text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      {item.name}: {item.value}%
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </DebugDashboardLayout>
  );
}
