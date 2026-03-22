import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { getPool } from "../db";
import { ErrorResponse } from "../types";

interface FulfillmentQuerystring {
  fechaInicio?: string;
  fechaFin?: string;
  sku?: string;
}

interface FulfillmentKpiRow {
  total_pedidos?: number;
  total_solicitado?: number;
  total_faltantes?: number;
  tasa_satisfaccion?: number;
}

interface MonthlyRow {
  anio: number;
  mes: number;
  mesAnio: string;
  solicitado: number;
  entregado: number;
  fill_rate: number;
}

interface CurrentPeriodRow {
  qty_solicitada: number;
  faltantes: number;
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

// Convertir fecha DD/MM/YYYY o YYYY-MM-DD a YYYYMMDD para date_key
const convertToDateKey = (fechaStr: string): string => {
  if (!fechaStr) return "";
  if (fechaStr.includes("-")) {
    return fechaStr.replace(/-/g, "").substring(0, 8);
  }
  const parts = fechaStr.split("/");
  if (parts.length === 3) {
    return `${parts[2]}${parts[1].padStart(2, "0")}${parts[0].padStart(2, "0")}`;
  }
  return fechaStr;
};

const dateKeyDaysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};

const todayDateKey = (): string =>
  new Date().toISOString().slice(0, 10).replace(/-/g, "");

