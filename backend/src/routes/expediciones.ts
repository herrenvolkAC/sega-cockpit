import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { getPool } from "../db";
import { ErrorResponse } from "../types";

interface ExpedicionesQuerystring {
  fechaInicio?: string;
  fechaFin?: string;
  matricula?: string;
}

interface KpiRow {
  total_camiones?: number;
  duracion_promedio?: number;
  ocupacion_promedio?: number;
  total_destinos?: number;
  tiempo_muerto_promedio?: number;
  tiempo_muerto_p95?: number;
  camiones_espera_15?: number;
  camiones_espera_30?: number;
  tiempo_muerto_total?: number;
  duracion_total?: number;
  total_camiones_validos?: number;
  duracion_p98?: number;
}

interface MonthlyRow {
  anio: number;
  mes: number;
  mesAnio: string;
  total_camiones: number;
  duracion_promedio: number;
  tiempo_muerto_promedio: number;
  ocupacion_promedio: number;
  total_destinos: number;
  total_uls: number;
}

interface CurrentPeriodRow {
  duracion_promedio: number;
  ocupacion_promedio: number;
  tiempo_muerto_promedio: number;
}

const cache = new MemoryCache<unknown>(config.cacheTtlSeconds);

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

// Convertir fecha DD/MM/YYYY o YYYY-MM-DD a YYYY-MM-DD para SQL
const convertToSQLDate = (fechaStr: string): string => {
  if (!fechaStr) return "";
  if (fechaStr.includes("-")) return fechaStr.substring(0, 10);
  const parts = fechaStr.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return fechaStr;
};

const daysAgoDate = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const todayDate = (): string => new Date().toISOString().slice(0, 10);

