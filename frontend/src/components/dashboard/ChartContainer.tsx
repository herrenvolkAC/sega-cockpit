"use client";

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

interface ChartData {
  name?: string;
  dia?: string;
  categoria?: string;
  value?: number;
  ventas?: number;
  pedidos?: number;
  monto?: number;
  cantidad?: number;
  color?: string;
  [key: string]: any;
}

interface ChartContainerProps {
  type: "line" | "pie" | "bar";
  data: ChartData[];
  height?: number;
  formatCurrency?: (value: number) => string;
  customConfig?: any;
}

const defaultFormatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(value);
};

export function ChartContainer({ 
  type, 
  data, 
  height = 300, 
  formatCurrency = defaultFormatCurrency,
  customConfig = {}
}: ChartContainerProps) {
  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
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
        {data.some(d => d.pedidos) && (
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#6b7280"
            tick={{ fill: '#6b7280' }}
          />
        )}
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#1f2937', 
            border: 'none', 
            borderRadius: '8px',
            color: '#f3f4f6'
          }}
          formatter={(value) => formatCurrency(Number(value) || 0)}
        />
        <Legend />
        {data.some(d => d.ventas) && (
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="ventas" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            name="Ventas ($)"
          />
        )}
        {data.some(d => d.pedidos) && (
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="pedidos" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            name="Pedidos"
          />
        )}
        {data.some(d => d.faltantes) && (
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="faltantes" 
            stroke="#ef4444" 
            strokeWidth={2}
            dot={{ fill: '#ef4444', r: 4 }}
            name="Faltantes"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );

  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || '#8884d8'} />
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
  );

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
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
          name="Monto ($)"
        />
        {data.some(d => d.cantidad) && (
          <Bar 
            dataKey="cantidad" 
            fill="#10b981"
            radius={[8, 8, 0, 0]}
            name="Cantidad"
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );

  switch (type) {
    case "line":
      return renderLineChart();
    case "pie":
      return renderPieChart();
    case "bar":
      return renderBarChart();
    default:
      return <div>Chart type not supported</div>;
  }
}
