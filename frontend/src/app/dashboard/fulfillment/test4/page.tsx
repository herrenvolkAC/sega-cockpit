"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export default function Test4FulfillmentPage() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // useCallback para la función de consulta real
  const handleConsulta = useCallback(async () => {
    if (!fechaInicio || !fechaFin) {
      alert('Por favor seleccione un rango de fechas');
      return;
    }

    console.log('Iniciando consulta API con fechas:', { fechaInicio, fechaFin });
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
      
      console.log('Haciendo llamada a:', `/api/fulfillment?${params}`);
      
      const response = await fetch(`/api/fulfillment?${params}`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Datos recibidos:', result);
      
      if (result.error) {
        throw new Error(result.error.message || 'Error en la respuesta del servidor');
      }
      
      setData(result);
      console.log('Datos cargados exitosamente');
    } catch (error) {
      console.error('Error en consulta API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMessage);
      alert(`Error al consultar datos: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  // useCallback para consulta simulada (fallback)
  const handleConsultaSimulada = useCallback(async () => {
    if (!fechaInicio || !fechaFin) {
      alert('Por favor seleccione un rango de fechas');
      return;
    }

    console.log('Iniciando consulta simulada con fechas:', { fechaInicio, fechaFin });
    setLoading(true);
    setError(null);
    
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
      console.log('Datos simulados cargados:', mockData);
    } catch (error) {
      console.error('Error en consulta simulada:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(errorMessage);
      alert(`Error en consulta simulada: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  // useMemo para KPIs
  const kpiCards = useMemo(() => {
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
        FullFillment - Versión Test 4 (API Real)
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
            {loading ? 'Consultando API...' : 'Consultar API Real'}
          </button>
          
          <button 
            onClick={handleConsultaSimulada}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Consultando...' : 'Consulta Simulada'}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error:</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        )}
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

          {/* Información de la API */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Información de la Respuesta
            </h2>
            
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p><strong>Base de datos:</strong> {data.databaseName || 'N/A'}</p>
              <p><strong>Generado:</strong> {data.generatedAt ? new Date(data.generatedAt).toLocaleString('es-AR') : 'N/A'}</p>
              <p><strong>Total Pedidos:</strong> {data.totalPedidos || 0}</p>
              <p><strong>Total Solicitado:</strong> {data.totalSolicitado || 0}</p>
              <p><strong>Total Faltantes:</strong> {data.totalFaltantes || 0}</p>
              <p><strong>Tasa Satisfacción:</strong> {data.tasaSatisfaccion || 0}%</p>
            </div>
            
            {/* Datos crudos para debugging */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                Ver datos crudos (JSON)
              </summary>
              <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
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
            <span className="text-green-600 dark:text-green-400 text-sm">Versión test 4 activa</span>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-blue-800 dark:text-blue-200 font-medium">🌐 Llamadas API</span>
            <span className="text-blue-600 dark:text-blue-400 text-sm">Listas para probar</span>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <span className="text-yellow-800 dark:text-yellow-200 font-medium">🔍 Debugging</span>
            <span className="text-yellow-600 dark:text-yellow-400 text-sm">Console logs activos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