export const fulfillmentRoute = async (app: FastifyInstance): Promise<void> => {
  app.get<{ Querystring: FulfillmentQuerystring }>(
    "/fulfillment",
    async (
      request: FastifyRequest<{ Querystring: FulfillmentQuerystring }>,
      reply: FastifyReply
    ) => {
      const startedAt = Date.now();
      const { fechaInicio, fechaFin, sku } = request.query;

      const fechaInicioKey = fechaInicio
        ? convertToDateKey(fechaInicio)
        : dateKeyDaysAgo(30);
      const fechaFinKey = fechaFin ? convertToDateKey(fechaFin) : todayDateKey();

      if (!fechaInicioKey || !fechaFinKey) {
        return reply
          .status(400)
          .send(errorResponse("INVALID_DATE_RANGE", "Fechas inválidas"));
      }

      const skuFilter = sku?.trim() ? `%${sku.trim()}%` : null;
      const cacheKey = `fulfillment_${fechaInicioKey}_${fechaFinKey}_${sku || "all"}`;

      const cached = cache.get(cacheKey);
      if (cached) {
        request.log.info({
          endpoint: "/fulfillment",
          durationMs: Date.now() - startedAt,
          cache: "hit",
        });
        return cached;
      }

      try {
        const fechaInicioInt = parseInt(fechaInicioKey, 10);
        const fechaFinInt = parseInt(fechaFinKey, 10);
        const connection = await getPool();

        // Crea un request con los parámetros comunes pre-cargados
        const makeRequest = () =>
          connection
            .request()
            .input("fechaInicioKey", sql.Int, fechaInicioInt)
            .input("fechaFinKey", sql.Int, fechaFinInt)
            .input("skuFilter", sql.NVarChar(200), skuFilter);

        const baseWhere = `WHERE date_key BETWEEN @fechaInicioKey AND @fechaFinKey
          AND (@skuFilter IS NULL OR SKU LIKE @skuFilter)`;

        const [
          totalPedidosResult,
          totalSolicitadoResult,
          totalFaltantesResult,
          tasaSatisfaccionResult,
          pedidosPorDiaResult,
          estadoFulfillmentResult,
          productosConShortageResult,
          productosTopResult,
          pedidosRecientesResult,
        ] = await Promise.all([
          makeRequest().query(
            `SELECT COUNT(DISTINCT codigo_pedido) as total_pedidos
             FROM bi.fact_fulfillment_line_day ${baseWhere}`
          ),
          makeRequest().query(
            `SELECT SUM(qty_solicitada) as total_solicitado
             FROM bi.fact_fulfillment_line_day ${baseWhere}`
          ),
          makeRequest().query(
            `SELECT SUM(shortage_qty) as total_faltantes
             FROM bi.fact_fulfillment_line_day ${baseWhere}`
          ),
          makeRequest().query(
            `SELECT (1 - (SUM(shortage_qty) * 1.0 / NULLIF(SUM(qty_solicitada), 0))) * 100 as tasa_satisfaccion
             FROM bi.fact_fulfillment_line_day ${baseWhere}`
          ),
          makeRequest().query(
            `SELECT FORMAT(DATEFROMPARTS(date_key / 10000, date_key % 10000 / 100, date_key % 100), 'dd/MM') as dia,
                    COUNT(DISTINCT codigo_pedido) as pedidos,
                    SUM(qty_solicitada) as qty_solicitada,
                    SUM(shortage_qty) as faltantes
             FROM bi.fact_fulfillment_line_day ${baseWhere}
             GROUP BY date_key
             ORDER BY date_key`
          ),
          makeRequest().query(
            `SELECT CASE WHEN shortage_qty = 0 THEN 'Completo'
                         WHEN shortage_qty < qty_solicitada * 0.1 THEN 'Parcial'
                         ELSE 'Con Faltantes' END as name,
                    COUNT(*) as value,
                    CASE WHEN shortage_qty = 0 THEN '#10b981'
                         WHEN shortage_qty < qty_solicitada * 0.1 THEN '#f59e0b'
                         ELSE '#ef4444' END as color
             FROM bi.fact_fulfillment_line_day ${baseWhere}
             GROUP BY CASE WHEN shortage_qty = 0 THEN 'Completo'
                           WHEN shortage_qty < qty_solicitada * 0.1 THEN 'Parcial'
                           ELSE 'Con Faltantes' END,
                      CASE WHEN shortage_qty = 0 THEN '#10b981'
                           WHEN shortage_qty < qty_solicitada * 0.1 THEN '#f59e0b'
                           ELSE '#ef4444' END`
          ),
          makeRequest().query(
            `SELECT TOP 20 articulo_desc as name, SUM(shortage_qty) as shortage
             FROM bi.fact_fulfillment_line_day ${baseWhere}
               AND shortage_qty > 0
             GROUP BY articulo_desc
             ORDER BY SUM(shortage_qty) DESC`
          ),
          makeRequest().query(
            `SELECT TOP 5 articulo_desc as nombre, SUM(shortage_qty) as monto, COUNT(*) as cantidad
             FROM bi.fact_fulfillment_line_day ${baseWhere}
               AND shortage_qty > 0
             GROUP BY articulo_desc
             ORDER BY (SUM(shortage_qty) * 1.0 / NULLIF(SUM(qty_solicitada), 0)) DESC`
          ),
          makeRequest().query(
            `SELECT TOP 5 codigo_pedido as id, 'Cliente Desconocido' as cliente,
                    SUM(shortage_qty) as monto_faltante,
                    CASE WHEN SUM(shortage_qty) = 0 THEN 'completado'
                         WHEN SUM(shortage_qty) < SUM(qty_solicitada) * 0.1 THEN 'parcial'
                         ELSE 'con_faltantes' END as estado,
                    MAX(date_key) as fecha
             FROM bi.fact_fulfillment_line_day ${baseWhere}
             GROUP BY codigo_pedido
             ORDER BY MAX(date_key) DESC`
          ),
        ]);

        const kpiRow = totalPedidosResult.recordset[0] as FulfillmentKpiRow;
        const solRow = totalSolicitadoResult.recordset[0] as FulfillmentKpiRow;
        const fltRow = totalFaltantesResult.recordset[0] as FulfillmentKpiRow;
        const tsRow = tasaSatisfaccionResult.recordset[0] as FulfillmentKpiRow;

        const response = {
          databaseName: extractDatabaseName(config.mssqlConnectionString),
          fechaInicio: fechaInicio ?? null,
          fechaFin: fechaFin ?? null,
          totalPedidos: kpiRow?.total_pedidos ?? 0,
          totalSolicitado: solRow?.total_solicitado ?? 0,
          totalFaltantes: fltRow?.total_faltantes ?? 0,
          tasaSatisfaccion: tsRow?.tasa_satisfaccion ?? 0,
          pedidosPorDia: pedidosPorDiaResult.recordset,
          estadoFulfillment: estadoFulfillmentResult.recordset,
          productosConShortage: productosConShortageResult.recordset,
          productosTop: productosTopResult.recordset,
          pedidosRecientes: pedidosRecientesResult.recordset,
          generatedAt: new Date().toISOString(),
        };

        cache.set(cacheKey, response);
        request.log.info({
          endpoint: "/fulfillment",
          durationMs: Date.now() - startedAt,
          cache: "miss",
        });
        return response;
      } catch (error) {
        request.log.error({
          endpoint: "/fulfillment",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        });
        return reply
          .status(500)
          .send(
            errorResponse(
              "DATABASE_ERROR",
              "Error al obtener datos de fulfillment"
            )
          );
      }
    }
  );

  app.get<{ Querystring: FulfillmentQuerystring }>(
    "/fulfillment/benchmark",
    async (
      request: FastifyRequest<{ Querystring: FulfillmentQuerystring }>,
      reply: FastifyReply
    ) => {
      const startedAt = Date.now();
      const { fechaInicio, fechaFin, sku } = request.query;

      try {
        const pool = await getPool();
        const databaseName = extractDatabaseName(config.mssqlConnectionString);

        const monthlyQuery = `
          WITH monthly AS (
            SELECT
              month_start = DATEFROMPARTS(
                CAST(SUBSTRING(CAST(date_key AS VARCHAR), 1, 4) AS INT),
                CAST(SUBSTRING(CAST(date_key AS VARCHAR), 5, 2) AS INT),
                1
              ),
              solicitado_units = SUM(qty_solicitada),
              entregado_units  = SUM(qty_solicitada - shortage_qty)
            FROM bi.fact_fulfillment_line_day
            WHERE date_key >= FORMAT(DATEADD(MONTH, -9, GETDATE()), 'yyyyMMdd')
              AND date_key < FORMAT(DATEADD(MONTH, 1, GETDATE()), 'yyyyMMdd')
              ${sku ? `AND sku = @sku` : ""}
            GROUP BY DATEFROMPARTS(
              CAST(SUBSTRING(CAST(date_key AS VARCHAR), 1, 4) AS INT),
              CAST(SUBSTRING(CAST(date_key AS VARCHAR), 5, 2) AS INT),
              1
            )
          )
          SELECT TOP 10
            YEAR(month_start) as anio,
            MONTH(month_start) as mes,
            FORMAT(month_start, 'MMM-yy', 'es-AR') as mesAnio,
            solicitado_units as solicitado,
            entregado_units as entregado,
            fill_rate = CASE
              WHEN solicitado_units > 0
              THEN (entregado_units * 1.0 / solicitado_units) * 100
              ELSE 0
            END
          FROM monthly
          ORDER BY month_start ASC
        `;

        const monthlyResult = await pool
          .request()
          .input("sku", sql.VarChar(80), sku ?? null)
          .query(monthlyQuery);

        const monthlyArray = monthlyResult.recordset as MonthlyRow[];
        const nivelesServicio = monthlyArray.map((m) => m.fill_rate ?? 0);
        const promedioHistorico = nivelesServicio.length
          ? nivelesServicio.reduce((s, n) => s + n, 0) / nivelesServicio.length
          : 0;
        const mejorMes = nivelesServicio.length
          ? Math.max(...nivelesServicio)
          : 0;
        const peorMes = nivelesServicio.length
          ? Math.min(...nivelesServicio)
          : 0;

        let nivelActual = 0;
        if (fechaInicio && fechaFin) {
          const fechaInicioKey = convertToDateKey(fechaInicio);
          const fechaFinKey = convertToDateKey(fechaFin);

          const currentQuery = `
            SELECT
              SUM(qty_solicitada) as qty_solicitada,
              SUM(shortage_qty) as faltantes
            FROM bi.fact_fulfillment_line_day
            WHERE date_key BETWEEN @fechaInicio AND @fechaFin
              ${sku ? `AND sku = @sku` : ""}
          `;

          const currentResult = await pool
            .request()
            .input("fechaInicio", sql.Int, parseInt(fechaInicioKey, 10))
            .input("fechaFin", sql.Int, parseInt(fechaFinKey, 10))
            .input("sku", sql.VarChar(80), sku ?? null)
            .query(currentQuery);

          const cur = (currentResult.recordset as CurrentPeriodRow[])[0];
          const totalSolicitado = cur?.qty_solicitada ?? 0;
          const totalFaltantes = cur?.faltantes ?? 0;
          nivelActual =
            totalSolicitado > 0
              ? ((totalSolicitado - totalFaltantes) / totalSolicitado) * 100
              : 0;
        }

        const response = {
          databaseName,
          datosMensuales: monthlyArray.map((m) => ({
            anio: m.anio,
            mes: m.mes,
            mesAnio: m.mesAnio,
            solicitado: m.solicitado,
            entregado: m.entregado,
            nivelServicio: m.fill_rate,
          })),
          promedioHistorico,
          mejorMes,
          peorMes,
          nivelActual,
          brechaVsPromedio: nivelActual - promedioHistorico,
          brechaVsMejor: nivelActual - mejorMes,
          generatedAt: new Date().toISOString(),
        };

        request.log.info({
          endpoint: "/fulfillment/benchmark",
          durationMs: Date.now() - startedAt,
        });
        return response;
      } catch (error) {
        request.log.error({
          endpoint: "/fulfillment/benchmark",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        });
        return reply
          .status(500)
          .send(
            errorResponse(
              "DATABASE_ERROR",
              "Error al obtener datos de benchmark histórico"
            )
          );
      }
    }
  );
};
