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

        // KPIs de Coordinación Operativa - Tiempo Muerto
        const tiempoMuertoPromedioResult = await connection.request()
          .query(`SELECT AVG(DATEDIFF(minute, fin_preparacion, inicio_carga)) as tiempo_muerto_promedio
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
                     AND fin_preparacion IS NOT NULL
                     AND inicio_carga IS NOT NULL
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720 ${matriculaCondition}`); // Máximo 12 horas

        const tiempoMuertoP95Result = await connection.request()
          .query(`WITH ranked_data AS (
            SELECT 
              DATEDIFF(minute, fin_preparacion, inicio_carga) as tiempo_muerto
            FROM bi.fact_carga_camion_dia WITH (NOLOCK)
            WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
              AND fin_preparacion IS NOT NULL
              AND inicio_carga IS NOT NULL
              AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
              AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720 ${matriculaCondition}
          )
          SELECT TOP 5 PERCENT tiempo_muerto as tiempo_muerto_p95
          FROM ranked_data 
          ORDER BY tiempo_muerto DESC`);

        // Percentiles para el scatter plot (caps visuales)
        const scatterCapsResult = await connection.request()
          .query(`WITH duracion_data AS (
            SELECT duracion_carga_min
            FROM bi.fact_carga_camion_dia WITH (NOLOCK)
            WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
              AND duracion_carga_min IS NOT NULL
              AND duracion_carga_min > 0
              AND duracion_carga_min <= 1440 ${matriculaCondition}
          ),
          tiempo_muerto_data AS (
            SELECT DATEDIFF(minute, fin_preparacion, inicio_carga) as tiempo_muerto
            FROM bi.fact_carga_camion_dia WITH (NOLOCK)
            WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
              AND fin_preparacion IS NOT NULL
              AND inicio_carga IS NOT NULL
              AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
              AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720 ${matriculaCondition}
          )
          SELECT 
            (SELECT MAX(duracion) FROM (SELECT TOP 98 PERCENT duracion_carga_min as duracion FROM duracion_data ORDER BY duracion_carga_min) as t) as duracion_p98,
            (SELECT MAX(tiempo_muerto) FROM (SELECT TOP 95 PERCENT tiempo_muerto FROM tiempo_muerto_data ORDER BY tiempo_muerto) as t) as tiempo_muerto_p95`);

        const camionesEspera15Result = await connection.request()
          .query(`SELECT COUNT(*) as camiones_espera_15
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
                     AND fin_preparacion IS NOT NULL
                     AND inicio_carga IS NOT NULL
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) > 15
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720 ${matriculaCondition}`);

        const camionesEspera30Result = await connection.request()
          .query(`SELECT COUNT(*) as camiones_espera_30
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
                     AND fin_preparacion IS NOT NULL
                     AND inicio_carga IS NOT NULL
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) > 30
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720 ${matriculaCondition}`);

        const tiempoMuertoTotalResult = await connection.request()
          .query(`SELECT SUM(DATEDIFF(minute, fin_preparacion, inicio_carga)) as tiempo_muerto_total
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
                     AND fin_preparacion IS NOT NULL
                     AND inicio_carga IS NOT NULL
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720 ${matriculaCondition}`);

        const duracionTotalResult = await connection.request()
          .query(`SELECT SUM(duracion_carga_min) as duracion_total
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
                     AND duracion_carga_min IS NOT NULL
                     AND duracion_carga_min > 0 
                     AND duracion_carga_min <= 1440 ${matriculaCondition}`);

        const totalCamionesValidosResult = await connection.request()
          .query(`SELECT COUNT(*) as total_camiones_validos
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
                     AND fin_preparacion IS NOT NULL
                     AND inicio_carga IS NOT NULL
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720 ${matriculaCondition}`);

        // Datos por día
        const camionesPorDiaResult = await connection.request()
          .query(`SELECT FORMAT(fecha, 'dd/MM') as dia,
                          COUNT(*) as camiones,
                          AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
                          AVG(ocupacion_contenedores) as ocupacion_promedio,
                          AVG(CASE WHEN fin_preparacion IS NOT NULL 
                                   AND inicio_carga IS NOT NULL 
                                   AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                                   AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
                              THEN DATEDIFF(minute, fin_preparacion, inicio_carga) 
                              ELSE NULL END) as tiempo_muerto_promedio,
                          SUM(cantidad_destinos) as total_destinos,
                          SUM(uls) as total_uls
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}' ${matriculaCondition}
                   GROUP BY fecha
                   ORDER BY fecha ASC`);

        // Datos individuales para scatter plot
        const scatterDataResult = await connection.request()
          .query(`SELECT TOP 1500
                          matricula,
                          FORMAT(fecha, 'dd/MM/yyyy') as fecha,
                          duracion_carga_min as duracion,
                          DATEDIFF(minute, fin_preparacion, inicio_carga) as tiempo_muerto,
                          ocupacion_contenedores as ocupacion,
                          cantidad_destinos,
                          uls
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' 
                     AND fecha <= '${fechaFinSQL}'
                     AND inicio_carga IS NOT NULL
                     AND fin_carga IS NOT NULL
                     AND fin_preparacion IS NOT NULL
                     AND duracion_carga_min > 0
                     AND duracion_carga_min <= 1440
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
                     ${matricula ? `AND matricula LIKE '%${matricula}%'` : ''}
                   ORDER BY fecha DESC`);

        // Top 10 camiones con mayor tiempo muerto
        const topTiempoMuertoResult = await connection.request()
          .query(`SELECT TOP 10
                          matricula,
                          FORMAT(fecha, 'dd/MM/yyyy') as fecha,
                          duracion_carga_min as duracion,
                          DATEDIFF(minute, fin_preparacion, inicio_carga) as tiempo_muerto,
                          ocupacion_contenedores as ocupacion,
                          cantidad_destinos,
                          uls
                   FROM bi.fact_carga_camion_dia WITH (NOLOCK)
                   WHERE fecha >= '${fechaInicioSQL}' 
                     AND fecha <= '${fechaFinSQL}'
                     AND fin_preparacion IS NOT NULL
                     AND inicio_carga IS NOT NULL
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                     AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
                     ${matricula ? `AND matricula LIKE '%${matricula}%'` : ''}
                   ORDER BY DATEDIFF(minute, fin_preparacion, inicio_carga) DESC`);

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
          // KPIs de Coordinación Operativa
          tiempoMuertoPromedio: (tiempoMuertoPromedioResult.recordset[0] as any)?.tiempo_muerto_promedio || 0,
          tiempoMuertoP95: (tiempoMuertoP95Result.recordset[0] as any)?.tiempo_muerto_p95 || 0,
          camionesEspera15: (camionesEspera15Result.recordset[0] as any)?.camiones_espera_15 || 0,
          camionesEspera30: (camionesEspera30Result.recordset[0] as any)?.camiones_espera_30 || 0,
          tiempoMuertoTotal: (tiempoMuertoTotalResult.recordset[0] as any)?.tiempo_muerto_total || 0,
          duracionTotal: (duracionTotalResult.recordset[0] as any)?.duracion_total || 0,
          totalCamionesValidos: (totalCamionesValidosResult.recordset[0] as any)?.total_camiones_validos || 0,
          // Caps para scatter plot
          scatterCaps: {
            duracionP98: (scatterCapsResult.recordset[0] as any)?.duracion_p98 || 0,
            tiempoMuertoP95: (scatterCapsResult.recordset[0] as any)?.tiempo_muerto_p95 || 0
          },
          camionesPorDia: camionesPorDiaResult.recordset,
          scatterData: scatterDataResult.recordset,
          topTiempoMuerto: topTiempoMuertoResult.recordset,
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
          WITH filtered_data AS (
            SELECT 
              fecha,
              duracion_carga_min_clean = CASE 
                WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 
                THEN duracion_carga_min 
                ELSE NULL 
              END,
              tiempo_muerto_clean = CASE 
                WHEN fin_preparacion IS NOT NULL 
                 AND inicio_carga IS NOT NULL 
                 AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                 AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
                THEN DATEDIFF(minute, fin_preparacion, inicio_carga) 
                ELSE NULL 
              END,
              ocupacion_contenedores,
              cantidad_destinos,
              uls
            FROM bi.fact_carga_camion_dia WITH (NOLOCK)
            WHERE fecha >= DATEADD(MONTH, -9, GETDATE())
              AND fecha < DATEADD(MONTH, 1, GETDATE())
              ${matricula ? `AND matricula LIKE '%${matricula}%'` : ''}
          ),
          monthly_data AS (
            SELECT
              month_start = DATEFROMPARTS(YEAR(fecha), MONTH(fecha), 1),
              total_camiones = COUNT(*),
              duracion_promedio = AVG(duracion_carga_min_clean),
              tiempo_muerto_promedio = AVG(tiempo_muerto_clean),
              ocupacion_promedio = AVG(ocupacion_contenedores),
              total_destinos = SUM(cantidad_destinos),
              total_uls = SUM(uls)
            FROM filtered_data
            GROUP BY DATEFROMPARTS(YEAR(fecha), MONTH(fecha), 1)
          )
          SELECT TOP 10
            YEAR(month_start) as anio,
            MONTH(month_start) as mes,
            FORMAT(month_start, 'MMM-yy', 'es-AR') as mesAnio,
            total_camiones,
            duracion_promedio,
            tiempo_muerto_promedio,
            ocupacion_promedio,
            total_destinos,
            total_uls
          FROM monthly_data
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
        const tiemposMuertosHistoricos = monthlyArray.map((m: any) => m.tiempo_muerto_promedio || 0);
        
        const promedioDuracionHistorico = duracionesHistoricas.reduce((sum: number, dur: number) => sum + dur, 0) / duracionesHistoricas.length;
        const promedioOcupacionHistorico = ocupacionesHistoricas.reduce((sum: number, ocu: number) => sum + ocu, 0) / ocupacionesHistoricas.length;
        const promedioTiempoMuertoHistorico = tiemposMuertosHistoricos.reduce((sum: number, tm: number) => sum + tm, 0) / tiemposMuertosHistoricos.length;
        
        const mejorDuracion = Math.min(...duracionesHistoricas.filter(d => d > 0));
        const peorDuracion = Math.max(...duracionesHistoricas);
        const mejorOcupacion = Math.max(...ocupacionesHistoricas.filter(o => o > 0));
        const peorOcupacion = Math.min(...ocupacionesHistoricas.filter(o => o > 0));
        const mejorTiempoMuerto = Math.min(...tiemposMuertosHistoricos.filter(t => t > 0));
        const peorTiempoMuerto = Math.max(...tiemposMuertosHistoricos);

        // Calcular P95 histórico de tiempo muerto
        const tiemposMuertosOrdenados = tiemposMuertosHistoricos.sort((a, b) => a - b);
        const p95TiempoMuertoHistorico = tiemposMuertosOrdenados[Math.floor(tiemposMuertosOrdenados.length * 0.95)];

        // Obtener valores actuales del período seleccionado
        let duracionActual = 0;
        let ocupacionActual = 0;
        let tiempoMuertoActual = 0;
        
        if (fechaInicio && fechaFin) {
          const fechaInicioSQL = convertToSQLDate(fechaInicio);
          const fechaFinSQL = convertToSQLDate(fechaFin);

          const currentQuery = `
            SELECT 
              AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
              AVG(ocupacion_contenedores) as ocupacion_promedio,
              AVG(CASE WHEN fin_preparacion IS NOT NULL 
                       AND inicio_carga IS NOT NULL 
                       AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                       AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
                  THEN DATEDIFF(minute, fin_preparacion, inicio_carga) 
                  ELSE NULL END) as tiempo_muerto_promedio
            FROM bi.fact_carga_camion_dia WITH (NOLOCK)
            WHERE fecha >= '${fechaInicioSQL}' AND fecha <= '${fechaFinSQL}'
              ${matricula ? `AND matricula LIKE '%${matricula}%'` : ''}
          `;

          const currentResult = await pool.request().query(currentQuery);
          const currentArray = currentResult.recordset as any[];
          
          duracionActual = currentArray[0]?.duracion_promedio || 0;
          ocupacionActual = currentArray[0]?.ocupacion_promedio || 0;
          tiempoMuertoActual = currentArray[0]?.tiempo_muerto_promedio || 0;
        }

        // Calcular brechas
        const brechaDuracionVsPromedio = duracionActual - promedioDuracionHistorico;
        const brechaDuracionVsMejor = duracionActual - mejorDuracion;
        const brechaOcupacionVsPromedio = ocupacionActual - promedioOcupacionHistorico;
        const brechaOcupacionVsMejor = ocupacionActual - mejorOcupacion;
        const brechaTiempoMuertoVsPromedio = tiempoMuertoActual - promedioTiempoMuertoHistorico;
        const brechaTiempoMuertoVsMejor = tiempoMuertoActual - mejorTiempoMuerto;

        // Formatear datos mensuales para el gráfico
        const datosMensuales = monthlyArray.map((m: any) => ({
          anio: m.anio,
          mes: m.mes,
          mesAnio: m.mesAnio,
          total_camiones: m.total_camiones,
          duracion_promedio: m.duracion_promedio,
          tiempo_muerto_promedio: m.tiempo_muerto_promedio,
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
          // Nuevos KPIs de tiempo muerto
          promedioTiempoMuertoHistorico,
          mejorTiempoMuerto,
          peorTiempoMuerto,
          p95TiempoMuertoHistorico,
          duracionActual,
          ocupacionActual,
          tiempoMuertoActual,
          brechaDuracionVsPromedio,
          brechaDuracionVsMejor,
          brechaOcupacionVsPromedio,
          brechaOcupacionVsMejor,
          brechaTiempoMuertoVsPromedio,
          brechaTiempoMuertoVsMejor,
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
