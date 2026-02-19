"use client";

import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Tipos de datos
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
  operarios: number;
  horas_promedio_por_operario: number;
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

interface ProductivityData {
  from: string;
  to: string;
  operacion: string;
  daily: DailyData[];
  cards: CardsData;
  perOperator: PerOperatorData[];
  dailyPerOperator: DailyPerOperatorData[];
  dailyDetailGrid: DailyDetailGridData[];
}

export default function ProductivityPage() {
  const [data, setData] = useState<ProductivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Debug: Log inicial
  console.log('ProductivityPage mounted');

  // Fetch data from API
  const fetchProductivityData = useCallback(async () => {
    console.log('fetchProductivityData called', { fechaInicio, fechaFin });
    
    if (!fechaInicio || !fechaFin) {
      alert('Por favor seleccione un rango de fechas');
      return;
    }

    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      params.append('operacion', 'PICKING');
      params.append('from', fechaInicio);
      params.append('to', fechaFin);
      
      const url = `/api/productividad?${params}`;
      console.log('Requesting URL:', url);
      
      const response = await fetch(url);
      const result = await response.json();
      
      console.log('=== FRONTEND API RESPONSE ===');
      console.log('Raw response:', result);
      console.log('Response structure:', {
        hasDaily: !!result.daily,
        dailyLength: result.daily?.length,
        hasCards: !!result.cards,
        hasPerOperator: !!result.perOperator,
        perOperatorLength: result.perOperator?.length
      });
      
      if (!response.ok) {
        throw new Error(result.error?.message || 'Error desconocido');
      }
      
      setData(result);
    } catch (error) {
      console.error('Error fetching productivity data:', error);
      alert('Error al cargar datos de productividad: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    console.log('useEffect running');
    // Establecer fechas por defecto (últimos 7 días)
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const inicioStr = today.toISOString().split('T')[0];
    const finStr = sevenDaysAgo.toISOString().split('T')[0];
    
    console.log('Setting default dates:', { inicioStr, finStr });
    
    setFechaFin(inicioStr);
    setFechaInicio(finStr);
  }, []);

  const handleLimpiar = () => {
    console.log('handleLimpiar called');
    setFechaInicio('');
    setFechaFin('');
    setData(null);
  };

  console.log('Current state:', { data, loading, fechaInicio, fechaFin });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Productividad - Macromercado
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Panel de control de productividad de operaciones PICKING
        </p>
      </header>

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
              onChange={(e) => {
                console.log('Fecha inicio changed:', e.target.value);
                setFechaInicio(e.target.value);
              }}
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
          <div className="flex gap-2 mt-6">
            <button
              onClick={fetchProductivityData}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Cargando...' : 'Filtrar'}
            </button>
            <button
              onClick={() => {
                setFechaInicio('');
                setFechaFin('');
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

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Cajas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.cards.cajas.toLocaleString('es-AR')}
                </p>
              </div>
              <div className="text-2xl">📦</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Unidades</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.cards.unidades_uom.toLocaleString('es-AR')}
                </p>
              </div>
              <div className="text-2xl">📋</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Operarios</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.cards.operarios.toLocaleString('es-AR')}
                </p>
              </div>
              <div className="text-2xl">👥</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Horas Promedio</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.cards.horas_promedio_por_operario.toFixed(1)}
                </p>
              </div>
              <div className="text-2xl">⏱️</div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Productividad Diaria Media */}
      {data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Productividad Media Diaria (Unidades/Hora)
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="fecha_operativa" 
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                }}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('es-AR')}
                formatter={(value, name) => [
                  `${value} unidades/hora`,
                  'Productividad Media'
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="uni_x_h" 
                stroke="#10b981" 
                name="Productividad Media (Unidades/Hora)"
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfico de Productividad por Operario */}
      {data && data.dailyPerOperator && data.dailyPerOperator.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Productividad Diaria por Operario (Unidades/Hora)
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart 
              data={(() => {
                // Agrupar datos por fecha y crear un objeto con cada operario como columna
                const groupedData: { [key: string]: any } = {};
                
                data.dailyPerOperator.forEach(item => {
                  const fecha = item.fecha_operativa;
                  if (!groupedData[fecha]) {
                    groupedData[fecha] = { fecha_operativa: fecha };
                  }
                  groupedData[fecha][`operario_${item.usuario_id}`] = item.uni_x_h;
                  groupedData[fecha][`operario_${item.usuario_id}_name`] = item.operario;
                });
                
                // Convertir a array y ordenar por fecha
                return Object.values(groupedData).sort((a, b) => 
                  new Date(a.fecha_operativa).getTime() - new Date(b.fecha_operativa).getTime()
                );
              })()}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="fecha_operativa" 
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                }}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => value ? new Date(value).toLocaleDateString('es-AR') : ''}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-2 border border-gray-300 rounded shadow">
                        <p className="font-semibold">{label ? new Date(label).toLocaleDateString('es-AR') : ''}</p>
                        {payload.map((entry, index) => (
                          <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {entry.value?.toFixed(1)} unidades/hora
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              {/* Crear líneas dinámicas para cada operario */}
              {(() => {
                const operadoresUnicos = Array.from(new Set(data.dailyPerOperator.map(d => d.usuario_id)));
                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
                
                return operadoresUnicos.map((usuarioId, index) => {
                  const operarioData = data.dailyPerOperator.find(d => d.usuario_id === usuarioId);
                  const operarioName = operarioData?.operario || `Operario ${usuarioId}`;
                  const color = colors[index % colors.length];
                  
                  return (
                    <Line
                      key={usuarioId}
                      type="monotone"
                      dataKey={`operario_${usuarioId}`}
                      stroke={color}
                      name={operarioName}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  );
                });
              })()}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grilla Detallada de Productividad por Operario y Día */}
      {data && data.dailyDetailGrid && data.dailyDetailGrid.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Detalle de Productividad por Operario y Día
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Operario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Legajo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Bultos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Minutos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Productividad (Unidades/Hora)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.dailyDetailGrid.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {new Date(row.fecha_operativa).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {row.operario}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {row.legajo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {row.bultos.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {row.minutos.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.productividad > 50 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : row.productividad > 30
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {row.productividad.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
