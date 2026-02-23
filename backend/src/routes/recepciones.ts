import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { getPool } from "../db";
import { calculateBenchmark, calculateValuePercentile, classifyPercentile, BenchmarkStats, percentile, mean, standardDeviation } from "../utils/stats";

export default async function recepcionesRoute(fastify: FastifyInstance) {
  // Endpoint para obtener datos de recepciones
  fastify.get('/recepciones', async (request, reply) => {
    try {
      const { fechaInicio, fechaFin, proveedor, sku } = request.query as {
        fechaInicio?: string;
        fechaFin?: string;
        proveedor?: string;
        sku?: string;
      };

      // Validar parámetros requeridos
      if (!fechaInicio || !fechaFin) {
        return reply.status(400).send({
          error: {
            message: 'Faltan parámetros requeridos: fechaInicio, fechaFin'
          }
        });
      }

      // Convertir fechas del formato YYYYMMDD a YYYY-MM-DD
      const from_date = `${fechaInicio.substring(0, 4)}-${fechaInicio.substring(4, 6)}-${fechaInicio.substring(6, 8)}`;
      const to_date = `${fechaFin.substring(0, 4)}-${fechaFin.substring(4, 6)}-${fechaFin.substring(6, 8)}`;
      
      // Agregar un día al to_date para hacer el rango SARGable (fecha < to_date + 1)
      const to_date_next = new Date(to_date);
      to_date_next.setDate(to_date_next.getDate() + 1);
      const to_date_next_str = to_date_next.toISOString().split('T')[0];
      
      console.log('=== RECEPCIONES REQUEST ===');
      console.log('Params:', { fechaInicio, fechaFin, proveedor, sku });
      console.log('Dates:', { from_date, to_date, to_date_next_str });
      console.log('Starting query execution...');
      
      // Helper para medir tiempo de queries
      const executeWithTiming = async (queryName: string, queryFn: Promise<any>) => {
        const startTime = Date.now();
        console.log(`[${queryName}] Starting...`);
        try {
          const result = await queryFn;
          const duration = Date.now() - startTime;
          console.log(`[${queryName}] COMPLETED: ${duration}ms, Rows: ${result.recordset.length}`);
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`[${queryName}] ERROR after ${duration}ms:`, error);
          throw error;
        }
      };

      // Helper para crear request con timeout limpio
      const createTimedRequest = () => {
        const req = connection.request();
        (req as any).timeout = 60000;
        req.input('from_date_param', sql.Date, from_date);
        req.input('to_date_next_param', sql.Date, to_date_next_str);
        req.input('proveedor_param', sql.NVarChar, proveedor ? `%${proveedor}%` : '');
        req.input('sku_param', sql.NVarChar, sku ? `%${sku}%` : '');
        return req;
      };

      // Obtener conexión a la base de datos con timeout específico
      const connection = await getPool();

      // 1. ULs recepcionadas por día (pallets) - QUERY OPTIMIZADA
      const ulsPorDiaQuery = `
        SELECT 
          CONVERT(varchar, fecha_operativa, 103) as fecha,
          FORMAT(fecha_operativa, 'dd/MM') as dia,
          SUM(COALESCE(pallets, 0)) as uls
        FROM bi.fact_recepcion_sku WITH (NOLOCK)
        WHERE fecha_operativa >= @from_date_param
          AND fecha_operativa < @to_date_next_param
        GROUP BY fecha_operativa, FORMAT(fecha_operativa, 'dd/MM'), CONVERT(varchar, fecha_operativa, 103)
        ORDER BY fecha_operativa
        OPTION (RECOMPILE)
      `;

      // 2. Cajas recepcionadas por día (cantidad_cajas) - QUERY OPTIMIZADA
      const cajasPorDiaQuery = `
        SELECT 
          CONVERT(varchar, fecha_operativa, 103) as fecha,
          FORMAT(fecha_operativa, 'dd/MM') as dia,
          SUM(COALESCE(cantidad_cajas, 0)) as cajas
        FROM bi.fact_recepcion_sku WITH (NOLOCK)
        WHERE fecha_operativa >= @from_date_param
          AND fecha_operativa < @to_date_next_param
        GROUP BY fecha_operativa, FORMAT(fecha_operativa, 'dd/MM'), CONVERT(varchar, fecha_operativa, 103)
        ORDER BY fecha_operativa
        OPTION (RECOMPILE)
      `;

      // 3. Tiempo medio de recepción por día (inicio_dt → fin_dt en horas) - QUERY OPTIMIZADA
      const tiempoRecepcionPorDiaQuery = `
        SELECT 
          CONVERT(varchar, fecha_operativa, 103) as fecha,
          FORMAT(fecha_operativa, 'dd/MM') as dia,
          AVG(DATEDIFF(minute, inicio_dt, fin_dt) / 60.0) as tiempo_promedio_horas
        FROM bi.fact_recepcion_sku WITH (NOLOCK)
        WHERE fecha_operativa >= @from_date_param
          AND fecha_operativa < @to_date_next_param
          AND inicio_dt IS NOT NULL 
          AND fin_dt IS NOT NULL
        GROUP BY fecha_operativa, FORMAT(fecha_operativa, 'dd/MM'), CONVERT(varchar, fecha_operativa, 103)
        ORDER BY fecha_operativa
        OPTION (RECOMPILE)
      `;

      // 4. Tiempo medio de estadía camión por día (camion_entrada_dt → camion_salida_dt en horas) - QUERY OPTIMIZADA
      const tiempoCamionPorDiaQuery = `
        SELECT 
          CONVERT(varchar, fecha_operativa, 103) as fecha,
          FORMAT(fecha_operativa, 'dd/MM') as dia,
          AVG(DATEDIFF(minute, camion_entrada_dt, camion_salida_dt) / 60.0) as tiempo_promedio_horas
        FROM bi.fact_recepcion_sku WITH (NOLOCK)
        WHERE fecha_operativa >= @from_date_param
          AND fecha_operativa < @to_date_next_param
          AND camion_entrada_dt IS NOT NULL 
          AND camion_salida_dt IS NOT NULL
        GROUP BY fecha_operativa, FORMAT(fecha_operativa, 'dd/MM'), CONVERT(varchar, fecha_operativa, 103)
        ORDER BY fecha_operativa
        OPTION (RECOMPILE)
      `;

      // 5. Recepciones por sector (torta con SUM(pallets)) - QUERY OPTIMIZADA
      const recepcionesPorSeccionQuery = `
        SELECT 
          LTRIM(RTRIM(sector_desc)) as sector,
          SUM(COALESCE(pallets, 0)) as uls
        FROM bi.fact_recepcion_sku WITH (NOLOCK)
        WHERE fecha_operativa >= @from_date_param
          AND fecha_operativa < @to_date_next_param
        GROUP BY LTRIM(RTRIM(sector_desc))
        ORDER BY uls DESC
        OPTION (RECOMPILE)
      `;

      // 6. KPIs ponderados del período (promedio real por evento) - QUERY NUEVA
      const kpisPeriodoQuery = `
        SELECT 
          recepcion_avg_h = AVG(CASE WHEN inicio_dt IS NOT NULL AND fin_dt IS NOT NULL 
            THEN DATEDIFF(minute, inicio_dt, fin_dt) / 60.0 ELSE NULL END),
          recepcion_eventos = COUNT(CASE WHEN inicio_dt IS NOT NULL AND fin_dt IS NOT NULL THEN 1 ELSE NULL END),
          camion_avg_h = AVG(CASE WHEN camion_entrada_dt IS NOT NULL AND camion_salida_dt IS NOT NULL 
            THEN DATEDIFF(minute, camion_entrada_dt, camion_salida_dt) / 60.0 ELSE NULL END),
          camion_eventos = COUNT(CASE WHEN camion_entrada_dt IS NOT NULL AND camion_salida_dt IS NOT NULL THEN 1 ELSE NULL END)
        FROM bi.fact_recepcion_sku WITH (NOLOCK)
        WHERE fecha_operativa >= @from_date_param
          AND fecha_operativa < @to_date_next_param
          AND (
            (inicio_dt IS NOT NULL AND fin_dt IS NOT NULL) OR
            (camion_entrada_dt IS NOT NULL AND camion_salida_dt IS NOT NULL)
          )
        OPTION (RECOMPILE)
      `;

      // Ejecutar todas las queries en paralelo con instrumentación
      const [ulsResult, cajasResult, tiempoRecepcionResult, tiempoCamionResult, seccionResult] = await Promise.all([
        executeWithTiming('ULS_POR_DIA', createTimedRequest().query(ulsPorDiaQuery)),
        
        executeWithTiming('CAJAS_POR_DIA', createTimedRequest().query(cajasPorDiaQuery)),
        
        executeWithTiming('TIEMPO_RECEPCION_POR_DIA', createTimedRequest().query(tiempoRecepcionPorDiaQuery)),
        
        executeWithTiming('TIEMPO_CAMION_POR_DIA', createTimedRequest().query(tiempoCamionPorDiaQuery)),
        
        executeWithTiming('RECEPCIONES_POR_SECCION', createTimedRequest().query(recepcionesPorSeccionQuery))
      ]);

      // Ejecutar query de KPIs por separado
      const kpisPeriodoResult = await executeWithTiming('KPIS_PERIODO', createTimedRequest().query(kpisPeriodoQuery));

      console.log('Queries ejecutadas:', {
        uls: ulsResult.recordset.length,
        cajas: cajasResult.recordset.length,
        tiempoRecepcion: tiempoRecepcionResult.recordset.length,
        tiempoCamion: tiempoCamionResult.recordset.length,
        seccion: seccionResult.recordset.length,
        kpisPeriodo: kpisPeriodoResult.recordset.length
      });

      // Formatear datos para el frontend
      const ulsPorDia = ulsResult.recordset.map((row: any) => ({
        fecha: row.fecha,
        dia: row.dia,
        uls: parseFloat(row.uls || 0)
      }));

      const cajasPorDia = cajasResult.recordset.map((row: any) => ({
        fecha: row.fecha,
        dia: row.dia,
        cajas: parseFloat(row.cajas || 0)
      }));

      const tiempoRecepcionPorDia = tiempoRecepcionResult.recordset.map((row: any) => ({
        fecha: row.fecha,
        dia: row.dia,
        tiempo_promedio_horas: parseFloat(row.tiempo_promedio_horas || 0)
      }));

      const tiempoCamionPorDia = tiempoCamionResult.recordset.map((row: any) => ({
        fecha: row.fecha,
        dia: row.dia,
        tiempo_promedio_horas: parseFloat(row.tiempo_promedio_horas || 0)
      }));

      const recepcionesPorSeccion = seccionResult.recordset.map((row: any) => ({
        sector: row.sector || 'Sin Sector',
        uls: parseFloat(row.uls || 0),
        porcentaje: 0 // Se calculará después
      }));

      // Calcular porcentajes para el gráfico de torta
      const totalUls = recepcionesPorSeccion.reduce((sum: number, item: any) => sum + item.uls, 0);
      recepcionesPorSeccion.forEach((item: any) => {
        item.porcentaje = totalUls > 0 ? (item.uls / totalUls) * 100 : 0;
      });

      // Calcular totales para KPIs
      const totalUlsPeriodo = ulsPorDia.reduce((sum: number, item: any) => sum + item.uls, 0);
      const totalCajasPeriodo = cajasPorDia.reduce((sum: number, item: any) => sum + item.cajas, 0);
      const totalDiasConRecepcion = ulsPorDia.length;
      const tiempoPromedioRecepcion = tiempoRecepcionPorDia.length > 0 
        ? tiempoRecepcionPorDia.reduce((sum: number, item: any) => sum + item.tiempo_promedio_horas, 0) / tiempoRecepcionPorDia.length 
        : 0;

      // Calcular benchmarks estadísticos
      const tiempoRecepcionValues = tiempoRecepcionPorDia.map((d: any) => d.tiempo_promedio_horas).filter((v: number) => v > 0);
      const tiempoCamionValues = tiempoCamionPorDia.map((d: any) => d.tiempo_promedio_horas).filter((v: number) => v > 0);
      
      const benchmarkRecepcion = calculateBenchmark(tiempoRecepcionValues);
      const benchmarkCamion = calculateBenchmark(tiempoCamionValues);

      // Función para calcular benchmark robusto (winsorizado P10-P90)
      const calculateBenchmarkRobust = (values: number[]): BenchmarkStats | null => {
        if (!values || values.length < 5) return null; // Mínimo 5 valores
        
        const p10 = percentile(values, 10) || 0;
        const p90 = percentile(values, 90) || 0;
        
        // Winsorizar: limitar valores al rango P10-P90
        const winsorized = values.map(v => Math.min(Math.max(v, p10), p90));
        
        // Calcular estadísticas sobre valores winsorizados
        const avg = mean(winsorized) || 0;
        const stddev = standardDeviation(winsorized) || 0;
        
        return {
          promedio: avg,
          mediana: percentile(winsorized, 50) || 0,
          p25: percentile(winsorized, 25) || 0,
          p75: percentile(winsorized, 75) || 0,
          p10: p10,
          p90: p90,
          stddev: stddev,
          cv: avg > 0 ? (stddev / avg) * 100 : 0
        };
      };

      // Calcular benchmarks robustos
      const benchmarkRecepcionRobust = calculateBenchmarkRobust(tiempoRecepcionValues);
      const benchmarkCamionRobust = calculateBenchmarkRobust(tiempoCamionValues);

      // Contar outliers para estadísticas
      const outliersCamionHigh = benchmarkCamion ? 
        tiempoCamionValues.filter(v => v > benchmarkCamion.p90).length : 0;
      const outliersCamionLow = benchmarkCamion ? 
        tiempoCamionValues.filter(v => v < benchmarkCamion.p10).length : 0;

      // Procesar KPIs ponderados del período
      const kpisPeriodoRaw = kpisPeriodoResult.recordset[0] || {};
      const kpisPeriodo = {
        recepcion_avg_h_ponderado: parseFloat(kpisPeriodoRaw.recepcion_avg_h || 0),
        recepcion_eventos: parseInt(kpisPeriodoRaw.recepcion_eventos || 0),
        camion_avg_h_ponderado: parseFloat(kpisPeriodoRaw.camion_avg_h || 0),
        camion_eventos: parseInt(kpisPeriodoRaw.camion_eventos || 0)
      };

      // Agregar detección de outliers a los datos diarios
      const tiempoRecepcionConOutliers = tiempoRecepcionPorDia.map((dia: any) => ({
        ...dia,
        esOutlier: benchmarkRecepcion && dia.tiempo_promedio_horas > benchmarkRecepcion.p90,
        esAtipico: benchmarkRecepcion && dia.tiempo_promedio_horas > (benchmarkRecepcion.promedio * 2)
      }));

      const tiempoCamionConOutliers = tiempoCamionPorDia.map((dia: any) => ({
        ...dia,
        esOutlier: benchmarkCamion && dia.tiempo_promedio_horas > benchmarkCamion.p90,
        esAtipico: benchmarkCamion && dia.tiempo_promedio_horas > (benchmarkCamion.promedio * 2)
      }));

      const response = {
        databaseName: 'MACROMERCADO',
        fechaInicio: from_date,
        fechaFin: to_date,
        filtros: {
          proveedor: proveedor || 'Todos',
          sku: sku || 'Todos'
        },
        // Datos para gráficos
        ulsPorDia,
        cajasPorDia,
        tiempoRecepcionPorDia: tiempoRecepcionConOutliers,
        tiempoCamionPorDia: tiempoCamionConOutliers,
        recepcionesPorSeccion,
        // Benchmarks estadísticos (con outliers)
        benchmarks: {
          tiempoRecepcion: benchmarkRecepcion,
          tiempoCamion: benchmarkCamion
        },
        // Benchmarks robustos (sin outliers extremos)
        benchmarks_robust: {
          tiempoRecepcion: benchmarkRecepcionRobust,
          tiempoCamion: benchmarkCamionRobust,
          metodo: "winsor_P10_P90",
          outliers_camion: {
            high_count: outliersCamionHigh,
            low_count: outliersCamionLow
          }
        },
        // KPIs originales (promedio diario)
        kpis: {
          totalUls: totalUlsPeriodo,
          totalCajas: totalCajasPeriodo,
          totalDias: totalDiasConRecepcion,
          tiempoPromedioRecepcion: tiempoPromedioRecepcion,
          totalSecciones: recepcionesPorSeccion.length
        },
        // KPIs ponderados del período (promedio real por evento)
        kpis_periodo: kpisPeriodo,
        generatedAt: new Date().toISOString()
      };

      console.log('Response prepared:', {
        totalUls: response.kpis.totalUls,
        totalCajas: response.kpis.totalCajas,
        totalDias: response.kpis.totalDias,
        tiempoPromedio: response.kpis.tiempoPromedioRecepcion,
        totalSecciones: response.kpis.totalSecciones
      });

      return reply.send(response);

    } catch (error) {
      console.error('Error en recepciones route:', error);
      return reply.status(500).send({
        error: {
          message: 'Error interno del servidor',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });
}
