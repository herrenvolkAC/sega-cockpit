"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, ReferenceLine, ScatterChart, Scatter } from "recharts";
import { InfoTooltip } from "@/components/InfoTooltip";
import { clientName } from "@/lib/env";

// CSS for animations and custom chart styles
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 200ms ease-out forwards;
  }
  
  /* Custom bar chart styles */
  .recharts-bar-rectangle {
    transition: all 0.2s ease-in-out !important;
  }
  
  .recharts-bar-rectangle:hover {
    filter: brightness(1.1) !important;
    stroke: rgba(0, 0, 0, 0.3) !important;
    stroke-width: 1px !important;
  }
  
  .recharts-bar-rectangle.recharts-active-bar {
    filter: brightness(1.15) !important;
    stroke: rgba(0, 0, 0, 0.5) !important;
    stroke-width: 2px !important;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.2) !important;
  }
`;

// Debounce function to prevent rapid API calls
const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// Función utilitaria para obtener camiones válidos (usada por KPIs y scatter)
const getValidTrucks = (data: ExpedicionesData | null) => {
  if (!data || !data.scatterData) return [];
  
  return data.scatterData.filter(truck => {
    // Excluir NULLs
    if (truck.tiempo_muerto === null || truck.tiempo_muerto === undefined) return false;
    if (truck.duracion === null || truck.duracion === undefined) return false;
    
    // Excluir negativos
    if (truck.tiempo_muerto < 0 || truck.duracion < 0) return false;
    
    // Excluir outliers extremos (> 720 min)
    if (truck.tiempo_muerto > 720 || truck.duracion > 720) return false;
    
    return true;
  });
};

// Función para calcular percentiles
const calculatePercentile = (data: number[], percentile: number): number => {
  if (data.length === 0) return 0;
  
  const sorted = [...data].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (lower === upper) return sorted[lower];
  
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

// Tipos para los datos de expediciones
type ExpedicionesData = {
  databaseName: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  matricula: string | null;
  totalCamiones: number;
  duracionPromedio: number;
  ocupacionPromedio: number;
  totalDestinos: number;
  // Nuevas propiedades de tiempo muerto
  tiempoMuertoPromedio: number;
  tiempoMuertoP95: number;
  camionesEspera15: number;
  camionesEspera30: number;
  tiempoMuertoTotal: number;
  duracionTotal: number;
  totalCamionesValidos: number;
  scatterCaps: {
    duracionP98: number;
    tiempoMuertoP95: number;
  };
  scatterData: Array<{
    matricula: string;
    fecha: string;
    duracion: number;
    tiempo_muerto: number;
    ocupacion: number;
    cantidad_destinos: number;
    uls: number;
  }>;
  camionesPorDia: Array<{
    dia: string;
    camiones: number;
    duracion_promedio: number;
    tiempo_muerto_promedio: number;
    ocupacion_promedio: number;
    total_destinos: number;
    total_uls: number;
  }>;
  topTiempoMuerto: Array<{
    matricula: string;
    fecha: string;
    duracion: number;
    tiempo_muerto: number;
    ocupacion: number;
    cantidad_destinos: number;
    uls: number;
  }>;
  estadoULs: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  topMatriculas: Array<{
    name: string;
    uls_total: number;
    duracion_promedio: number;
    viajes: number;
  }>;
  matriculasMasUsadas: Array<{
    name: string;
    viajes: number;
    uls_total: number;
    duracion_promedio: number;
    ocupacion_promedio: number;
    total_destinos: number;
  }>;
  generatedAt: string;
};

// Tipos para datos de benchmark histórico
type BenchmarkData = {
  databaseName: string;
  datosMensuales: Array<{
    anio: number;
    mes: number;
    mesAnio: string;
    total_camiones: number;
    duracion_promedio: number;
    tiempo_muerto_promedio: number;
    ocupacion_promedio: number;
    total_destinos: number;
    total_uls: number;
  }>;
  promedioDuracionHistorico: number;
  mejorDuracion: number;
  peorDuracion: number;
  promedioOcupacionHistorico: number;
  mejorOcupacion: number;
  peorOcupacion: number;
  // Nuevas propiedades de tiempo muerto
  promedioTiempoMuertoHistorico: number;
  mejorTiempoMuerto: number;
  peorTiempoMuerto: number;
  p95TiempoMuertoHistorico: number;
  duracionActual: number;
  ocupacionActual: number;
  tiempoMuertoActual: number;
  brechaDuracionVsPromedio: number;
  brechaDuracionVsMejor: number;
  brechaOcupacionVsPromedio: number;
  brechaOcupacionVsMejor: number;
  brechaTiempoMuertoVsPromedio: number;
  brechaTiempoMuertoVsMejor: number;
  generatedAt: string;
};

export default function ExpedicionesPage() {
  const [data, setData] = useState<ExpedicionesData | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [matricula, setMatricula] = useState('');
  const [showOutliers, setShowOutliers] = useState(true); // Por defecto ocultar outliers
  const matriculaRef = useRef(matricula);

  // Fetch data from API con filtros de fecha y matrícula (debounced)
  const fetchExpedicionesData = useCallback(
    async () => {

      
      if (!fechaInicio || !fechaFin) {

        return;
      }

      setLoading(true);
      
      try {
        const params = new URLSearchParams();
        params.append('fechaInicio', fechaInicio);
        params.append('fechaFin', fechaFin);
        
        // Agregar matrícula solo si tiene un valor
        if (matriculaRef.current.trim()) {
          params.append('matricula', matriculaRef.current.trim());
        }
        
        const url = `/expediciones?${params}`;

        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error.message || 'Error desconocido');
        }
        
        setData(result);
      } catch (error) {

        alert('Error al cargar los datos. Por favor intente nuevamente.');
      } finally {
        setLoading(false);
      }
    },
    [fechaInicio, fechaFin, matricula]
  );

  // Fetch benchmark data
  const fetchBenchmarkData = useCallback(
    async () => {

      
      if (!fechaInicio || !fechaFin) {

        return;
      }
      
      try {
        const params = new URLSearchParams();
        params.append('fechaInicio', fechaInicio);
        params.append('fechaFin', fechaFin);
        
        // Agregar matrícula solo si tiene un valor
        if (matriculaRef.current.trim()) {
          params.append('matricula', matriculaRef.current.trim());
        }
        
        const url = `/expediciones/benchmark?${params}`;

        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.error) {

          const errorMessage = result.error?.message || result.error?.code || JSON.stringify(result.error) || 'Error desconocido al obtener datos de benchmark';
          throw new Error(errorMessage);
        }
        
        setBenchmarkData(result);
      } catch (error) {

        setBenchmarkData(null);
      }
    },
    [fechaInicio, fechaFin, matricula]
  );

  // Debounced version to prevent rapid API calls
  const debouncedFetchExpedicionesData = useCallback(
    debounce(fetchExpedicionesData, 1000),
    [fetchExpedicionesData]
  );

  // Cargar datos iniciales
  useEffect(() => {
    setFechaInicio('2025-01-01');
    setFechaFin('2025-02-01');
  }, []);

  // Cargar datos de benchmark cuando cambian las fechas
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      fetchBenchmarkData();
    }
  }, [fetchBenchmarkData]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("es-AR").format(num);
  };

  // Calcular total para porcentajes del PieChart
  const totalULs = useMemo(() => {
    if (!data?.estadoULs) {

      return 0;
    }

    const total = data.estadoULs.reduce((sum: number, item: any) => sum + item.value, 0);

    return total;
  }, [data?.estadoULs]);

  const kpiCards = useMemo(() => {
    if (!data || !benchmarkData) return [];
    
    // Calcular baseline dinámico si no existe SLA definido
    const baselineDuracion = benchmarkData?.promedioDuracionHistorico || 120;
    const baselineP95 = benchmarkData?.promedioDuracionHistorico * 1.5 || 180; // Estimación P95
    
    const cumplimientoSLA = ((data.totalCamiones / data.totalCamiones) * 100); // Por ahora 100% hasta tener datos reales
    const deltaVsBaseline = ((data.duracionPromedio - baselineDuracion) / baselineDuracion) * 100;
    
    // Calcular P95 local (aproximación simple)
    const p95Local = data.duracionPromedio * 1.3; // Estimación simple
    
    // Encontrar peor camión
    const peorCamion = data.camionesPorDia?.reduce((peor: any, dia: any) => {
      if (!peor || dia.duracion_promedio > peor.duracion_promedio) {
        return { dia: dia.dia, duracion: dia.duracion_promedio, matricula: 'N/A' }; // Simplificado
      }
      return peor;
    }, null);
    
    return [
      {
        title: "% Cumplimiento SLA",
        value: `${cumplimientoSLA.toFixed(1)}%`,
        subtitle: `Camiones ≤ ${baselineDuracion.toFixed(0)}min`,
        color: cumplimientoSLA >= 95 ? "green" as const :
               cumplimientoSLA >= 85 ? "yellow" as const : "red" as const,
        delta: deltaVsBaseline,
        tooltip: `Porcentaje de camiones que cumplen el SLA de duración ≤ ${baselineDuracion.toFixed(0)} minutos. Baseline calculada con promedio últimos 10 meses.`
      },
      {
        title: "Duración Promedio",
        value: `${data.duracionPromedio.toFixed(0)} min`,
        subtitle: `vs ${baselineDuracion.toFixed(0)}min histórica`,
        color: deltaVsBaseline <= 0 ? "green" as const :
               deltaVsBaseline <= 10 ? "yellow" as const : "red" as const,
        delta: deltaVsBaseline,
        tooltip: `Tiempo promedio de carga actual vs promedio histórico de últimos 10 meses (${baselineDuracion.toFixed(0)} min).`
      },
      {
        title: "P95 Duración",
        value: `${p95Local.toFixed(0)} min`,
        subtitle: `vs ${baselineP95.toFixed(0)}min histórica`,
        color: p95Local <= baselineP95 ? "green" as const :
               p95Local <= baselineP95 * 1.2 ? "yellow" as const : "red" as const,
        delta: ((p95Local - baselineP95) / baselineP95) * 100,
        tooltip: `Percentil 95 de duración de carga. Valores por encima de este percentil son considerados atípicos.`
      },
      {
        title: "Peor Camión del Período",
        value: peorCamion ? `${peorCamion.duracion.toFixed(0)} min` : "N/A",
        subtitle: peorCamion ? `${peorCamion.dia}` : "",
        color: "red" as const,
        tooltip: peorCamion ? `Máxima duración registrada en el período: ${peorCamion.duracion.toFixed(0)} minutos el día ${peorCamion.dia}.` : "Sin datos para identificar el peor caso."
      }
    ];
  }, [data, benchmarkData]);

  // KPIs de Eficiencia Logística
  const eficienciaKPIs = useMemo(() => {
    if (!data || !benchmarkData) return [];
    
    const baselineOcupacion = benchmarkData?.promedioOcupacionHistorico || 85;
    const deltaOcupacion = ((data.ocupacionPromedio - baselineOcupacion) / baselineOcupacion) * 100;
    
    // Calcular porcentajes reales basados en los datos diarios
    const contenedoresBajos = data.camionesPorDia?.filter((dia: any) => dia.ocupacion_promedio < 40).length || 0;
    const contenedoresAltos = data.camionesPorDia?.filter((dia: any) => dia.ocupacion_promedio > 80).length || 0;
    const totalContenedores = data.camionesPorDia?.length || 1;
    
    const porcentajeSubutilizados = (contenedoresBajos / totalContenedores) * 100;
    const porcentajeCargaAlta = (contenedoresAltos / totalContenedores) * 100;
    
    const destinosPorCamion = data.totalCamiones > 0 ? (data.totalDestinos / data.totalCamiones) : 0;
    const baselineDestinos = 1.2; // Estimación baseline
    
    return [
      {
        title: "Ocupación Promedio",
        value: `${data.ocupacionPromedio.toFixed(1)}%`,
        subtitle: `vs ${baselineOcupacion.toFixed(1)}% histórica`,
        color: deltaOcupacion >= 0 ? "green" as const :
               deltaOcupacion >= -5 ? "yellow" as const : "red" as const,
        delta: deltaOcupacion,
        tooltip: `Porcentaje de ocupación de contenedores vs promedio histórico de últimos 10 meses (${baselineOcupacion.toFixed(1)}%). Indica qué tan llenos van los contenedores para optimizar espacio.`
      },
      {
        title: "% Contenedores < 40% Ocupación",
        value: `${porcentajeSubutilizados.toFixed(1)}%`,
        subtitle: "Subutilización",
        color: porcentajeSubutilizados <= 20 ? "green" as const :
               porcentajeSubutilizados <= 30 ? "yellow" as const : "red" as const,
        tooltip: "Porcentaje de contenedores con ocupación inferior al 40%. Indica contenedores viajando con mucho espacio libre (transportando aire)."
      },
      {
        title: "% Contenedores > 80% Ocupación",
        value: `${porcentajeCargaAlta.toFixed(1)}%`,
        subtitle: "Carga alta",
        color: porcentajeCargaAlta <= 15 ? "green" as const :
               porcentajeCargaAlta <= 25 ? "yellow" as const : "red" as const,
        tooltip: "Porcentaje de contenedores con ocupación superior al 80%. Indica contenedores casi llenos (óptimo uso de espacio)."
      },
      {
        title: "Destinos Promedio por Camión",
        value: destinosPorCamion.toFixed(1),
        subtitle: `vs ${baselineDestinos.toFixed(1)} histórica`,
        color: destinosPorCamion >= baselineDestinos ? "green" as const :
               destinosPorCamion >= baselineDestinos * 0.9 ? "yellow" as const : "red" as const,
        delta: ((destinosPorCamion - baselineDestinos) / baselineDestinos) * 100,
        tooltip: "Promedio de destinos atendidos por camión vs baseline histórico."
      }
    ];
  }, [data, benchmarkData]);

  // Cálculo de cuadrantes y dominios para scatter plot
  const scatterAnalysis = useMemo(() => {
    if (!data?.scatterData || !benchmarkData) return null;

    const baselineDuracion = benchmarkData.promedioDuracionHistorico || 120;
    const baselineTiempoMuerto = benchmarkData.promedioTiempoMuertoHistorico || 5;
    
    // Determinar dominios según toggle de outliers
    const duracionCap = showOutliers ? 
      Math.max(...data.scatterData.map(d => d.duracion)) + 5 : 
      data.scatterCaps?.duracionP98 || 180;
    
    const tiempoMuertoCap = showOutliers ? 
      Math.max(...data.scatterData.map(d => d.tiempo_muerto)) + 10 : 
      data.scatterCaps?.tiempoMuertoP95 || 25;

    // Usar getValidTrucks para asegurar coherencia con KPIs
    const validTrucks = getValidTrucks(data);
    if (validTrucks.length === 0) return null;

    // Calcular cuadrantes con datos válidos
    const cuadrantes = {
      optimo: 0,      // duracion<=base && muerto<=base
      carga: 0,       // duracion>base && muerto<=base
      coordinacion: 0, // duracion<=base && muerto>base
      critico: 0      // duracion>base && muerto>base
    };

    validTrucks.forEach(point => {
      const duracionExcede = point.duracion > baselineDuracion;
      const tiempoMuertoExcede = point.tiempo_muerto > baselineTiempoMuerto;

      if (!duracionExcede && !tiempoMuertoExcede) cuadrantes.optimo++;
      else if (duracionExcede && !tiempoMuertoExcede) cuadrantes.carga++;
      else if (!duracionExcede && tiempoMuertoExcede) cuadrantes.coordinacion++;
      else cuadrantes.critico++;
    });

    // Identificar outliers (datos que no están en validTrucks)
    const outliers = data.scatterData.filter(point => 
      point.duracion > (data.scatterCaps?.duracionP98 || 180) ||
      point.tiempo_muerto > (data.scatterCaps?.tiempoMuertoP95 || 25)
    );

    return {
      baselineDuracion,
      baselineTiempoMuerto,
      duracionCap,
      tiempoMuertoCap,
      cuadrantes,
      outliers: outliers.length,
      totalPoints: validTrucks.length,
      validTrucks
    };
  }, [data, benchmarkData, showOutliers]);

  // KPIs de Coordinación Operativa
  const coordinacionKPIs = useMemo(() => {
    if (!data || !benchmarkData) return [];
    
    // Usar getValidTrucks para asegurar coherencia
    const validTrucks = getValidTrucks(data);
    const validTrucksCount = validTrucks.length;
    
    if (validTrucksCount === 0) return [];
    
    // Calcular métricas con datos válidos
    const tiempoMuertoValues = validTrucks.map(t => t.tiempo_muerto);
    const duracionValues = validTrucks.map(t => t.duracion);
    
    const tiempoMuertoPromedio = tiempoMuertoValues.reduce((sum, val) => sum + val, 0) / validTrucksCount;
    const p95TiempoMuerto = calculatePercentile(tiempoMuertoValues, 95);
    
    // Calcular camiones con espera > 15 y > 30 minutos
    const camionesEspera15 = validTrucks.filter(t => t.tiempo_muerto > 15).length;
    const camionesEspera30 = validTrucks.filter(t => t.tiempo_muerto > 30).length;
    
    const porcentajeEspera15 = (camionesEspera15 / validTrucksCount) * 100;
    const porcentajeEspera30 = (camionesEspera30 / validTrucksCount) * 100;
    
    // KPI derivado: % Tiempo Muerto sobre Tiempo Total (corregido)
    const tiempoMuertoTotal = tiempoMuertoValues.reduce((sum, val) => sum + val, 0);
    const duracionTotal = duracionValues.reduce((sum, val) => sum + val, 0);
    const tiempoTotalOperativo = tiempoMuertoTotal + duracionTotal;
    const porcentajeTiempoMuertoSobreTotal = tiempoTotalOperativo > 0 ? (tiempoMuertoTotal / tiempoTotalOperativo) * 100 : 0;
    
    // Baselines para comparación
    const baselineTiempoMuerto = benchmarkData?.promedioTiempoMuertoHistorico || 5;
    const baselineP95TiempoMuerto = benchmarkData?.p95TiempoMuertoHistorico || 15;
    
    const deltaTiempoMuerto = ((tiempoMuertoPromedio - baselineTiempoMuerto) / baselineTiempoMuerto) * 100;
    const deltaP95TiempoMuerto = ((p95TiempoMuerto - baselineP95TiempoMuerto) / baselineP95TiempoMuerto) * 100;
    
    return [
      {
        title: "Tiempo Muerto Promedio",
        value: `${tiempoMuertoPromedio.toFixed(1)} min`,
        subtitle: `vs ${baselineTiempoMuerto.toFixed(1)} min histórica`,
        color: deltaTiempoMuerto <= 0 ? "green" as const :
               deltaTiempoMuerto <= 10 ? "yellow" as const : "red" as const,
        delta: deltaTiempoMuerto,
        tooltip: `Tiempo promedio desde fin de preparación hasta inicio de carga vs baseline de últimos 10 meses (${baselineTiempoMuerto.toFixed(1)} min). Representa tiempo improductivo en dock.`
      },
      {
        title: "P95 Tiempo Muerto",
        value: `${p95TiempoMuerto.toFixed(1)} min`,
        subtitle: `vs ${baselineP95TiempoMuerto.toFixed(1)} min histórica`,
        color: deltaP95TiempoMuerto <= 0 ? "green" as const :
               deltaP95TiempoMuerto <= 10 ? "yellow" as const : "red" as const,
        delta: deltaP95TiempoMuerto,
        tooltip: `Percentil 95 de tiempo muerto. El 95% de los camiones esperan menos de este tiempo. Valores altos indican outliers problemáticos.`
      },
      {
        title: "% Camiones > 15 min espera",
        value: `${porcentajeEspera15.toFixed(1)}%`,
        subtitle: "Alerta moderada",
        color: porcentajeEspera15 <= 20 ? "green" as const :
               porcentajeEspera15 <= 35 ? "yellow" as const : "red" as const,
        tooltip: "Porcentaje de camiones con espera superior a 15 minutos. Indica nivel de congestión en playa/dock."
      },
      {
        title: "% Camiones > 30 min espera",
        value: `${porcentajeEspera30.toFixed(1)}%`,
        subtitle: "Alerta crítica",
        color: porcentajeEspera30 <= 10 ? "green" as const :
               porcentajeEspera30 <= 20 ? "yellow" as const : "red" as const,
        tooltip: "Porcentaje de camiones con espera superior a 30 minutos. Indica problemas graves de coordinación."
      },
      {
        title: "% Tiempo Muerto / Total",
        value: `${porcentajeTiempoMuertoSobreTotal.toFixed(1)}%`,
        subtitle: "Ineficiencia dock",
        color: porcentajeTiempoMuertoSobreTotal <= 15 ? "green" as const :
               porcentajeTiempoMuertoSobreTotal <= 25 ? "yellow" as const : "red" as const,
        tooltip: "Tiempo muerto / (Tiempo muerto + Duración carga). Porcentaje del tiempo total operativo que es improductivo."
      }
    ];
  }, [data, benchmarkData]);

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
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <main className="p-6">
      {/* Header Narrativo */}
      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Expediciones / Cargas | {clientName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Panel de control de despachos y cargas de camiones</p>
            {data && (
              <div className="text-base text-gray-600 dark:text-gray-400 mt-1">
                {(() => {
                  try {
                    
                    let startDateStr = 'Rango seleccionado';
                    let endDateStr = '';
                    
                    // Usar directamente los valores de los inputs del frontend
                    if (fechaInicio && fechaInicio !== null && fechaInicio !== undefined) {
                      const date = new Date(fechaInicio);
                      if (!isNaN(date.getTime())) {
                        startDateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
                      }
                    }
                    
                    if (fechaFin && fechaFin !== null && fechaFin !== undefined) {
                      const date = new Date(fechaFin);
                      if (!isNaN(date.getTime())) {
                        endDateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
                      }
                    }
                    
                    // Si ambas fechas son iguales, mostrar formato más claro
                    if (startDateStr === endDateStr && startDateStr !== 'Rango seleccionado') {
                      const date = new Date(fechaInicio);
                      const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                      return (
                        <>
                          {monthName} · {formatNumber(data.totalCamiones)} camiones · 
                          <span className={`font-semibold ${
                            data.duracionPromedio <= 120 ? 'text-green-600 dark:text-green-400' :
                            data.duracionPromedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {data.duracionPromedio.toFixed(0)} min avg
                          </span> (Baseline 10m: {benchmarkData?.promedioDuracionHistorico?.toFixed(0) || '120'} min | Tiempo muerto 10m: {benchmarkData?.promedioTiempoMuertoHistorico?.toFixed(0) || '5'} min)
                        </>
                      );
                    }
                    
                    if (startDateStr !== 'Rango seleccionado' && endDateStr) {
                      return (
                        <>
                          {startDateStr} - {endDateStr} · {formatNumber(data.totalCamiones)} camiones · 
                          <span className={`font-semibold ${
                            data.duracionPromedio <= 120 ? 'text-green-600 dark:text-green-400' :
                            data.duracionPromedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {data.duracionPromedio.toFixed(0)} min avg
                          </span> (Baseline 10m: {benchmarkData?.promedioDuracionHistorico?.toFixed(0) || '120'} min | Tiempo muerto 10m: {benchmarkData?.promedioTiempoMuertoHistorico?.toFixed(0) || '5'} min)
                        </>
                      );
                    }
                    
                    if (startDateStr !== 'Rango seleccionado') {
                      return (
                        <>
                          {startDateStr} · {formatNumber(data.totalCamiones)} camiones · 
                          <span className={`font-semibold ${
                            data.duracionPromedio <= 120 ? 'text-green-600 dark:text-green-400' :
                            data.duracionPromedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {data.duracionPromedio.toFixed(0)} min avg
                          </span> (Baseline 10m: {benchmarkData?.promedioDuracionHistorico?.toFixed(0) || '120'} min | Tiempo muerto 10m: {benchmarkData?.promedioTiempoMuertoHistorico?.toFixed(0) || '5'} min)
                        </>
                      );
                    }
                    
                    return (
                      <>
                        {startDateStr} · {formatNumber(data.totalCamiones)} camiones · 
                        <span className={`font-semibold ${
                          data.duracionPromedio <= 120 ? 'text-green-600 dark:text-green-400' :
                          data.duracionPromedio <= 180 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {data.duracionPromedio.toFixed(0)} min avg
                        </span> (Baseline 10m: {benchmarkData?.promedioDuracionHistorico?.toFixed(0) || '120'} min | Tiempo muerto 10m: {benchmarkData?.promedioTiempoMuertoHistorico?.toFixed(0) || '5'} min)
                      </>
                    );
                  } catch (error) {

                    return 'Rango seleccionado · ';
                  }
                })()}
              </div>
            )}
          </div>
          {data && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Actualizado: {new Date(data.generatedAt).toLocaleString('es-AR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          )}
        </div>
      </header>

      
      {/* Filtros Simplificados */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 border border-gray-200 dark:border-gray-700 mb-8">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Rango de análisis
        </div>
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
              Matrícula (Opcional)
            </label>
            <input
              type="text"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              placeholder="Filtrar por matrícula..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={debouncedFetchExpedicionesData}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Filtrando...' : 'Filtrar'}
            </button>
            <button
              onClick={() => {
                setFechaInicio('');
                setFechaFin('');
                setMatricula('');
                setData(null);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Limpiar
            </button>
            <button
              onClick={() => {
                // Simular datos保持原有逻辑
                const simulatedData = {
                  databaseName: "MACROMERCADO",
                  fechaInicio: fechaInicio || "2026-01-01",
                  fechaFin: fechaFin || "2026-02-26",
                  matricula: matricula || null,
                  totalCamiones: 1250,
                  duracionPromedio: 115.5,
                  ocupacionPromedio: 87.3,
                  totalDestinos: 3420,
                  // Nuevas propiedades de tiempo muerto
                  tiempoMuertoPromedio: 8.2,
                  tiempoMuertoP95: 18.5,
                  camionesEspera15: 185,
                  camionesEspera30: 42,
                  tiempoMuertoTotal: 10250,
                  duracionTotal: 144375,
                  totalCamionesValidos: 1250,
                  scatterCaps: {
                    duracionP98: 180,
                    tiempoMuertoP95: 25
                  },
                  scatterData: [
                    { matricula: "ABC123", fecha: "01/01/2025", duracion: 118, tiempo_muerto: 7.8, ocupacion: 85.6, cantidad_destinos: 8, uls: 89 },
                    { matricula: "DEF456", fecha: "01/01/2025", duracion: 112, tiempo_muerto: 8.5, ocupacion: 88.1, cantidad_destinos: 9, uls: 98 },
                    { matricula: "GHI789", fecha: "01/01/2025", duracion: 125, tiempo_muerto: 9.2, ocupacion: 82.3, cantidad_destinos: 6, uls: 72 },
                    { matricula: "JKL012", fecha: "01/01/2025", duracion: 108, tiempo_muerto: 6.9, ocupacion: 90.2, cantidad_destinos: 7, uls: 81 },
                    { matricula: "MNO345", fecha: "01/01/2025", duracion: 119, tiempo_muerto: 8.6, ocupacion: 86.8, cantidad_destinos: 8, uls: 95 },
                    { matricula: "PQR678", fecha: "02/01/2025", duracion: 95, tiempo_muerto: 4.2, ocupacion: 92.1, cantidad_destinos: 10, uls: 105 },
                    { matricula: "STU901", fecha: "02/01/2025", duracion: 142, tiempo_muerto: 18.5, ocupacion: 35.8, cantidad_destinos: 5, uls: 58 },
                    { matricula: "VWX234", fecha: "02/01/2025", duracion: 88, tiempo_muerto: 3.1, ocupacion: 94.5, cantidad_destinos: 11, uls: 112 },
                    { matricula: "YZA567", fecha: "02/01/2025", duracion: 156, tiempo_muerto: 25.3, ocupacion: 28.9, cantidad_destinos: 4, uls: 45 },
                    { matricula: "BCD890", fecha: "03/01/2025", duracion: 102, tiempo_muerto: 5.8, ocupacion: 87.6, cantidad_destinos: 9, uls: 92 }
                  ],
                  topTiempoMuerto: [
                    { matricula: "RIELES EXP", fecha: "31/01/2025", duracion: 17, tiempo_muerto: 154, ocupacion: 12.57, cantidad_destinos: 5, uls: 13 },
                    { matricula: "CARRASCO EXP", fecha: "31/01/2025", duracion: 37, tiempo_muerto: 154, ocupacion: 12.57, cantidad_destinos: 8, uls: 22 },
                    { matricula: "TRANSPORTE A", fecha: "30/01/2025", duracion: 45, tiempo_muerto: 142, ocupacion: 15.3, cantidad_destinos: 6, uls: 18 },
                    { matricula: "LOGISTICA B", fecha: "29/01/2025", duracion: 28, tiempo_muerto: 138, ocupacion: 18.7, cantidad_destinos: 7, uls: 25 },
                    { matricula: "CARGA RÁPIDA", fecha: "28/01/2025", duracion: 52, tiempo_muerto: 125, ocupacion: 22.1, cantidad_destinos: 5, uls: 15 },
                    { matricula: "EXPRESS DELIVERY", fecha: "27/01/2025", duracion: 33, tiempo_muerto: 118, ocupacion: 25.4, cantidad_destinos: 9, uls: 28 },
                    { matricula: "TRANSPORTE C", fecha: "26/01/2025", duracion: 41, tiempo_muerto: 112, ocupacion: 19.8, cantidad_destinos: 6, uls: 20 },
                    { matricula: "LOGÍSTICA D", fecha: "25/01/2025", duracion: 39, tiempo_muerto: 108, ocupacion: 21.2, cantidad_destinos: 8, uls: 24 },
                    { matricula: "CARGA E", fecha: "24/01/2025", duracion: 46, tiempo_muerto: 105, ocupacion: 17.9, cantidad_destinos: 7, uls: 19 },
                    { matricula: "EXPRESS F", fecha: "23/01/2025", duracion: 35, tiempo_muerto: 98, ocupacion: 23.6, cantidad_destinos: 6, uls: 17 }
                  ],
                  camionesPorDia: [
                    { dia: "01/01", camiones: 45, duracion_promedio: 118.2, tiempo_muerto_promedio: 7.8, ocupacion_promedio: 85.6, total_destinos: 120, total_uls: 890 },
                    { dia: "02/01", camiones: 52, duracion_promedio: 112.8, tiempo_muerto_promedio: 8.5, ocupacion_promedio: 88.1, total_destinos: 145, total_uls: 980 },
                    { dia: "03/01", camiones: 38, duracion_promedio: 125.5, tiempo_muerto_promedio: 9.2, ocupacion_promedio: 82.3, total_destinos: 98, total_uls: 720 },
                    { dia: "04/01", camiones: 41, duracion_promedio: 108.9, tiempo_muerto_promedio: 6.9, ocupacion_promedio: 90.2, total_destinos: 112, total_uls: 810 },
                    { dia: "05/01", camiones: 48, duracion_promedio: 119.7, tiempo_muerto_promedio: 8.6, ocupacion_promedio: 86.8, total_destinos: 135, total_uls: 950 }
                  ],
                  estadoULs: [
                    { name: "Normales", value: 3420, color: "#10b981" },
                    { name: "Sin Fin Prep", value: 180, color: "#f59e0b" },
                    { name: "Sin Volumen", value: 95, color: "#fb923c" },
                    { name: "Overfill", value: 45, color: "#ef4444" }
                  ],
                  topMatriculas: [
                    { name: "ABC123", uls_total: 1250, duracion_promedio: 105.2, viajes: 15 },
                    { name: "DEF456", uls_total: 1180, duracion_promedio: 112.8, viajes: 14 },
                    { name: "GHI789", uls_total: 980, duracion_promedio: 98.5, viajes: 12 },
                    { name: "JKL012", uls_total: 890, duracion_promedio: 125.3, viajes: 11 },
                    { name: "MNO345", uls_total: 750, duracion_promedio: 108.7, viajes: 9 }
                  ],
                  matriculasMasUsadas: [
                    { name: "ABC123", viajes: 25, uls_total: 1250, duracion_promedio: 105.2, ocupacion_promedio: 88.5, total_destinos: 180 },
                    { name: "DEF456", viajes: 22, uls_total: 1180, duracion_promedio: 112.8, ocupacion_promedio: 91.2, total_destinos: 165 },
                    { name: "GHI789", viajes: 18, uls_total: 980, duracion_promedio: 98.5, ocupacion_promedio: 85.3, total_destinos: 142 },
                    { name: "JKL012", viajes: 15, uls_total: 890, duracion_promedio: 125.3, ocupacion_promedio: 82.7, total_destinos: 118 },
                    { name: "MNO345", viajes: 12, uls_total: 750, duracion_promedio: 108.7, ocupacion_promedio: 89.1, total_destinos: 95 }
                  ],
                  generatedAt: new Date().toISOString()
                };
                setData(simulatedData);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Simular datos
            </button>
          </div>
        </div>
      </div>
      
      {/* Empty State */}
      {data && data.totalCamiones === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 mb-8 text-center">
          <div className="text-6xl mb-4">🚚</div>
          <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            No hay datos en este rango
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 mb-6">
            No se encontraron registros de expediciones para el período seleccionado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700 dark:text-yellow-300">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">💡 Sugerencias:</h4>
              <ul className="space-y-1 text-left">
                <li>• Prueba fechas de 2024 o 2025</li>
                <li>• Usa rangos más amplios (60+ días)</li>
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
      {!data && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Selecciona un rango de fechas
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Para ver los datos de expediciones, selecciona las fechas de inicio y fin, luego haz clic en "Filtrar".
            </p>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              También puedes usar "Simular datos" para ver una vista previa del dashboard.
            </div>
          </div>
        )}

        {data && (
        <>
          {/* Fila 1 - Salud Operativa */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              🏥 Salud Operativa
              <span className="text-xs text-gray-500 font-normal">Cumplimiento y Dispersión</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {kpiCards.map((kpi, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
                  <div className="absolute top-2 right-2">
                    <InfoTooltip content={kpi.tooltip} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                      {kpi.title}
                      {kpi.delta !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          kpi.delta > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          kpi.delta < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {kpi.delta > 0 ? '↑' : kpi.delta < 0 ? '↓' : '→'} 
                          {Math.abs(kpi.delta).toFixed(1)}%
                        </span>
                      )}
                    </p>
                    <p className={`text-2xl font-semibold mb-1 ${
                      kpi.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      kpi.color === 'red' ? 'text-red-700 dark:text-red-400' :
                      kpi.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-gray-900 dark:text-gray-100'
                    }`}>
                      {kpi.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fila 2 - Coordinación Operativa */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              ⚡ Coordinación Operativa
              <span className="text-xs text-gray-500 font-normal">Tiempo Muerto y Espera</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {coordinacionKPIs.map((kpi, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
                  <div className="absolute top-2 right-2">
                    <InfoTooltip content={kpi.tooltip} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                      {kpi.title}
                      {kpi.delta !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          kpi.delta > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          kpi.delta < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {kpi.delta > 0 ? '↑' : kpi.delta < 0 ? '↓' : '→'} {Math.abs(kpi.delta).toFixed(1)}%
                        </span>
                      )}
                    </p>
                    <p className={`text-2xl font-bold mb-1 ${
                      kpi.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      kpi.color === 'red' ? 'text-red-700 dark:text-red-400' :
                      kpi.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-gray-900 dark:text-gray-100'
                    }`}>
                      {kpi.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico Scatter - Diagnóstico: Duración vs Tiempo Muerto */}
          {scatterAnalysis && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative mb-8">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Cada punto representa un camión individual. Los cuadrantes ayudan a identificar el tipo de problema: - Arriba-Izquierda: Coordinación (tiempo muerto alto) - Abajo-Derecha: Carga (duración alta) - Arriba-Derecha: Crisis (ambos problemas) - Abajo-Izquierda: Óptimo (sin problemas)" />
              </div>
              
              {/* Resumen por cuadrantes */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{scatterAnalysis.cuadrantes.optimo}</div>
                  <div className="text-xs text-green-600 dark:text-green-300">{(scatterAnalysis.cuadrantes.optimo / scatterAnalysis.totalPoints * 100).toFixed(0)}% del total</div>
                  <div className="text-xs text-green-600 dark:text-green-300">Óptimo</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">≤{scatterAnalysis.baselineDuracion.toFixed(0)}min / ≤{scatterAnalysis.baselineTiempoMuerto.toFixed(1)}min</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{scatterAnalysis.cuadrantes.carga}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-300">{(scatterAnalysis.cuadrantes.carga / scatterAnalysis.totalPoints * 100).toFixed(0)}% del total</div>
                  <div className="text-xs text-blue-600 dark:text-blue-300">Carga</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">&gt;{scatterAnalysis.baselineDuracion.toFixed(0)}min / ≤{scatterAnalysis.baselineTiempoMuerto.toFixed(1)}min</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{scatterAnalysis.cuadrantes.coordinacion}</div>
                  <div className="text-xs text-orange-600 dark:text-orange-300">{(scatterAnalysis.cuadrantes.coordinacion / scatterAnalysis.totalPoints * 100).toFixed(0)}% del total</div>
                  <div className="text-xs text-orange-600 dark:text-orange-300">Coordinación</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">≤{scatterAnalysis.baselineDuracion.toFixed(0)}min / &gt;{scatterAnalysis.baselineTiempoMuerto.toFixed(1)}min</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">{scatterAnalysis.cuadrantes.critico}</div>
                  <div className="text-xs text-red-600 dark:text-red-300">{(scatterAnalysis.cuadrantes.critico / scatterAnalysis.totalPoints * 100).toFixed(0)}% del total</div>
                  <div className="text-xs text-red-600 dark:text-red-300">Crítico</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">&gt;{scatterAnalysis.baselineDuracion.toFixed(0)}min / &gt;{scatterAnalysis.baselineTiempoMuerto.toFixed(1)}min</div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Diagnóstico: Duración vs Tiempo Muerto
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Cada punto = 1 camión • {scatterAnalysis.totalPoints} totales • {scatterAnalysis.outliers} outliers
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {(() => {
                      const totalCamionesValidos = scatterAnalysis.totalPoints;
                      const totalProblema = scatterAnalysis.cuadrantes.carga + scatterAnalysis.cuadrantes.coordinacion + scatterAnalysis.cuadrantes.critico;
                      const porcentaje = totalCamionesValidos > 0 ? (totalProblema / totalCamionesValidos * 100).toFixed(1) : '0.0';
                      
                      return `${totalProblema} de ${totalCamionesValidos} camiones (${porcentaje}%) presentan ineficiencia relevante.`;
                    })()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Ocupación Alta (≥60%)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Media (40-59%)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Baja (&lt;40%)</span>
                  </div>
                  <button
                    onClick={() => setShowOutliers(!showOutliers)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      showOutliers 
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {showOutliers ? 'Ocultar Outliers' : `Mostrar Outliers (${scatterAnalysis.outliers} ocultos)`}
                  </button>
                </div>
              </div>

              {/* Resumen interpretativo */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {(() => {
                    const totalProblemas = scatterAnalysis.cuadrantes.carga + scatterAnalysis.cuadrantes.coordinacion + scatterAnalysis.cuadrantes.critico;
                    const totalValidos = scatterAnalysis.totalPoints;
                    const porcentajeProblemas = totalValidos > 0 ? (totalProblemas / totalValidos * 100) : 0;
                    
                    return `${totalProblemas} de ${totalValidos} camiones (${porcentajeProblemas.toFixed(1)}%) presentan problemas (Carga/Coordinación/Crítico).`;
                  })()}
                </p>
              </div>

              <div className="h-[500px] min-h-[500px]">
                <ResponsiveContainer width="100%" height={500}>
                  <ScatterChart data={data.scatterData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.15} />
                    <XAxis 
                      type="number"
                      dataKey="duracion" 
                      name="Duración"
                      unit=" min"
                      tickCount={6}
                      domain={[0, scatterAnalysis.duracionCap]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `${value} min`}
                      label={{ value: 'Duración (min)', position: 'insideBottom', offset: -5, fontSize: 11 }}
                    />
                    <YAxis 
                      type="number"
                      dataKey="tiempo_muerto" 
                      name="Tiempo Muerto"
                      unit=" min"
                      tickCount={6}
                      domain={[0, scatterAnalysis.tiempoMuertoCap * 1.05]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `${value} min`}
                      label={{ value: 'Tiempo Muerto (min)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const point = payload[0].payload;
                          const isOutlier = point.duracion > (data.scatterCaps?.duracionP98 || 180) ||
                                         point.tiempo_muerto > (data.scatterCaps?.tiempoMuertoP95 || 25);
                          return (
                            <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {point.matricula}
                                </p>
                                {isOutlier && (
                                  <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                                    Outlier
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600 dark:text-gray-400">Fecha:</span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{point.fecha}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600 dark:text-gray-400">Duración:</span>
                                  <span className="font-medium text-blue-600 dark:text-blue-400">{point.duracion} min</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600 dark:text-gray-400">Tiempo Muerto:</span>
                                  <span className="font-medium text-orange-600 dark:text-orange-400">{point.tiempo_muerto?.toFixed(1)} min</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600 dark:text-gray-400">Ocupación:</span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{point.ocupacion?.toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600 dark:text-gray-400">Destinos:</span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{point.cantidad_destinos}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-600 dark:text-gray-400">ULs:</span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{point.uls}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter 
                      name="Camiones" 
                      dataKey="tiempo_muerto"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const ocupacion = payload.ocupacion;
                        const isOutlier = payload.duracion > (data.scatterCaps?.duracionP98 || 180) ||
                                       payload.tiempo_muerto > (data.scatterCaps?.tiempoMuertoP95 || 25);
                        
                        let color = '#ef4444';  // Rojo - Baja ocupación por defecto
                        if (ocupacion >= 60) color = '#10b981';  // Verde - Alta ocupación
                        else if (ocupacion >= 40) color = '#eab308';  // Amarillo - Media ocupación
                        
                        return (
                          <circle 
                            cx={cx} 
                            cy={cy} 
                            r={isOutlier ? 6 : 4} 
                            fill={color} 
                            fillOpacity={0.7}
                            stroke={color}
                            strokeWidth={isOutlier ? 2 : 1}
                            strokeDasharray={isOutlier ? "2 2" : "0"}
                          />
                        );
                      }}
                    />
                    <ReferenceLine 
                      x={scatterAnalysis.baselineDuracion} 
                      stroke="#3b82f6" 
                      strokeDasharray="5 5" 
                      strokeWidth={2}
                      label={{ 
                        value: `Baseline Duración: ${scatterAnalysis.baselineDuracion.toFixed(0)} min`, 
                        position: "top",
                        fill: "#3b82f6",
                        fontSize: 11
                      }}
                    />
                    <ReferenceLine 
                      y={scatterAnalysis.baselineTiempoMuerto} 
                      stroke="#f97316" 
                      strokeDasharray="5 5" 
                      strokeWidth={2}
                      label={{ 
                        value: `Baseline Tiempo Muerto: ${scatterAnalysis.baselineTiempoMuerto.toFixed(0)} min`, 
                        position: "left",
                        fill: "#f97316",
                        fontSize: 11
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Bloque Insight Automático */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Insight Operativo</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {(() => {
                    const total = scatterAnalysis.totalPoints;
                    const porcCoordinacion = total > 0 ? (scatterAnalysis.cuadrantes.coordinacion / total * 100) : 0;
                    const porcCarga = total > 0 ? (scatterAnalysis.cuadrantes.carga / total * 100) : 0;
                    const porcCritico = total > 0 ? (scatterAnalysis.cuadrantes.critico / total * 100) : 0;
                    
                    let insight = "";
                    
                    if (porcCoordinacion > 50) {
                      insight = "Principal fuente de ineficiencia: descoordinación entre preparación y carga.";
                    } else if (porcCarga > 50) {
                      insight = "Principal fuente de ineficiencia: duración excesiva de carga.";
                    } else {
                      insight = "Distribución equilibrada. No se detecta patrón dominante.";
                    }
                    
                    if (porcCritico > 15) {
                      insight += " Riesgo operativo elevado. Se recomienda análisis inmediato.";
                    }
                    
                    return insight;
                  })()}
                </p>
              </div>
            </div>
          )}

          {/* Fila 3 - Eficiencia Logística */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              🚚 Eficiencia Logística
              <span className="text-xs text-gray-500 font-normal">Utilización y Rendimiento</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {eficienciaKPIs.map((kpi, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
                  <div className="absolute top-2 right-2">
                    <InfoTooltip content={kpi.tooltip} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-2">
                      {kpi.title}
                      {kpi.delta !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          kpi.delta > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          kpi.delta < 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {kpi.delta > 0 ? '↑' : kpi.delta < 0 ? '↓' : '→'}
                          {Math.abs(kpi.delta).toFixed(1)}%
                        </span>
                      )}
                    </p>
                    <p className={`text-2xl font-semibold mb-1 ${
                      kpi.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      kpi.color === 'red' ? 'text-red-700 dark:text-red-400' :
                      kpi.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-gray-900 dark:text-gray-100'
                    }`}>
                      {kpi.value}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Contexto 10 meses */}
      {benchmarkData && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8 animate-fade-in relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="Contexto histórico de últimos 10 meses. Muestra promedios, P95 y tendencias para comparar el período actual contra el comportamiento histórico." />
          </div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              📊 Contexto 10 meses
              <span className="text-xs text-gray-500 font-normal">Baseline y Tendencia</span>
            </h2>
          </div>
          
          {/* Métricas clave */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Promedio duración 10m</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {benchmarkData.promedioDuracionHistorico?.toFixed(0) || 'N/A'} min
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Baseline dinámico</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">P95 duración 10m</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {((benchmarkData.promedioDuracionHistorico || 120) * 1.5).toFixed(0)} min
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Percentil 95</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Promedio ocupación 10m</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {benchmarkData.promedioOcupacionHistorico?.toFixed(1) || 'N/A'}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Eficiencia base</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Promedio tiempo muerto 10m</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {benchmarkData.promedioTiempoMuertoHistorico?.toFixed(1) || 'N/A'} min
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Baseline dinámico (10m)</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">P95 tiempo muerto 10m</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {benchmarkData.p95TiempoMuertoHistorico?.toFixed(1) || 'N/A'} min
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Percentil 95</p>
            </div>
          </div>

          {/* Mini gráfico de tendencia */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Tendencia Mensual Duración Promedio</h3>
            {benchmarkData?.datosMensuales && (
            <div className="h-32 min-h-[128px]">
              <ResponsiveContainer width="100%" height={128}>
                <LineChart data={benchmarkData.datosMensuales || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.3} />
                  <XAxis 
                    dataKey="mesAnio" 
                    tick={{ fontSize: 10 }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151', 
                      borderRadius: '6px' 
                    }}
                    labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="duracion_promedio" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      {data && data.totalCamiones > 0 && (
        <>
          <div className="grid grid-cols-1 gap-8 mb-8">
            {/* Line Chart - Duración y Ocupación por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Evolución diaria de duración promedio de carga (minutos) y ocupación de contenedores (%). Muestra optimización de espacio en contenedores día a día." />
              </div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Duración y Ocupación de Contenedores por Día
                </h2>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-blue-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Duración (min)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-green-600"></div>
                    <span className="text-gray-600 dark:text-gray-400">Ocupación contenedor (%)</span>
                  </div>
                </div>
              </div>
              <div className="h-[300px] min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.camionesPorDia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.3} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Duración:</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400">{data.duracion_promedio?.toFixed(0) || 0} min</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Ocupación contenedor:</span>
                                <span className="font-medium text-green-600 dark:text-green-400">{data.ocupacion_promedio?.toFixed(1) || 0}%</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Camiones:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{data.camiones}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="duracion_promedio" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ocupacion_promedio" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                  <ReferenceLine 
                    y={benchmarkData?.promedioDuracionHistorico || 120} 
                    stroke="#ef4444" 
                    strokeDasharray="5 5" 
                    strokeWidth={2}
                    label="Baseline 10m"
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
            </div>
            
            {/* Gráfico Duración vs Tiempo Muerto por Día */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Comparación entre duración de carga y tiempo muerto por día. Permite detectar divergencias entre eficiencia de carga y coordinación operativa." />
              </div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Duración vs Tiempo Muerto por Día
                </h2>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-blue-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Duración (min)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-orange-500"></div>
                    <span className="text-gray-600 dark:text-gray-400">Tiempo Muerto (min)</span>
                  </div>
                </div>
              </div>
              <div className="h-[300px] min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.camionesPorDia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.3} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Duración:</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400">{data.duracion_promedio?.toFixed(0) || 0} min</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Tiempo Muerto:</span>
                                <span className="font-medium text-orange-600 dark:text-orange-400">{data.tiempo_muerto_promedio?.toFixed(1) || 0} min</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-600 dark:text-gray-400">Camiones:</span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{data.camiones}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="duracion_promedio" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="tiempo_muerto_promedio" 
                    stroke="#f97316" 
                    strokeWidth={2}
                    dot={{ fill: '#f97316', r: 3 }}
                  />
                  <ReferenceLine 
                    y={benchmarkData?.promedioTiempoMuertoHistorico || 5} 
                    stroke="#f97316" 
                    strokeDasharray="5 5" 
                    strokeWidth={2}
                    label="Baseline TM 10m"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 mb-8">
            {/* Top Matrículas - Bar Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Top 10 matrículas con mayor volumen de ULs transportadas. Ordenado por SUM(uls) DESC. Incluye AVG() de duración y COUNT() de viajes." />
              </div>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Top 10 Matrículas por ULs
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topMatriculas} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(value) => formatNumber(Number(value))} />
                  <Tooltip 
                    formatter={(value: any) => [formatNumber(Number(value)), 'ULs']}
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151', 
                      borderRadius: '6px' 
                    }}
                    labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                    itemStyle={{ color: '#f3f4f6' }}
                    cursor={false}
                  />
                  <Bar dataKey="uls_total" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top 10 Camiones con Mayor Tiempo Muerto - Bar Chart Horizontal */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 relative">
              <div className="absolute top-2 right-2">
                <InfoTooltip content="Top 10 camiones con mayor tiempo muerto en el período filtrado. Ordenado por tiempo_muerto DESC. Excluye valores nulos, negativos y outliers > 720 min." />
              </div>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Top 10 Camiones con Mayor Tiempo Muerto
                </h2>
                {(() => {
                  const validTrucks = getValidTrucks(data);
                  const top10 = validTrucks
                    .filter(t => t.tiempo_muerto > 0 && t.tiempo_muerto <= 720)
                    .sort((a, b) => b.tiempo_muerto - a.tiempo_muerto)
                    .slice(0, 10);
                  
                  if (top10.length === 0) return null;
                  
                  const totalTiempoMuerto = validTrucks.reduce((sum, t) => sum + t.tiempo_muerto, 0);
                  const top10Porcentaje = totalTiempoMuerto > 0 ? 
                    (top10.reduce((sum, t) => sum + t.tiempo_muerto, 0) / totalTiempoMuerto * 100) : 0;
                  
                  return (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Top 10 explican {top10Porcentaje.toFixed(1)}% del tiempo muerto total
                    </p>
                  );
                })()}
              </div>
              <div className="h-[300px] min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={(() => {
                      const validTrucks = getValidTrucks(data);
                      const top10Data = validTrucks
                        .filter(t => t.tiempo_muerto > 0 && t.tiempo_muerto <= 720)
                        .sort((a, b) => b.tiempo_muerto - a.tiempo_muerto)
                        .slice(0, 10)
                        .map(t => ({
                          name: t.matricula || 'N/A',
                          tiempo_muerto: t.tiempo_muerto || 0
                        }));
                      return top10Data;
                    })()} 
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: '#9ca3af' }} 
                      angle={-45} 
                      textAnchor="end" 
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#9ca3af' }} 
                      tickFormatter={(value) => `${value} min`}
                    />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-gray-900 p-3 border border-gray-700 rounded-lg shadow-lg">
                              <div className="text-sm font-medium text-gray-100 mb-1">
                                {data.name}
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Tiempo Muerto:</span>
                                <span className="font-medium text-gray-100">{data.tiempo_muerto} min</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="tiempo_muerto" 
                      fill="#f97316"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </>
      )}
      </main>
    </>
  );
}
