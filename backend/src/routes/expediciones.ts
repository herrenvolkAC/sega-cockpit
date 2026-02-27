import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { query, getPool } from "../db";
import { ErrorResponse } from "../types";

interface ExpedicionesQuerystring {
  fechaInicio?: string;
  fechaFin?: string;
  matricula?: string;
}

const cache = new MemoryCache<any>(config.cacheTtlSeconds);

const errorResponse = (code: string, message: string): ErrorResponse => ({
  ok: false,
  error: { code, message },
});

const extractDatabaseName = (connectionString: string): string => {
  try {
    const match = connectionString.match(/Database=([^;]+)/i);
    return match ? match[1] : "Unknown";
  } catch {
    return "Unknown";
  }
};

// Convertir fecha DD/MM/YYYY a YYYY-MM-DD para SQL
const convertToSQLDate = (fechaStr: string): string => {
  if (!fechaStr) return "";
  
  // Si viene en formato YYYY-MM-DD (del input type="date")
  if (fechaStr.includes('-')) {
    return fechaStr;
  }
  
  // Si viene en formato DD/MM/YYYY
  const parts = fechaStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  
  return fechaStr;
};

export const expedicionesRoute = async (app: FastifyInstance): Promise<void> => {
  app.get(
    "/expediciones",
    async (request, reply) => {
      const startedAt = Date.now();
      const query = request.query as any;
      
      // Acceder manualmente a los parámetros
      const fechaInicio = query.fechaInicio as string;
      const fechaFin = query.fechaFin as string;
      const matricula = query.matricula as string;
      
      // Debug: Mostrar parámetros recibidos
      console.log({
        endpoint: "/expediciones",
        rawQuery: query,
        params: { fechaInicio, fechaFin, matricula }
      });
      
      // Crear condición de filtro por matrícula si se proporciona
      const matriculaCondition = matricula ? `AND matricula LIKE '%${matricula}%'` : '';
      
      console.log('Backend received:', { fechaInicio, fechaFin, matricula });
      console.log('Matricula Condition:', matriculaCondition);

      // Crear cache key basado en las fechas y matrícula
      const cacheKey = `expediciones_${fechaInicio || 'default'}_${fechaFin || 'default'}_${matricula || 'all'}`;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        request.log.info({
          endpoint: "/expediciones",
          durationMs: Date.now() - startedAt,
          cache: "hit",
          fechaInicio,
          fechaFin,
          matricula,
        });
        return cached;
      }

      try {
        // Convertir fechas o usar defaults
        const fechaInicioSQL = fechaInicio 
          ? convertToSQLDate(fechaInicio)
          : '2026-01-01'; // Default 60 días atrás
          
        const fechaFinSQL = fechaFin
          ? convertToSQLDate(fechaFin)
          : '2026-02-26'; // Default hoy

        // Validar que las fechas sean válidas
        if (!fechaInicioSQL || !fechaFinSQL) {
          const errorRes = errorResponse(
            "INVALID_DATE_RANGE",
            "Fechas inválidas"
          );
          return reply.status(400).send(errorRes);
        }

        // Ejecutar consultas con conexión directa
        const connection = await getPool();
        
        // KPIs principales
        const totalCamionesResult = await connection.request()
          .query(`SELECT COUNT(*) as total_camiones 
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}`);

        const duracionPromedioResult = await connection.request()
          .query(`SELECT AVG(duracion_carga_min) as duracion_promedio 
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' 
                     AND duracion_carga_min IS NOT NULL 
                     AND duracion_carga_min > 0 
                     AND duracion_carga_min <= 1440 ${matriculaCondition}`); // Máximo 24 horas (1440 min)

        const ocupacionPromedioResult = await connection.request()
          .query(`SELECT AVG(ocupacion_contenedores) as ocupacion_promedio 
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' 
                     AND ocupacion_contenedores IS NOT NULL ${matriculaCondition}`);

        const totalDestinosResult = await connection.request()
          .query(`SELECT SUM(cantidad_destinos) as total_destinos 
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}`);

        // Datos por día
        const camionesPorDiaResult = await connection.request()
          .query(`SELECT FORMAT(fecha, 'dd/MM') as dia,
                          COUNT(*) as camiones,
                          AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
                          AVG(ocupacion_contenedores) as ocupacion_promedio,
                          SUM(cantidad_destinos) as total_destinos,
                          SUM(uls) as total_uls
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}
                   GROUP BY fecha
                   ORDER BY fecha`);

        // Distribución de ULs por estado
        const estadoULsResult = await connection.request()
          .query(`SELECT 'Normales' as name, 
                          SUM(uls) - SUM(uls_sin_fin_prep) - SUM(uls_sin_volumen) - SUM(uls_overfill) as value,
                          '#10b981' as color
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}
                   UNION ALL
                   SELECT 'Sin Fin Prep' as name, SUM(uls_sin_fin_prep) as value, '#f59e0b' as color
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}
                   UNION ALL
                   SELECT 'Sin Volumen' as name, SUM(uls_sin_volumen) as value, '#fb923c' as color
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}
                   UNION ALL
                   SELECT 'Overfill' as name, SUM(uls_overfill) as value, '#ef4444' as color
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}`);

        // Top 10 matrículas por volumen
        const topMatriculasResult = await connection.request()
          .query(`SELECT TOP 10 matricula as name, SUM(uls) as uls_total, 
                          AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
                          COUNT(*) as viajes
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}
                   GROUP BY matricula
                   ORDER BY uls_total DESC`);

        // Matrículas más usadas en el período
        const matriculasMasUsadasResult = await connection.request()
          .query(`SELECT TOP 5 matricula as name, COUNT(*) as viajes, 
                          SUM(uls) as uls_total, AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
                          AVG(ocupacion_contenedores) as ocupacion_promedio,
                          SUM(cantidad_destinos) as total_destinos
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}
                   GROUP BY matricula
                   ORDER BY viajes DESC`);

        // Estructurar respuesta
        const response = {
          databaseName: extractDatabaseName(config.mssqlConnectionString),
          fechaInicio: fechaInicio || null,
          fechaFin: fechaFin || null,
          matricula: matricula || null,
          totalCamiones: (totalCamionesResult.recordset[0] as any)?.total_camiones || 0,
          duracionPromedio: (duracionPromedioResult.recordset[0] as any)?.duracion_promedio || 0,
          ocupacionPromedio: (ocupacionPromedioResult.recordset[0] as any)?.ocupacion_promedio || 0,
          totalDestinos: (totalDestinosResult.recordset[0] as any)?.total_destinos || 0,
          camionesPorDia: camionesPorDiaResult.recordset,
          estadoULs: estadoULsResult.recordset,
          topMatriculas: topMatriculasResult.recordset,
          matriculasMasUsadas: matriculasMasUsadasResult.recordset,
          generatedAt: new Date().toISOString()
        };

        // Cache response
        const cacheTtlValue = fechaInicio && fechaFin ? 60 : config.cacheTtlSeconds;
        
        cache.set(cacheKey, response);

        console.log({
          endpoint: "/expediciones",
          durationMs: Date.now() - startedAt,
          cache: "miss",
          fechaInicio,
          fechaFin,
          matricula,
          cacheTtl: cacheTtlValue,
        });

        return response;
      } catch (error) {
        console.error({
          endpoint: "/expediciones",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
          fechaInicio,
          fechaFin,
          matricula,
        });

        const errorRes = errorResponse(
          "DATABASE_ERROR",
          "Error al obtener datos de expediciones"
        );
        return reply.status(500).send(errorRes);
      }
    }
  );

  // Endpoint para benchmark histórico
  app.get(
    "/expediciones/benchmark",
    async (
      request: FastifyRequest<{ Querystring: ExpedicionesQuerystring }>,
      reply: FastifyReply
    ) => {
      const startedAt = Date.now();
      const { fechaInicio, fechaFin, matricula } = request.query;

      try {
        const pool = await getPool();
        const databaseName = extractDatabaseName(config.mssqlConnectionString);

        // Query para datos mensuales consolidados (últimos 10 meses)
        const monthlyQuery = `
          WITH monthly_data AS (
            SELECT
              month_start = DATEFROMPARTS(YEAR(fecha), MONTH(fecha), 1),
              total_camiones = COUNT(*),
              duracion_promedio = AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END),
              ocupacion_promedio = AVG(ocupacion_contenedores),
              total_destinos = SUM(cantidad_destinos),
              total_uls = SUM(uls)
            FROM bi.fact_carga_camion_dia WITH (NOLOCK)
            WHERE fecha >= DATEADD(MONTH, -9, GETDATE())
              AND fecha < DATEADD(MONTH, 1, GETDATE())
              ${matricula ? `AND matricula LIKE '%${matricula}%'` : ''}
            GROUP BY DATEFROMPARTS(YEAR(fecha), MONTH(fecha), 1)
          )
          SELECT TOP 10
            YEAR(month_start) as anio,
            MONTH(month_start) as mes,
            FORMAT(month_start, 'MMM-yy', 'es-AR') as mesAnio,
            total_camiones,
            duracion_promedio,
            ocupacion_promedio,
            total_destinos,
            total_uls
          FROM monthly
          ORDER BY month_start ASC
        `;

        console.log('=== MONTHLY EXPEDICIONES QUERY DEBUG ===');
        console.log('Query:', monthlyQuery);
        console.log('Matricula filter:', matricula || 'none');

        const monthlyResult = await pool.request().query(monthlyQuery);

        console.log('=== MONTHLY EXPEDICIONES RESULT DEBUG ===');
        console.log('Raw result:', monthlyResult.recordset);

        // Calcular promedios históricos
        const monthlyArray = monthlyResult.recordset as any[];
        const duracionesHistoricas = monthlyArray.map((m: any) => m.duracion_promedio || 0);
        const ocupacionesHistoricas = monthlyArray.map((m: any) => m.ocupacion_promedio || 0);
        
        const promedioDuracionHistorico = duracionesHistoricas.reduce((sum: number, dur: number) => sum + dur, 0) / duracionesHistoricas.length;
        const promedioOcupacionHistorico = ocupacionesHistoricas.reduce((sum: number, ocu: number) => sum + ocu, 0) / ocupacionesHistoricas.length;
        const mejorDuracion = Math.min(...duracionesHistoricas.filter(d => d > 0));
        const peorDuracion = Math.max(...duracionesHistoricas);
        const mejorOcupacion = Math.max(...ocupacionesHistoricas.filter(o => o > 0));
        const peorOcupacion = Math.min(...ocupacionesHistoricas.filter(o => o > 0));

        // Obtener valores actuales del período seleccionado
        let duracionActual = 0;
        let ocupacionActual = 0;
        
        if (fechaInicio && fechaFin) {
          const fechaInicioSQL = convertToSQLDate(fechaInicio);
          const fechaFinSQL = convertToSQLDate(fechaFin);

          const currentQuery = `
            SELECT 
              AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
              AVG(ocupacion_contenedores) as ocupacion_promedio
            FROM bi.fact_carga_camion_dia WITH (NOLOCK)
            WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
              ${matricula ? `AND matricula LIKE '%${matricula}%'` : ''}
          `;

          const currentResult = await pool.request().query(currentQuery);
          const currentArray = currentResult.recordset as any[];
          
          duracionActual = currentArray[0]?.duracion_promedio || 0;
          ocupacionActual = currentArray[0]?.ocupacion_promedio || 0;
        }

        // Calcular brechas
        const brechaDuracionVsPromedio = duracionActual - promedioDuracionHistorico;
        const brechaDuracionVsMejor = duracionActual - mejorDuracion;
        const brechaOcupacionVsPromedio = ocupacionActual - promedioOcupacionHistorico;
        const brechaOcupacionVsMejor = ocupacionActual - mejorOcupacion;

        // Formatear datos mensuales para el gráfico
        const datosMensuales = monthlyArray.map((m: any) => ({
          anio: m.anio,
          mes: m.mes,
          mesAnio: m.mesAnio,
          total_camiones: m.total_camiones,
          duracion_promedio: m.duracion_promedio,
          ocupacion_promedio: m.ocupacion_promedio,
          total_destinos: m.total_destinos,
          total_uls: m.total_uls
        }));

        const response = {
          databaseName,
          datosMensuales,
          promedioDuracionHistorico,
          mejorDuracion,
          peorDuracion,
          promedioOcupacionHistorico,
          mejorOcupacion,
          peorOcupacion,
          duracionActual,
          ocupacionActual,
          brechaDuracionVsPromedio,
          brechaDuracionVsMejor,
          brechaOcupacionVsPromedio,
          brechaOcupacionVsMejor,
          generatedAt: new Date().toISOString()
        };

        console.log('=== EXPEDICIONES BENCHMARK RESPONSE DEBUG ===');
        console.log('Promedio duración histórico:', promedioDuracionHistorico);
        console.log('Mejor duración:', mejorDuracion);
        console.log('Promedio ocupación histórico:', promedioOcupacionHistorico);
        console.log('Mejor ocupación:', mejorOcupacion);
        console.log('Duración actual:', duracionActual);
        console.log('Ocupación actual:', ocupacionActual);

        return response;
      } catch (error) {
        console.error({
          endpoint: "/expediciones/benchmark",
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          durationMs: Date.now() - startedAt,
          fechaInicio,
          fechaFin,
          matricula,
        });

        const errorRes = errorResponse(
          "DATABASE_ERROR",
          "Error al obtener datos de benchmark histórico de expediciones"
        );
        return reply.status(500).send(errorRes);
      }
    }
  );
};
