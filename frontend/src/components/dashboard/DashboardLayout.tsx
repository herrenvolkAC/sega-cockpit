"use client";

import { ReactNode } from "react";

interface KpiCard {
  title: string;
  value: string | number;
  icon: string;
  color: "green" | "blue" | "yellow" | "red" | "purple";
}

interface ChartSection {
  title: string;
  type: "line" | "pie" | "bar";
  data: any[];
  height?: number;
}

interface TableSection {
  title: string;
  columns: string[];
  rows: any[][];
}

interface DashboardLayoutProps {
  title: string;
  subtitle: string;
  kpiCards: KpiCard[];
  charts: ChartSection[];
  tables?: TableSection[];
  loading?: boolean;
  children?: ReactNode;
}

const getIconColor = (color: string) => {
  const colors = {
    green: "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400",
    blue: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400", 
    yellow: "bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400",
    red: "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400",
    purple: "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400"
  };
  return colors[color as keyof typeof colors] || colors.blue;
};

export function DashboardLayout({ 
  title, 
  subtitle, 
  kpiCards, 
  charts, 
  tables, 
  loading = false,
  children 
}: DashboardLayoutProps) {
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

  return (
    <main className="p-6 text-gray-800 dark:text-gray-100">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpiCards.map((card, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${getIconColor(card.color)}`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      {charts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {charts.map((chart, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">{chart.title}</h2>
              <div style={{ height: chart.height || 300 }}>
                {/* Chart component will be rendered here */}
                <div className="flex items-center justify-center h-full text-gray-500">
                  Chart: {chart.type} - {chart.data.length} data points
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Width Charts */}
      {charts.filter((_, index) => index % 2 === 0 && charts.length > index + 1).map((chart, index) => (
        <div key={`full-${index}`} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">{chart.title}</h2>
          <div style={{ height: chart.height || 300 }}>
            <div className="flex items-center justify-center h-full text-gray-500">
              Full Width Chart: {chart.type}
            </div>
          </div>
        </div>
      ))}

      {/* Tables Section */}
      {tables && tables.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {tables.map((table, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">{table.title}</h2>
              <div className="space-y-3">
                {table.rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {row.map((cell, cellIndex) => (
                      <div key={cellIndex} className="flex-1">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{table.columns[cellIndex]}</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{cell}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Content */}
      {children}
    </main>
  );
}
