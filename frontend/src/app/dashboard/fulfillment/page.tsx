"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
    name: string;
    shortage: number;
  }>;
  generatedAt: string;
};

export default function FulfillmentPage() {
  const [data, setData] = useState<FulfillmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [sku, setSku] = useState(''); // Nuevo campo para SKU
  const skuRef = useRef(sku); // Ref para mantener el valor estable

  // Fetch data from API con filtros de fecha y SKU (debounced)
  const fetchFulfillmentData = useCallback(
    async () => {
      console.log('fetchFulfillmentData called with:', { fechaInicio, fechaFin, sku: skuRef.current });
      
      if (!fechaInicio || !fechaFin) {
        alert('Por favor seleccione un rango de fechas');
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
        
        const url = `/api/fulfillment?${params}`;
        console.log('Requesting URL:', url);
        
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
      } catch (error) {
        console.error('Error fetching fulfillment data:', error);
        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [fechaInicio, fechaFin, sku] // Agregar sku a las dependencias
  );

  // Debounced version to prevent rapid API calls
  const debouncedFetchFulfillmentData = useCallback(
    debounce(fetchFulfillmentData, 1000), // 1 second delay
    [fetchFulfillmentData]
  );

  // Cargar datos iniciales (últimos 90 días por defecto)
  useEffect(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const today = new Date();
    
    setFechaInicio(ninetyDaysAgo.toISOString().split('T')[0]);
    setFechaFin(today.toISOString().split('T')[0]);
  }, []);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("es-AR").format(num);
  };

  // KPI Cards
  const kpiCards = useMemo(() => {
    if (!data) return [];
    
    return [
      {
        title: "Total Pedidos",
        value: formatNumber(data.totalPedidos),
        icon: "📦",
        color: "blue" as const
      },
      {
        title: "Total Solicitado",
        value: formatNumber(data.totalSolicitado),
        icon: "📋",
        color: "green" as const
      },
      {
        title: "Total Faltantes",
        value: formatNumber(data.totalFaltantes),
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
    <main className="p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          FullFillment - Macromercado
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Panel de control de fulfillment
        </p>
      </header>

      {/* Database Info */}
      {data && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                🗄️ Base de Datos: {data.databaseName}
              </h4>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Última actualización: {new Date(data.generatedAt).toLocaleString('es-AR')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {data.totalPedidos.toLocaleString('es-AR')} pedidos
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                en el rango seleccionado
              </div>
            </div>
          </div>
        </div>
      )}

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
              SKU (Opcional)
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => {
                console.log('SKU input changed:', e.target.value);
                setSku(e.target.value);
                skuRef.current = e.target.value;
              }}
              placeholder="Dejar vacío para todos los SKUs"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={fetchFulfillmentData}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Cargando...' : 'Filtrar'}
            </button>
            <button
              onClick={() => {
                setFechaInicio('');
                setFechaFin('');
                setSku('');
                setData(null);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Limpiar
            </button>
            <button
              onClick={() => {
                // Simular datos para prueba
                const mockData: FulfillmentData = {
                  databaseName: "macromercado",
                  fechaInicio: fechaInicio,
                  fechaFin: fechaFin,
                  totalPedidos: 1234,
                  totalSolicitado: 5678,
                  totalFaltantes: 90,
                  tasaSatisfaccion: 98.4,
                  pedidosPorDia: [
                    { dia: '01/09', pedidos: 45, qty_solicitada: 1250, faltantes: 5, entregados: 1245, fulfillment_pct: 99.6 },
                    { dia: '02/09', pedidos: 52, qty_solicitada: 1680, faltantes: 3, entregados: 1677, fulfillment_pct: 99.8 },
                    { dia: '03/09', pedidos: 38, qty_solicitada: 980, faltantes: 7, entregados: 973, fulfillment_pct: 99.3 },
                  ],
                  estadoFulfillment: [
                    { name: 'Completado', value: 85, color: '#10b981' },
                    { name: 'Parcial', value: 12, color: '#f59e0b' },
                    { name: 'Pendiente', value: 3, color: '#ef4444' },
                  ],
                  productosConShortage: [
                    { name: 'OF. MAYONESA HELLMANN\'S LIGHT 1000...', shortage: 150 },
                    { name: 'MAYONESA HELLMANN\'S 1000 C.C. D.PACK', shortage: 120 },
                    { name: 'CREMA DENTAL COLGATE T12 C.M.90X2-25', shortage: 95 },
                    { name: 'POLENTA PURITAS 1 MINUTO 450 GRS.', shortage: 85 },
                    { name: 'ROTISERIA CANELONES DE CARNE * Venta', shortage: 75 },
                    { name: 'ALCOHOL SUANCES RECTI.70% CIT.SPRAY...', shortage: 65 },
                    { name: 'DULCE DE MEMBRILLO L.NIETITOS 0%AZU...', shortage: 55 },
                    { name: 'ROTISERIA NUGGET DE POLLO -KILO- * Venta', shortage: 45 },
                    { name: 'ROTISERIA PECHUGA POLLO A LA MILANESA KG', shortage: 35 },
                    { name: 'ALFAJOR TERRABUSI CLASICO X 6 300 GRS.', shortage: 25 },
                  ],
                  generatedAt: new Date().toISOString()
                };
                setData(mockData);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Cargando...' : 'Simular Datos'}
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
      )}

      {/* Charts */}
      {data && data.totalPedidos > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Line Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                Pedidos y Faltantes por Día
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.pedidosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="qty_solicitada" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Cantidad Solicitada"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="entregados" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Cantidad Entregada"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="faltantes" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Faltantes"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Estado de Fulfillment - Line Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                Porcentaje de Fulfillment por Día
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.pedidosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis 
                    domain={[0, 100]} 
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Fulfillment']}
                  />
                  <Legend />
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

          {/* Bar Chart - Vertical Optimized */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Top 20 Productos con más Faltantes
            </h2>
            <ResponsiveContainer width="100%" height={600}>
              <BarChart 
                data={data.productosConShortage}
                margin={{ top: 20, right: 30, left: 20, bottom: 150 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={150}
                  interval={0}
                  tick={{ fontSize: 9 }}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => [`${Number(value).toLocaleString('es-AR')}`, 'Faltantes']}
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                  itemStyle={{ color: '#f3f4f6' }}
                  cursor={{ fill: '#0891b2' }}
                />
                <Bar 
                  dataKey="shortage" 
                  fill="#0c4a6e" 
                  radius={[4, 4, 0, 0]}
                  activeBar={{ fill: "#075985", stroke: "#0c4a6e", strokeWidth: 2 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </main>
  );
}
