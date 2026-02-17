"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export default function Test3FulfillmentPage() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // useEffect para montaje
  useEffect(() => {
    console.log('Componente montado');
    setMounted(true);
    
    // Establecer fechas por defecto
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const today = new Date();
    
    setFechaInicio(ninetyDaysAgo.toISOString().split('T')[0]);
    setFechaFin(today.toISOString().split('T')[0]);
  }, []);

  // useCallback para la función de consulta
  const handleConsulta = useCallback(async () => {
    if (!fechaInicio || !fechaFin) {
      alert('Por favor seleccione un rango de fechas');
      return;
    }

    console.log('Iniciando consulta con fechas:', { fechaInicio, fechaFin });
    setLoading(true);
    
    try {
      // Simular llamada API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de prueba
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
      console.log('Datos cargados:', mockData);
    } catch (error) {
      console.error('Error en consulta:', error);
      alert('Error al consultar datos');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  // useMemo para datos procesados
  const kpiCards = useMemo(() => {
    if (!data) return [];
    
    return [
      {
        title: "Total Pedidos",
        value: data.totalPedidos.toLocaleString('es-AR'),
        icon: "📦",
        color: "blue" as const
      },
      {
        title: "Total Solicitado",
        value: data.totalSolicitado.toLocaleString('es-AR'),
        icon: "📋",
        color: "green" as const
      },
      {
        title: "Total Faltantes",
        value: data.totalFaltantes.toLocaleString('es-AR'),
        icon: "⚠️",
        color: "red" as const
      },
      {
        title: "Tasa Satisfacción",
        value: `${data.tasaSatisfaccion}%`,
        icon: "✅",
        color: "purple" as const
      }
    ];
  }, [data]);

  // useMemo para estadísticas
  const estadisticas = useMemo(() => {
    if (!data) return null;
    
    const totalPedidos = data.pedidosPorDia.reduce((sum: number, day: any) => sum + day.pedidos, 0);
    const totalFaltantes = data.pedidosPorDia.reduce((sum: number, day: any) => sum + day.faltantes, 0);
    const peorDia = data.pedidosPorDia.reduce((worst: any, day: any) => 
      day.faltantes > worst.faltantes ? day : worst, data.pedidosPorDia[0]);
    
    return {
      totalPedidos,
      totalFaltantes,
      peorDia,
      diasAnalizados: data.pedidosPorDia.length
    };
  }, [data]);

  // Debounce function para evitar llamadas rápidas
  const debouncedConsulta = useCallback(
    () => {
      const timeoutId = setTimeout(() => {
        handleConsulta();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    },
    [handleConsulta]
  );

  if (!mounted) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        FullFillment - Versión Test 3
      </h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Panel de Control
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
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
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={handleConsulta}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Consultando...' : 'Consultar Datos'}
          </button>
          
          <button 
            onClick={() => {
              const cleanup = debouncedConsulta();
              if (cleanup) cleanup();
            }}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Consultando...' : 'Consulta con Debounce'}
          </button>
        </div>
      </div>
      
      {data && (
        <>
          {/* KPI Cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* Estadísticas Procesadas */}
          {estadisticas && (
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                Estadísticas Procesadas
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-sm text-blue-600 dark:text-blue-400">Total Pedidos (Procesado)</div>
                  <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{estadisticas.totalPedidos}</div>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <div className="text-sm text-red-600 dark:text-red-400">Total Faltantes (Procesado)</div>
                  <div className="text-2xl font-bold text-red-800 dark:text-red-200">{estadisticas.totalFaltantes}</div>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">Peor Día</div>
                  <div className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                    {estadisticas.peorDia.date} ({estadisticas.peorDia.faltantes} faltantes)
                  </div>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <p>Días analizados: {estadisticas.diasAnalizados}</p>
                <p>Base de datos: {data.databaseName}</p>
                <p>Generado: {new Date(data.generatedAt).toLocaleString('es-AR')}</p>
              </div>
            </div>
          )}

          {/* Datos de Prueba (Gráficos) */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Datos de Prueba (Gráficos)
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Pedidos por Día</h3>
                <div className="space-y-2">
                  {data.pedidosPorDia.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{item.date}</span>
                      <div className="flex gap-4">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{item.pedidos} pedidos</span>
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">{item.faltantes} faltantes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Estado de Fulfillment</h3>
                <div className="space-y-2">
                  {data.estadoFulfillment.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                      <span className="text-sm font-medium" style={{ color: item.color }}>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Estado del Sistema
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <span className="text-green-800 dark:text-green-200 font-medium">✅ Frontend funcionando</span>
            <span className="text-green-600 dark:text-green-400 text-sm">Versión test 3 activa</span>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-blue-800 dark:text-blue-200 font-medium">🔄 Hooks avanzados funcionando</span>
            <span className="text-blue-600 dark:text-blue-400 text-sm">useCallback y useMemo OK</span>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <span className="text-purple-800 dark:text-purple-200 font-medium">🧠 Datos procesados</span>
            <span className="text-purple-600 dark:text-purple-400 text-sm">Memoización activa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
