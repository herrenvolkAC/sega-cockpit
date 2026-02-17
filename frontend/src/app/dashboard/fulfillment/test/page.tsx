"use client";

import { useState } from "react";

export default function TestFulfillmentPage() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const handleConsulta = async () => {
    if (!fechaInicio || !fechaFin) {
      alert('Por favor seleccione un rango de fechas');
      return;
    }

    setLoading(true);
    try {
      // Simular llamada API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de prueba
      setData({
        databaseName: "macromercado",
        generatedAt: new Date().toISOString(),
        totalPedidos: 1234,
        totalSolicitado: 5678,
        totalFaltantes: 90,
        tasaSatisfaccion: 98.4
      });
    } catch (error) {
      alert('Error al consultar datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        FullFillment - Versión Test
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
        
        <button 
          onClick={handleConsulta}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Consultando...' : 'Consultar Datos'}
        </button>
      </div>
      
      {data && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Resultados de la Consulta
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Pedidos</div>
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{data.totalPedidos}</div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-sm text-green-600 dark:text-green-400">Total Solicitado</div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">{data.totalSolicitado}</div>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="text-sm text-red-600 dark:text-red-400">Total Faltantes</div>
              <div className="text-2xl font-bold text-red-800 dark:text-red-200">{data.totalFaltantes}</div>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="text-sm text-purple-600 dark:text-purple-400">Tasa Satisfacción</div>
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">{data.tasaSatisfaccion}%</div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>Base de datos: {data.databaseName}</p>
            <p>Generado: {new Date(data.generatedAt).toLocaleString('es-AR')}</p>
          </div>
        </div>
      )}
      
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Estado del Sistema
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <span className="text-green-800 dark:text-green-200 font-medium">✅ Frontend funcionando</span>
            <span className="text-green-600 dark:text-green-400 text-sm">Versión test activa</span>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-blue-800 dark:text-blue-200 font-medium">🔗 Estado de componentes</span>
            <span className="text-blue-600 dark:text-blue-400 text-sm">Funcionando</span>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <span className="text-yellow-800 dark:text-yellow-200 font-medium">📊 Datos simulados</span>
            <span className="text-yellow-600 dark:text-yellow-400 text-sm">Listos para probar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
