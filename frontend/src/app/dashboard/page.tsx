"use client";

import { useState, useEffect } from "react";
import { BasicThemeToggle } from "@/components/BasicThemeToggle";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Tipos para los datos del dashboard
type DashboardData = {
  totalVentas: number;
  totalPedidos: number;
  pedidosPendientes: number;
  pedidosCompletados: number;
  tiempoPromedioEntrega: number;
  tasaCancelacion: number;
  ventasPorDia: Array<{
    dia: string;
    ventas: number;
    pedidos: number;
  }>;
  pedidosPorEstado: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  categoriasVentas: Array<{
    categoria: string;
    monto: number;
    porcentaje: number;
  }>;
  productosTop: Array<{
    nombre: string;
    cantidad: number;
    porcentaje: number;
  }>;
  pedidosRecientes: Array<{
    id: string;
    cliente: string;
    monto: number;
    estado: "pendiente" | "en_progreso" | "completado" | "cancelado";
    fecha: string;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Generar datos random iniciales
  const generateRandomData = (): DashboardData => {
    const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const hoy = new Date();
    
    return {
      totalVentas: Math.floor(Math.random() * 500000) + 100000,
      totalPedidos: Math.floor(Math.random() * 500) + 100,
      pedidosPendientes: Math.floor(Math.random() * 50) + 5,
      pedidosCompletados: Math.floor(Math.random() * 400) + 50,
      tiempoPromedioEntrega: Math.floor(Math.random() * 30) + 15,
      tasaCancelacion: Math.random() * 10 + 2,
      
      // Datos para gráfico de líneas - Ventas por día
      ventasPorDia: dias.map((dia, index) => ({
        dia,
        ventas: Math.floor(Math.random() * 80000) + 20000,
        pedidos: Math.floor(Math.random() * 80) + 20,
      })),
      
      // Datos para gráfico de pie - Pedidos por estado
      pedidosPorEstado: [
        { name: "Completados", value: Math.floor(Math.random() * 300) + 200, color: "#10b981" },
        { name: "En Progreso", value: Math.floor(Math.random() * 50) + 20, color: "#3b82f6" },
        { name: "Pendientes", value: Math.floor(Math.random() * 40) + 10, color: "#f59e0b" },
        { name: "Cancelados", value: Math.floor(Math.random() * 30) + 5, color: "#ef4444" },
      ],
      
      // Datos para gráfico de barras - Categorías de ventas
      categoriasVentas: [
        { categoria: "Comidas", monto: Math.floor(Math.random() * 150000) + 50000, porcentaje: Math.random() * 30 + 25 },
        { categoria: "Bebidas", monto: Math.floor(Math.random() * 80000) + 20000, porcentaje: Math.random() * 20 + 15 },
        { categoria: "Postres", monto: Math.floor(Math.random() * 60000) + 15000, porcentaje: Math.random() * 15 + 10 },
        { categoria: "Snacks", monto: Math.floor(Math.random() * 40000) + 10000, porcentaje: Math.random() * 10 + 8 },
        { categoria: "Otros", monto: Math.floor(Math.random() * 30000) + 8000, porcentaje: Math.random() * 8 + 5 },
      ],
      
      productosTop: [
        { nombre: "Hamburguesa Clásica", cantidad: Math.floor(Math.random() * 100) + 50, porcentaje: Math.random() * 20 + 15 },
        { nombre: "Pizza Margarita", cantidad: Math.floor(Math.random() * 80) + 40, porcentaje: Math.random() * 15 + 10 },
        { nombre: "Ensalada César", cantidad: Math.floor(Math.random() * 60) + 30, porcentaje: Math.random() * 10 + 8 },
        { nombre: "Lomo Completo", cantidad: Math.floor(Math.random() * 70) + 35, porcentaje: Math.random() * 12 + 9 },
        { nombre: "Papas Fritas", cantidad: Math.floor(Math.random() * 90) + 45, porcentaje: Math.random() * 18 + 12 },
      ].sort((a, b) => b.cantidad - a.cantidad),
      
      pedidosRecientes: [
        {
          id: `#${Math.floor(Math.random() * 9000) + 1000}`,
          cliente: ["Juan Pérez", "María García", "Carlos López", "Ana Martínez", "Roberto Díaz"][Math.floor(Math.random() * 5)],
          monto: Math.floor(Math.random() * 5000) + 500,
          estado: ["pendiente", "en_progreso", "completado", "cancelado"][Math.floor(Math.random() * 4)] as any,
          fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleString(),
        },
        {
          id: `#${Math.floor(Math.random() * 9000) + 1000}`,
          cliente: ["Laura Sánchez", "Pedro Ramírez", "Sofía Torres", "Miguel Ángel", "Carolina Vargas"][Math.floor(Math.random() * 5)],
          monto: Math.floor(Math.random() * 5000) + 500,
          estado: ["pendiente", "en_progreso", "completado", "cancelado"][Math.floor(Math.random() * 4)] as any,
          fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleString(),
        },
        {
          id: `#${Math.floor(Math.random() * 9000) + 1000}`,
          cliente: ["Diego Herrera", "Patricia Morales", "Javier Castro", "Rosa Flores", "Alberto Nuñez"][Math.floor(Math.random() * 5)],
          monto: Math.floor(Math.random() * 5000) + 500,
          estado: ["pendiente", "en_progreso", "completado", "cancelado"][Math.floor(Math.random() * 4)] as any,
          fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleString(),
        },
        {
          id: `#${Math.floor(Math.random() * 9000) + 1000}`,
          cliente: ["Elena Ruiz", "Francisco Jiménez", "Carmen Ortiz", "Luis Silva", "Mónica Ríos"][Math.floor(Math.random() * 5)],
          monto: Math.floor(Math.random() * 5000) + 500,
          estado: ["pendiente", "en_progreso", "completado", "cancelado"][Math.floor(Math.random() * 4)] as any,
          fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleString(),
        },
      ],
    };
  };

  useEffect(() => {
    // Simular carga inicial
    setTimeout(() => {
      setData(generateRandomData());
      setLoading(false);
    }, 1000);

    // SIN AUTO-REFRESH - Solo carga inicial
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount);
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "en_progreso":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "completado":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "cancelado":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusText = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return "Pendiente";
      case "en_progreso":
        return "En Progreso";
      case "completado":
        return "Completado";
      case "cancelado":
        return "Cancelado";
      default:
        return estado;
    }
  };

  if (loading) {
    return (
      <main className="p-6 text-gray-800 dark:text-gray-100">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg">Cargando dashboard...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="p-6 text-gray-800 dark:text-gray-100">
        <div className="text-center">
          <p className="text-lg">Error al cargar los datos</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 text-gray-800 dark:text-gray-100">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">FullFillment - Macromercado</h1>
          <p className="text-gray-600 dark:text-gray-400">Panel de control de ventas</p>
        </div>
        <BasicThemeToggle />
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Ventas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(data.totalVentas)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <span className="text-green-600 dark:text-green-400 text-xl">$</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Pedidos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.totalPedidos}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-xl">📦</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.pedidosPendientes}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 dark:text-yellow-400 text-xl">⏱️</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tasa Cancelación</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.tasaCancelacion.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <span className="text-red-600 dark:text-red-400 text-xl">📉</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Gráfico de Líneas - Ventas por Día */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Ventas y Pedidos por Día</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.ventasPorDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="dia" 
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
              />
              <YAxis 
                yAxisId="left"
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="ventas" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="Ventas ($)"
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="pedidos" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                name="Pedidos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Pie - Pedidos por Estado */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Pedidos por Estado</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.pedidosPorEstado}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.pedidosPorEstado.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico de Barras - Categorías de Ventas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Ventas por Categoría</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.categoriasVentas}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="categoria" 
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
            />
            <YAxis 
              stroke="#6b7280"
              tick={{ fill: '#6b7280' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: 'none', 
                borderRadius: '8px',
                color: '#f3f4f6'
              }}
              formatter={(value) => formatCurrency(Number(value) || 0)}
            />
            <Bar 
              dataKey="monto" 
              fill="#8b5cf6"
              radius={[8, 8, 0, 0]}
              name="Ventas ($)"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Section - Productos Top and Pedidos Recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Productos Top */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Productos Más Vendidos</h2>
          <div className="space-y-3">
            {data.productosTop.map((producto, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-300">
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{producto.nombre}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{producto.cantidad} uds</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{producto.porcentaje.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pedidos Recientes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Pedidos Recientes</h2>
          <div className="space-y-3">
            {data.pedidosRecientes.map((pedido, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{pedido.id}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pedido.estado)}`}>
                      {getStatusText(pedido.estado)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {pedido.cliente} • {formatCurrency(pedido.monto)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {pedido.fecha}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
