"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Tipos para los datos de recepciones
type RecepcionesData = {
  databaseName: string;
  fechaInicio: string;
  fechaFin: string;
  filtros: {
    proveedor: string;
    sku: string;
  };
  // Datos para gráficos
  ulsPorDia: Array<{
    fecha: string;
    dia: string;
    uls: number;
  }>;
  cajasPorDia: Array<{
    fecha: string;
    dia: string;
    cajas: number;
  }>;
  tiempoRecepcionPorDia: Array<{
    fecha: string;
    dia: string;
    tiempo_promedio_horas: number;
  }>;
  tiempoCamionPorDia: Array<{
    fecha: string;
    dia: string;
    tiempo_promedio_horas: number;
  }>;
  recepcionesPorSeccion: Array<{
    sector: string;
    uls: number;
    porcentaje: number;
  }>;
  // KPIs
  kpis: {
    totalUls: number;
    totalCajas: number;
    totalDias: number;
    tiempoPromedioRecepcion: number;
    totalSecciones: number;
  };
  generatedAt: string;
};

export default function RecepcionesPage() {
  const [data, setData] = useState<RecepcionesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [sku, setSku] = useState('');

  // Fetch data from API con filtros de fecha, proveedor y SKU
  const fetchRecepcionesData = useCallback(
    async () => {
      console.log('fetchRecepcionesData called with:', { fechaInicio, fechaFin, proveedor, sku });
      
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
        
        // Agregar proveedor solo si tiene un valor
        if (proveedor.trim()) {
          params.append('proveedor', proveedor.trim());
        }
        
        // Agregar SKU solo si tiene un valor
        if (sku.trim()) {
          params.append('sku', sku.trim());
        }
        
        const url = `/api/recepciones?${params}`;
        console.log('Requesting URL:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (!result.ok) {
          throw new Error(result.error?.message || 'Error desconocido');
        }
        
        setData(result.data);
      } catch (error) {
        console.error('Error fetching recepciones data:', error);
        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [fechaInicio, fechaFin, proveedor, sku]
  );

  // Cargar datos iniciales (últimos 30 días por defecto)
  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();
    
    setFechaInicio(thirtyDaysAgo.toISOString().split('T')[0]);
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
        title: "Total ULs",
        value: formatNumber(data.kpis.totalUls),
        icon: "🏗️",
        color: "blue" as const
      },
      {
        title: "Total Cajas",
        value: formatNumber(data.kpis.totalCajas),
        icon: "�",
        color: "green" as const
      },
      {
        title: "Días con Recepción",
        value: formatNumber(data.kpis.totalDias),
        icon: "�",
        color: "orange" as const
      },
      {
        title: "Tiempo Promedio",
        value: `${data.kpis.tiempoPromedioRecepcion.toFixed(1)}h`,
        icon: "⏱️",
        color: "purple" as const
      },
      {
        title: "Secciones",
        value: formatNumber(data.kpis.totalSecciones),
        icon: "�",
        color: "red" as const
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
          Recepciones - Macromercado
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Panel de control de recepciones de mercancía
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
                {data.kpis.totalUls.toLocaleString('es-AR')} ULs
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
              Proveedor (Opcional)
            </label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Dejar vacío para todos los proveedores"
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
              onChange={(e) => setSku(e.target.value)}
              placeholder="Dejar vacío para todos los SKUs"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={fetchRecepcionesData}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Cargando...' : 'Filtrar'}
            </button>
            <button
              onClick={() => {
                setFechaInicio('');
                setFechaFin('');
                setProveedor('');
                setSku('');
                setData(null);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>
      
      {/* Empty State */}
      {data && data.kpis.totalDias === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 mb-8 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            No hay datos en este rango
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 mb-6">
            No se encontraron registros de recepciones para el período seleccionado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700 dark:text-yellow-300">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">💡 Sugerencias:</h4>
              <ul className="space-y-1 text-left">
                <li>• Prueba fechas de 2024 o 2025</li>
                <li>• Usa rangos más amplios (30+ días)</li>
                <li>• Verifica fechas de fin de mes</li>
                <li>• Prueba períodos de alta actividad</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">📅 Rangos recomendados:</h4>
              <div className="space-y-2 text-left">
                <button 
                  onClick={() => {
                    const lastMonth = new Date();
                    lastMonth.setMonth(lastMonth.getMonth() - 1);
                    const start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
                    const end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
                    setFechaInicio(start.toISOString().split('T')[0]);
                    setFechaFin(end.toISOString().split('T')[0]);
                  }}
                  className="w-full text-left px-3 py-2 bg-yellow-100 dark:bg-yellow-800 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
                >
                  📅 Mes pasado
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
      {data && data.kpis.totalDias > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
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

      {/* Charts - 5 Reportes */}
      {data && data.kpis.totalDias > 0 && (
        <>
          {/* Grid 2x2 para los 4 gráficos de líneas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* 1. ULs Recepcionadas por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                🏗️ ULs Recepcionadas por Día
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.ulsPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(Number(value))} />
                  <Tooltip 
                    formatter={(value: any) => [formatNumber(Number(value)), 'ULs']}
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                    labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="uls" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 1, r: 3 }}
                    activeDot={{ r: 5 }}
                    name="ULs Recepcionadas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 2. Cajas Recepcionadas por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                📦 Cajas Recepcionadas por Día
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.cajasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatNumber(Number(value))} />
                  <Tooltip 
                    formatter={(value: any) => [formatNumber(Number(value)), 'Cajas']}
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                    labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="cajas" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 1, r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Cajas Recepcionadas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Tiempo Medio de Recepción por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                ⏱️ Tiempo Medio de Recepción (Horas)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.tiempoRecepcionPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value.toFixed(1)}h`} />
                  <Tooltip 
                    formatter={(value: any) => [`${Number(value).toFixed(1)}h`, 'Tiempo Promedio']}
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                    labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="tiempo_promedio_horas" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', strokeWidth: 1, r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Tiempo Promedio (h)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 4. Tiempo Medio de Estada de Camión por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                🚛 Tiempo Medio de Estada de Camión (Horas)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.tiempoCamionPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value.toFixed(1)}h`} />
                  <Tooltip 
                    formatter={(value: any) => [`${Number(value).toFixed(1)}h`, 'Tiempo Promedio Camión']}
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                    labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="tiempo_promedio_horas" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', strokeWidth: 1, r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Tiempo Promedio Camión (h)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

          </div>

          {/* 5. Recepciones por Sector (Torta) - Ancho completo */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              🥧 Recepciones por Sector (Participación de ULs)
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={data.recepcionesPorSeccion}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ sector, porcentaje }: any) => `${sector}: ${porcentaje.toFixed(1)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="uls"
                >
                  {data.recepcionesPorSeccion.map((entry, index) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Pie>
                <Tooltip 
                  formatter={(value: any, name: any) => [formatNumber(Number(value)), 'ULs']}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                  labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                  itemStyle={{ color: '#f3f4f6' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </main>
  );
}
