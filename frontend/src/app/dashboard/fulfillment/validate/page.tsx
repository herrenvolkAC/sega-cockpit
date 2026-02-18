"use client";

import { useState, useEffect, useCallback } from "react";

export default function ValidateFulfillmentPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [validations, setValidations] = useState<any[]>([]);

  // Fetch data from API
  const fetchFulfillmentData = useCallback(
    async () => {
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
        
        const response = await fetch(`/api/fulfillment?${params}`);
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error.message || 'Error desconocido');
        }
        
        setData(result);
        validateData(result);
      } catch (error) {
        console.error('Error fetching fulfillment data:', error);
        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [fechaInicio, fechaFin]
  );

  // Validación de datos
  const validateData = (data: any) => {
    const validations = [];

    // Validación 1: Estructura básica
    if (!data.databaseName) {
      validations.push({
        type: 'error',
        message: '❌ Falta databaseName',
        field: 'databaseName'
      });
    } else {
      validations.push({
        type: 'success',
        message: `✅ Base de datos: ${data.databaseName}`,
        field: 'databaseName'
      });
    }

    // Validación 2: Totales
    if (typeof data.totalPedidos !== 'number' || data.totalPedidos < 0) {
      validations.push({
        type: 'error',
        message: '❌ totalPedidos inválido',
        field: 'totalPedidos',
        value: data.totalPedidos
      });
    } else {
      validations.push({
        type: 'success',
        message: `✅ Total Pedidos: ${data.totalPedidos.toLocaleString('es-AR')}`,
        field: 'totalPedidos'
      });
    }

    if (typeof data.totalSolicitado !== 'number' || data.totalSolicitado < 0) {
      validations.push({
        type: 'error',
        message: '❌ totalSolicitado inválido',
        field: 'totalSolicitado',
        value: data.totalSolicitado
      });
    } else {
      validations.push({
        type: 'success',
        message: `✅ Total Solicitado: ${data.totalSolicitado.toLocaleString('es-AR')}`,
        field: 'totalSolicitado'
      });
    }

    if (typeof data.totalFaltantes !== 'number' || data.totalFaltantes < 0) {
      validations.push({
        type: 'error',
        message: '❌ totalFaltantes inválido',
        field: 'totalFaltantes',
        value: data.totalFaltantes
      });
    } else {
      validations.push({
        type: 'success',
        message: `✅ Total Faltantes: ${data.totalFaltantes.toLocaleString('es-AR')}`,
        field: 'totalFaltantes'
      });
    }

    // Validación 3: Tasa de satisfacción
    if (typeof data.tasaSatisfaccion !== 'number' || data.tasaSatisfaccion < 0 || data.tasaSatisfaccion > 100) {
      validations.push({
        type: 'error',
        message: '❌ tasaSatisfaccion inválida (debe ser 0-100)',
        field: 'tasaSatisfaccion',
        value: data.tasaSatisfaccion
      });
    } else {
      validations.push({
        type: 'success',
        message: `✅ Tasa Satisfacción: ${data.tasaSatisfaccion}%`,
        field: 'tasaSatisfaccion'
      });
    }

    // Validación 4: Consistencia matemática
    if (typeof data.totalPedidos === 'number' && 
        typeof data.totalSolicitado === 'number' && 
        typeof data.totalFaltantes === 'number') {
      
      // Verificar que los totales tengan sentido
      if (data.totalFaltantes > data.totalSolicitado) {
        validations.push({
          type: 'warning',
          message: '⚠️ Los faltantes no pueden ser mayores que lo solicitado',
          field: 'consistencia',
          details: `Faltantes: ${data.totalFaltantes}, Solicitado: ${data.totalSolicitado}`
        });
      }

      // Calcular tasa de satisfacción esperada
      const tasaEsperada = data.totalSolicitado > 0 
        ? ((data.totalSolicitado - data.totalFaltantes) / data.totalSolicitado) * 100 
        : 0;
      
      const diferencia = Math.abs(tasaEsperada - data.tasaSatisfaccion);
      
      if (diferencia > 1) {
        validations.push({
          type: 'warning',
          message: `⚠️ La tasa de satisfacción no coincide con el cálculo`,
          field: 'consistencia',
          details: `Reportada: ${data.tasaSatisfaccion}%, Calculada: ${tasaEsperada.toFixed(2)}%`
        });
      } else {
        validations.push({
          type: 'success',
          message: `✅ Tasa de satisfacción consistente`,
          field: 'consistencia',
          details: `Reportada: ${data.tasaSatisfaccion}%, Calculada: ${tasaEsperada.toFixed(2)}%`
        });
      }
    }

    // Validación 5: Arrays de datos
    if (!Array.isArray(data.pedidosPorDia)) {
      validations.push({
        type: 'error',
        message: '❌ pedidosPorDia no es un array',
        field: 'pedidosPorDia'
      });
    } else if (data.pedidosPorDia.length === 0) {
      validations.push({
        type: 'warning',
        message: '⚠️ pedidosPorDia está vacío',
        field: 'pedidosPorDia'
      });
    } else {
      validations.push({
        type: 'success',
        message: `✅ pedidosPorDia: ${data.pedidosPorDia.length} registros`,
        field: 'pedidosPorDia'
      });

      // Validar estructura de cada día
      data.pedidosPorDia.forEach((dia: any, index: number) => {
        if (!dia.dia || typeof dia.pedidos !== 'number' || typeof dia.faltantes !== 'number' || typeof dia.qty_solicitada !== 'number' || typeof dia.entregados !== 'number' || typeof dia.fulfillment_pct !== 'number') {
          validations.push({
            type: 'error',
            message: `❌ Estructura inválida en pedidosPorDia[${index}]`,
            field: 'pedidosPorDia',
            details: JSON.stringify(dia)
          });
        } else {
          validations.push({
            type: 'success',
            message: `✅ pedidosPorDia[${index}]: ${dia.dia} - ${dia.pedidos} pedidos, ${dia.qty_solicitada} solicitados, ${dia.entregados} entregados, ${dia.faltantes} faltantes, ${dia.fulfillment_pct.toFixed(1)}% fulfillment`,
            field: 'pedidosPorDia'
          });
        }
        
        // Mostrar todos los campos disponibles
        const availableFields = Object.keys(dia);
        validations.push({
          type: 'info',
          message: `📋 Campos disponibles en pedidosPorDia[${index}]: ${availableFields.join(', ')}`,
          field: 'pedidosPorDia',
          details: JSON.stringify(dia, null, 2)
        });
      });
    }

    if (!Array.isArray(data.estadoFulfillment)) {
      validations.push({
        type: 'error',
        message: '❌ estadoFulfillment no es un array',
        field: 'estadoFulfillment'
      });
    } else {
      validations.push({
        type: 'success',
        message: `✅ estadoFulfillment: ${data.estadoFulfillment.length} estados`,
        field: 'estadoFulfillment'
      });
    }

    if (!Array.isArray(data.productosConShortage)) {
      validations.push({
        type: 'error',
        message: '❌ productosConShortage no es un array',
        field: 'productosConShortage'
      });
    } else {
      validations.push({
        type: 'success',
        message: `✅ productosConShortage: ${data.productosConShortage.length} productos`,
        field: 'productosConShortage'
      });
    }

    // Validación 6: Fechas
    if (data.generatedAt) {
      const generatedDate = new Date(data.generatedAt);
      if (isNaN(generatedDate.getTime())) {
        validations.push({
          type: 'error',
          message: '❌ generatedAt no es una fecha válida',
          field: 'generatedAt',
          value: data.generatedAt
        });
      } else {
        validations.push({
          type: 'success',
          message: `✅ Fecha de generación: ${generatedDate.toLocaleString('es-AR')}`,
          field: 'generatedAt'
        });
      }
    }

    setValidations(validations);
  };

  // Cargar datos iniciales
  useEffect(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const today = new Date();
    
    setFechaInicio(ninetyDaysAgo.toISOString().split('T')[0]);
    setFechaFin(today.toISOString().split('T')[0]);
  }, []);

  const getValidationColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
      case 'error': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';
      case 'info': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
      default: return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <main className="p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Validación de Datos - Fulfillment
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Herramienta para validar la consistencia de los datos del dashboard
        </p>
      </header>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Filtro de Fechas
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
          onClick={fetchFulfillmentData}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Validando...' : 'Validar Datos'}
        </button>
      </div>

      {/* Validations */}
      {validations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Resultados de Validación
          </h2>
          
          <div className="space-y-3">
            {validations.map((validation, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border ${getValidationColor(validation.type)}`}
              >
                <div className="font-medium">{validation.message}</div>
                {validation.details && (
                  <div className="text-sm mt-1 opacity-80">{validation.details}</div>
                )}
                {validation.value !== undefined && (
                  <div className="text-sm mt-1 opacity-80">Valor: {JSON.stringify(validation.value)}</div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Resumen:</strong> {validations.filter(v => v.type === 'success').length} ✅ exitosos, 
              {validations.filter(v => v.type === 'warning').length} ⚠️ advertencias, 
              {validations.filter(v => v.type === 'error').length} ❌ errores
            </div>
          </div>
        </div>
      )}

      {/* Raw Data */}
      {data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Datos Crudos (JSON)
          </h2>
          
          <details className="mb-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
              Click para expandir/collapse
            </summary>
            <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </main>
  );
}
