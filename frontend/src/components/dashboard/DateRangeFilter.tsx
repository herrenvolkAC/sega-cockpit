"use client";

import { useState } from "react";

interface DateRangeFilterProps {
  fechaInicio: string;
  fechaFin: string;
  onFechaInicioChange: (fecha: string) => void;
  onFechaFinChange: (fecha: string) => void;
  onApply: () => void;
  loading?: boolean;
}

export function DateRangeFilter({
  fechaInicio,
  fechaFin,
  onFechaInicioChange,
  onFechaFinChange,
  onApply,
  loading = false,
}: DateRangeFilterProps) {
  const getToday = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const getLast30Days = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return thirtyDaysAgo.toISOString().split('T')[0];
  };

  const getLast7Days = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return sevenDaysAgo.toISOString().split('T')[0];
  };

  const getYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  const getLast90Days = () => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return ninetyDaysAgo.toISOString().split('T')[0];
  };

  const getThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  };

  const getLastMonth = () => {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: firstDayLastMonth.toISOString().split('T')[0],
      end: lastDayLastMonth.toISOString().split('T')[0]
    };
  };

  const handleQuickRange = (start: string, end: string) => {
    onFechaInicioChange(start);
    onFechaFinChange(end);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          📅 Control de Fechas
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Rangos Predefinidos */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rápidos
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickRange(getYesterday(), getYesterday())}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                title="Ayer"
              >
                Ayer
              </button>
              <button
                onClick={() => handleQuickRange(getLast7Days(), getToday())}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                title="Últimos 7 días"
              >
                7 días
              </button>
              <button
                onClick={() => handleQuickRange(getLast30Days(), getToday())}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                title="Últimos 30 días"
              >
                30 días
              </button>
              <button
                onClick={() => handleQuickRange(getLast90Days(), getToday())}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                title="Últimos 90 días"
              >
                90 días
              </button>
            </div>
          </div>

          {/* Meses */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Meses
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickRange(getThisMonth(), getToday())}
                className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm"
                title="Este mes"
              >
                Este mes
              </button>
              <button
                onClick={() => {
                  const lastMonth = getLastMonth();
                  handleQuickRange(lastMonth.start, lastMonth.end);
                }}
                className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm"
                title="Mes pasado"
              >
                Mes pasado
              </button>
            </div>
          </div>

          {/* Fechas Personalizadas */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => onFechaInicioChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              max={getToday()}
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => onFechaFinChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              max={getToday()}
            />
          </div>
        </div>

        {/* Botón de Aplicar */}
        <div className="flex items-center justify-between">
          <button
            onClick={onApply}
            disabled={loading || !fechaInicio || !fechaFin}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Aplicando...
              </div>
            ) : (
              "🔍 Aplicar Filtros"
            )}
          </button>

          {/* Información del rango */}
          {fechaInicio && fechaFin && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div className="font-medium">
                Rango: {new Date(fechaInicio).toLocaleDateString('es-AR')} - {new Date(fechaFin).toLocaleDateString('es-AR')}
              </div>
              <div className="text-xs mt-1">
                ({Math.ceil((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24))} días)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sugerencias para fechas con datos */}
      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          💡 Sugerencias para fechas con datos:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-yellow-700 dark:text-yellow-300">
          <div>• Prueba con fechas de 2024 o 2025</div>
          <div>• Usa rangos más amplios (90+ días)</div>
          <div>• Verifica fechas de fin de mes</div>
          <div>• Prueba períodos de alta actividad</div>
        </div>
      </div>
    </div>
  );
}