export const expedicionesRoute = async (app: FastifyInstance): Promise<void> => {
  app.get<{ Querystring: ExpedicionesQuerystring }>(
    "/expediciones",
    async (
      request: FastifyRequest<{ Querystring: ExpedicionesQuerystring }>,
      reply: FastifyReply
    ) => {
      const startedAt = Date.now();
      const { fechaInicio, fechaFin, matricula } = request.query;

      const fechaInicioSQL = fechaInicio
        ? convertToSQLDate(fechaInicio)
        : daysAgoDate(60);
      const fechaFinSQL = fechaFin ? convertToSQLDate(fechaFin) : todayDate();

      if (!fechaInicioSQL || !fechaFinSQL) {
        return reply
          .status(400)
          .send(errorResponse("INVALID_DATE_RANGE", "Fechas inválidas"));
      }

      const matriculaFilter = matricula?.trim()
        ? `%${matricula.trim()}%`
        : null;
      const cacheKey = `expediciones_${fechaInicioSQL}_${fechaFinSQL}_${matricula || "all"}`;

      const cached = cache.get(cacheKey);
      if (cached) {
        request.log.info({
          endpoint: "/expediciones",
          durationMs: Date.now() - startedAt,
          cache: "hit",
        });
        return cached;
      }

      try {
        const connection = await getPool();

        const makeRequest = () =>
          connection
            .request()
            .input("fechaInicio", sql.Date, fechaInicioSQL)
            .input("fechaFin", sql.Date, fechaFinSQL)
            .input("matriculaFilter", sql.NVarChar(200), matriculaFilter);

        const baseWhere = `WHERE fecha >= @fechaInicio AND fecha <= @fechaFin
          AND (@matriculaFilter IS NULL OR matricula LIKE @matriculaFilter)`;

        const [
          totalCamionesResult,
          duracionPromedioResult,
          ocupacionPromedioResult,
          totalDestinosResult,
          tiempoMuertoPromedioResult,
          tiempoMuertoP95Result,
          scatterCapsResult,
          camionesEspera15Result,
          camionesEspera30Result,
          tiempoMuertoTotalResult,
          duracionTotalResult,
          totalCamionesValidosResult,
          camionesPorDiaResult,
          scatterDataResult,
          topTiempoMuertoResult,
          estadoULsResult,
          topMatriculasResult,
          matriculasMasUsadasResult,
        ] = await Promise.all([
          makeRequest().query(
            `SELECT COUNT(*) as total_camiones
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}`
          ),
          makeRequest().query(
            `SELECT AVG(duracion_carga_min) as duracion_promedio
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND duracion_carga_min IS NOT NULL
               AND duracion_carga_min > 0
               AND duracion_carga_min <= 1440`
          ),
          makeRequest().query(
            `SELECT AVG(ocupacion_contenedores) as ocupacion_promedio
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND ocupacion_contenedores IS NOT NULL`
          ),
          makeRequest().query(
            `SELECT SUM(cantidad_destinos) as total_destinos
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}`
          ),
          makeRequest().query(
            `SELECT AVG(DATEDIFF(minute, fin_preparacion, inicio_carga)) as tiempo_muerto_promedio
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND fin_preparacion IS NOT NULL
               AND inicio_carga IS NOT NULL
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720`
          ),
          makeRequest().query(
            `WITH ranked_data AS (
               SELECT DATEDIFF(minute, fin_preparacion, inicio_carga) as tiempo_muerto
               FROM bi.fact_carga_camion_dia WITH (NOLOCK)
               ${baseWhere}
                 AND fin_preparacion IS NOT NULL
                 AND inicio_carga IS NOT NULL
                 AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                 AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
             )
             SELECT TOP 5 PERCENT tiempo_muerto as tiempo_muerto_p95
             FROM ranked_data ORDER BY tiempo_muerto DESC`
          ),
          makeRequest().query(
            `WITH duracion_data AS (
               SELECT duracion_carga_min FROM bi.fact_carga_camion_dia WITH (NOLOCK)
               ${baseWhere}
                 AND duracion_carga_min IS NOT NULL AND duracion_carga_min > 0 AND duracion_carga_min <= 1440
             ),
             tiempo_muerto_data AS (
               SELECT DATEDIFF(minute, fin_preparacion, inicio_carga) as tiempo_muerto
               FROM bi.fact_carga_camion_dia WITH (NOLOCK)
               ${baseWhere}
                 AND fin_preparacion IS NOT NULL AND inicio_carga IS NOT NULL
                 AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                 AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
             )
             SELECT
               (SELECT MAX(duracion) FROM (SELECT TOP 98 PERCENT duracion_carga_min as duracion FROM duracion_data ORDER BY duracion_carga_min) as t) as duracion_p98,
               (SELECT MAX(tiempo_muerto) FROM (SELECT TOP 95 PERCENT tiempo_muerto FROM tiempo_muerto_data ORDER BY tiempo_muerto) as t) as tiempo_muerto_p95`
          ),
          makeRequest().query(
            `SELECT COUNT(*) as camiones_espera_15
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND fin_preparacion IS NOT NULL AND inicio_carga IS NOT NULL
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) > 15
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720`
          ),
          makeRequest().query(
            `SELECT COUNT(*) as camiones_espera_30
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND fin_preparacion IS NOT NULL AND inicio_carga IS NOT NULL
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) > 30
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720`
          ),
          makeRequest().query(
            `SELECT SUM(DATEDIFF(minute, fin_preparacion, inicio_carga)) as tiempo_muerto_total
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND fin_preparacion IS NOT NULL AND inicio_carga IS NOT NULL
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720`
          ),
          makeRequest().query(
            `SELECT SUM(duracion_carga_min) as duracion_total
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND duracion_carga_min IS NOT NULL AND duracion_carga_min > 0 AND duracion_carga_min <= 1440`
          ),
          makeRequest().query(
            `SELECT COUNT(*) as total_camiones_validos
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND fin_preparacion IS NOT NULL AND inicio_carga IS NOT NULL
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720`
          ),
          makeRequest().query(
            `SELECT FORMAT(fecha, 'dd/MM') as dia,
                    COUNT(*) as camiones,
                    AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
                    AVG(ocupacion_contenedores) as ocupacion_promedio,
                    AVG(CASE WHEN fin_preparacion IS NOT NULL AND inicio_carga IS NOT NULL
                             AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                             AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
                        THEN DATEDIFF(minute, fin_preparacion, inicio_carga) ELSE NULL END) as tiempo_muerto_promedio,
                    SUM(cantidad_destinos) as total_destinos,
                    SUM(uls) as total_uls
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
             GROUP BY fecha ORDER BY fecha ASC`
          ),
          makeRequest().query(
            `SELECT TOP 1500
                    matricula, FORMAT(fecha, 'dd/MM/yyyy') as fecha,
                    duracion_carga_min as duracion,
                    DATEDIFF(minute, fin_preparacion, inicio_carga) as tiempo_muerto,
                    ocupacion_contenedores as ocupacion, cantidad_destinos, uls
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND inicio_carga IS NOT NULL AND fin_carga IS NOT NULL AND fin_preparacion IS NOT NULL
               AND duracion_carga_min > 0 AND duracion_carga_min <= 1440
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
             ORDER BY fecha DESC`
          ),
          makeRequest().query(
            `SELECT TOP 10
                    matricula, FORMAT(fecha, 'dd/MM/yyyy') as fecha,
                    duracion_carga_min as duracion,
                    DATEDIFF(minute, fin_preparacion, inicio_carga) as tiempo_muerto,
                    ocupacion_contenedores as ocupacion, cantidad_destinos, uls
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
               AND fin_preparacion IS NOT NULL AND inicio_carga IS NOT NULL
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
               AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
             ORDER BY DATEDIFF(minute, fin_preparacion, inicio_carga) DESC`
          ),
          makeRequest().query(
            `SELECT 'Normales' as name,
                    SUM(uls) - SUM(uls_sin_fin_prep) - SUM(uls_sin_volumen) - SUM(uls_overfill) as value, '#10b981' as color
             FROM bi.fact_carga_camion_dia WITH (NOLOCK) ${baseWhere}
             UNION ALL
             SELECT 'Sin Fin Prep', SUM(uls_sin_fin_prep), '#f59e0b'
             FROM bi.fact_carga_camion_dia WITH (NOLOCK) ${baseWhere}
             UNION ALL
             SELECT 'Sin Volumen', SUM(uls_sin_volumen), '#fb923c'
             FROM bi.fact_carga_camion_dia WITH (NOLOCK) ${baseWhere}
             UNION ALL
             SELECT 'Overfill', SUM(uls_overfill), '#ef4444'
             FROM bi.fact_carga_camion_dia WITH (NOLOCK) ${baseWhere}`
          ),
          makeRequest().query(
            `SELECT TOP 10 matricula as name, SUM(uls) as uls_total,
                    AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
                    COUNT(*) as viajes
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
             GROUP BY matricula ORDER BY uls_total DESC`
          ),
          makeRequest().query(
            `SELECT TOP 5 matricula as name, COUNT(*) as viajes,
                    SUM(uls) as uls_total,
                    AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
                    AVG(ocupacion_contenedores) as ocupacion_promedio,
                    SUM(cantidad_destinos) as total_destinos
             FROM bi.fact_carga_camion_dia WITH (NOLOCK)
             ${baseWhere}
             GROUP BY matricula ORDER BY viajes DESC`
          ),
        ]);

        const kpi = (r: sql.IResult<unknown>) =>
          r.recordset[0] as KpiRow | undefined;

        const response = {
          databaseName: extractDatabaseName(config.mssqlConnectionString),
          fechaInicio: fechaInicio ?? null,
          fechaFin: fechaFin ?? null,
          matricula: matricula ?? null,
          totalCamiones: kpi(totalCamionesResult)?.total_camiones ?? 0,
          duracionPromedio: kpi(duracionPromedioResult)?.duracion_promedio ?? 0,
          ocupacionPromedio: kpi(ocupacionPromedioResult)?.ocupacion_promedio ?? 0,
          totalDestinos: kpi(totalDestinosResult)?.total_destinos ?? 0,
          tiempoMuertoPromedio: kpi(tiempoMuertoPromedioResult)?.tiempo_muerto_promedio ?? 0,
          tiempoMuertoP95: kpi(tiempoMuertoP95Result)?.tiempo_muerto_p95 ?? 0,
          camionesEspera15: kpi(camionesEspera15Result)?.camiones_espera_15 ?? 0,
          camionesEspera30: kpi(camionesEspera30Result)?.camiones_espera_30 ?? 0,
          tiempoMuertoTotal: kpi(tiempoMuertoTotalResult)?.tiempo_muerto_total ?? 0,
          duracionTotal: kpi(duracionTotalResult)?.duracion_total ?? 0,
          totalCamionesValidos: kpi(totalCamionesValidosResult)?.total_camiones_validos ?? 0,
          scatterCaps: {
            duracionP98: kpi(scatterCapsResult)?.duracion_p98 ?? 0,
            tiempoMuertoP95: kpi(scatterCapsResult)?.tiempo_muerto_p95 ?? 0,
          },
          camionesPorDia: camionesPorDiaResult.recordset,
          scatterData: scatterDataResult.recordset,
          topTiempoMuerto: topTiempoMuertoResult.recordset,
          estadoULs: estadoULsResult.recordset,
          topMatriculas: topMatriculasResult.recordset,
          matriculasMasUsadas: matriculasMasUsadasResult.recordset,
          generatedAt: new Date().toISOString(),
        };

        cache.set(cacheKey, response);
        request.log.info({
          endpoint: "/expediciones",
          durationMs: Date.now() - startedAt,
          cache: "miss",
        });
        return response;
      } catch (error) {
        request.log.error({
          endpoint: "/expediciones",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        });
        return reply
          .status(500)
          .send(
            errorResponse(
              "DATABASE_ERROR",
              "Error al obtener datos de expediciones"
            )
          );
      }
    }
  );

  app.get<{ Querystring: ExpedicionesQuerystring }>(
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
        const matriculaFilter = matricula?.trim()
          ? `%${matricula.trim()}%`
          : null;

        const monthlyQuery = `
          WITH filtered_data AS (
            SELECT
              fecha,
              duracion_carga_min_clean = CASE
                WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min
                ELSE NULL
              END,
              tiempo_muerto_clean = CASE
                WHEN fin_preparacion IS NOT NULL AND inicio_carga IS NOT NULL
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
              AND (@matriculaFilter IS NULL OR matricula LIKE @matriculaFilter)
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
            YEAR(month_start) as anio, MONTH(month_start) as mes,
            FORMAT(month_start, 'MMM-yy', 'es-AR') as mesAnio,
            total_camiones, duracion_promedio, tiempo_muerto_promedio,
            ocupacion_promedio, total_destinos, total_uls
          FROM monthly_data ORDER BY month_start ASC
        `;

        const monthlyResult = await pool
          .request()
          .input("matriculaFilter", sql.NVarChar(200), matriculaFilter)
          .query(monthlyQuery);

        const monthlyArray = monthlyResult.recordset as MonthlyRow[];
        const duracionesHistoricas = monthlyArray.map(
          (m) => m.duracion_promedio ?? 0
        );
        const ocupacionesHistoricas = monthlyArray.map(
          (m) => m.ocupacion_promedio ?? 0
        );
        const tiemposMuertosHistoricos = monthlyArray.map(
          (m) => m.tiempo_muerto_promedio ?? 0
        );

        const avg = (arr: number[]) =>
          arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0;

        const promedioDuracionHistorico = avg(duracionesHistoricas);
        const promedioOcupacionHistorico = avg(ocupacionesHistoricas);
        const promedioTiempoMuertoHistorico = avg(tiemposMuertosHistoricos);

        const positives = (arr: number[]) => arr.filter((v) => v > 0);
        const mejorDuracion = positives(duracionesHistoricas).length
          ? Math.min(...positives(duracionesHistoricas))
          : 0;
        const peorDuracion = duracionesHistoricas.length
          ? Math.max(...duracionesHistoricas)
          : 0;
        const mejorOcupacion = positives(ocupacionesHistoricas).length
          ? Math.max(...positives(ocupacionesHistoricas))
          : 0;
        const peorOcupacion = positives(ocupacionesHistoricas).length
          ? Math.min(...positives(ocupacionesHistoricas))
          : 0;
        const mejorTiempoMuerto = positives(tiemposMuertosHistoricos).length
          ? Math.min(...positives(tiemposMuertosHistoricos))
          : 0;
        const peorTiempoMuerto = tiemposMuertosHistoricos.length
          ? Math.max(...tiemposMuertosHistoricos)
          : 0;

        const sorted = [...tiemposMuertosHistoricos].sort((a, b) => a - b);
        const p95TiempoMuertoHistorico =
          sorted[Math.floor(sorted.length * 0.95)] ?? 0;

        let duracionActual = 0;
        let ocupacionActual = 0;
        let tiempoMuertoActual = 0;

        if (fechaInicio && fechaFin) {
          const fechaInicioSQL = convertToSQLDate(fechaInicio);
          const fechaFinSQL = convertToSQLDate(fechaFin);

          const currentResult = await pool
            .request()
            .input("fechaInicio", sql.Date, fechaInicioSQL)
            .input("fechaFin", sql.Date, fechaFinSQL)
            .input("matriculaFilter", sql.NVarChar(200), matriculaFilter)
            .query(`
              SELECT
                AVG(CASE WHEN duracion_carga_min > 0 AND duracion_carga_min <= 1440 THEN duracion_carga_min ELSE NULL END) as duracion_promedio,
                AVG(ocupacion_contenedores) as ocupacion_promedio,
                AVG(CASE WHEN fin_preparacion IS NOT NULL AND inicio_carga IS NOT NULL
                         AND DATEDIFF(minute, fin_preparacion, inicio_carga) >= 0
                         AND DATEDIFF(minute, fin_preparacion, inicio_carga) <= 720
                    THEN DATEDIFF(minute, fin_preparacion, inicio_carga) ELSE NULL END) as tiempo_muerto_promedio
              FROM bi.fact_carga_camion_dia WITH (NOLOCK)
              WHERE fecha >= @fechaInicio AND fecha <= @fechaFin
                AND (@matriculaFilter IS NULL OR matricula LIKE @matriculaFilter)
            `);

          const cur = (currentResult.recordset as CurrentPeriodRow[])[0];
          duracionActual = cur?.duracion_promedio ?? 0;
          ocupacionActual = cur?.ocupacion_promedio ?? 0;
          tiempoMuertoActual = cur?.tiempo_muerto_promedio ?? 0;
        }

        const response = {
          databaseName,
          datosMensuales: monthlyArray.map((m) => ({
            anio: m.anio,
            mes: m.mes,
            mesAnio: m.mesAnio,
            total_camiones: m.total_camiones,
            duracion_promedio: m.duracion_promedio,
            tiempo_muerto_promedio: m.tiempo_muerto_promedio,
            ocupacion_promedio: m.ocupacion_promedio,
            total_destinos: m.total_destinos,
            total_uls: m.total_uls,
          })),
          promedioDuracionHistorico,
          mejorDuracion,
          peorDuracion,
          promedioOcupacionHistorico,
          mejorOcupacion,
          peorOcupacion,
          promedioTiempoMuertoHistorico,
          mejorTiempoMuerto,
          peorTiempoMuerto,
          p95TiempoMuertoHistorico,
          duracionActual,
          ocupacionActual,
          tiempoMuertoActual,
          brechaDuracionVsPromedio: duracionActual - promedioDuracionHistorico,
          brechaDuracionVsMejor: duracionActual - mejorDuracion,
          brechaOcupacionVsPromedio: ocupacionActual - promedioOcupacionHistorico,
          brechaOcupacionVsMejor: ocupacionActual - mejorOcupacion,
          brechaTiempoMuertoVsPromedio:
            tiempoMuertoActual - promedioTiempoMuertoHistorico,
          brechaTiempoMuertoVsMejor: tiempoMuertoActual - mejorTiempoMuerto,
          generatedAt: new Date().toISOString(),
        };

        request.log.info({
          endpoint: "/expediciones/benchmark",
          durationMs: Date.now() - startedAt,
        });
        return response;
      } catch (error) {
        request.log.error({
          endpoint: "/expediciones/benchmark",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        });
        return reply
          .status(500)
          .send(
            errorResponse(
              "DATABASE_ERROR",
              "Error al obtener datos de benchmark histórico de expediciones"
            )
          );
      }
    }
  );
};
