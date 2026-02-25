import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { query, getPool } from "../db";
import { ErrorResponse } from "../types";

interface StockQuerystring {
  sku?: string;
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

export const stockRoute = async (app: FastifyInstance): Promise<void> => {
  app.get(
    "/stock",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            sku: { type: "string", description: "Filtro por SKU" }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Querystring: StockQuerystring }>, reply: FastifyReply) => {
      try {
        const { sku } = request.query;
        
        // Crear cache key
        const cacheKey = `stock_${sku || 'all'}`;
        
        // Intentar obtener desde cache
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
          return reply.send(cachedData);
        }

        const pool = await getPool();
        
        // Construir cláusula WHERE para filtro de SKU
        const whereClause = sku ? "WHERE sku = @sku" : "";
        
        // Query principal para obtener KPIs y datos generales
        const mainQuery = `
          SELECT 
            COUNT(DISTINCT sku) as total_skus,
            SUM(stock_total_base) as stock_total,
            SUM(stock_disponible_base) as stock_disponible,
            SUM(stock_reservado_base) as stock_reservado,
            SUM(stock_bloqueado_base) as stock_bloqueado,
            AVG(CASE WHEN dias_stock_disponible > 0 THEN dias_stock_disponible ELSE NULL END) as dias_stock_promedio,
            AVG(CASE WHEN dpd_base_30d > 0 THEN dpd_base_30d ELSE NULL END) as consumo_promedio_diario,
            MAX(snapshot_dt) as ultima_actualizacion
          FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
          ${whereClause}
          OPTION (RECOMPILE)
        `;

        const mainResult = await pool.request()
          .input('sku', sql.VarChar(80), sku)
          .query(mainQuery);

        const mainData = mainResult.recordset[0];

        // Query para estado del stock (para gráfico de torta)
        const stockEstadoQuery = `
          SELECT 
            'Disponible' as estado,
            SUM(stock_disponible_base) as valor
          FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
          ${whereClause}
          
          UNION ALL
          
          SELECT 
            'Reservado' as estado,
            SUM(stock_reservado_base) as valor
          FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
          ${whereClause}
          
          UNION ALL
          
          SELECT 
            'Bloqueado' as estado,
            SUM(stock_bloqueado_base) as valor
          FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
          ${whereClause}
          OPTION (RECOMPILE)
        `;

        const stockEstadoResult = await pool.request()
          .input('sku', sql.VarChar(80), sku)
          .query(stockEstadoQuery);

        // Query para Top 10 SKUs con menor cobertura
        const bajaCoberturaQuery = `
          SELECT TOP 10
            sku,
            articulo_desc,
            dias_stock_disponible as cobertura_dias
          FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
          WHERE dias_stock_disponible >= 0
          ${sku ? "AND sku = @sku" : ""}
          ORDER BY dias_stock_disponible ASC
          OPTION (RECOMPILE)
        `;

        const bajaCoberturaResult = await pool.request()
          .input('sku', sql.VarChar(80), sku)
          .query(bajaCoberturaQuery);

        // Query para Top 10 SKUs con más tiempo sin movimientos
        const sinMovimientoQuery = `
          SELECT TOP 10
            sku,
            articulo_desc,
            DATEDIFF(day, last_move_dt, GETDATE()) as dias_sin_movimiento,
            stock_total_base,
            dpd_base_30d,
            last_move_dt
          FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
          WHERE last_move_dt IS NOT NULL
          AND stock_total_base > 0
          ${sku ? "AND sku = @sku" : ""}
          ORDER BY last_move_dt ASC
          OPTION (RECOMPILE)
        `;

        const sinMovimientoResult = await pool.request()
          .input('sku', sql.VarChar(80), sku)
          .query(sinMovimientoQuery);

        // Query para Top 5 SKUs con más stock
        const topStockQuery = `
          SELECT TOP 5
            sku,
            articulo_desc,
            stock_total_base,
            stock_disponible_base
          FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
          WHERE stock_total_base > 0
          ${sku ? "AND sku = @sku" : ""}
          ORDER BY stock_total_base DESC
          OPTION (RECOMPILE)
        `;

        const topStockResult = await pool.request()
          .input('sku', sql.VarChar(80), sku)
          .query(topStockQuery);

        // Query para distribución de cobertura por rangos
        const distribucionCoberturaQuery = `
          SELECT 
            rango_cobertura,
            cantidad_skus,
            stock_total_rango,
            orden_fijo
          FROM (
            SELECT 
              CASE 
                WHEN dias_stock_disponible = 0 THEN '0 días'
                WHEN dias_stock_disponible > 0 AND dias_stock_disponible < 7 THEN '0-7 días'
                WHEN dias_stock_disponible >= 7 AND dias_stock_disponible < 15 THEN '7-15 días'
                WHEN dias_stock_disponible >= 15 AND dias_stock_disponible < 45 THEN '15-45 días'
                WHEN dias_stock_disponible >= 45 AND dias_stock_disponible < 120 THEN '45-120 días'
                WHEN dias_stock_disponible >= 120 AND dias_stock_disponible < 365 THEN '120-365 días'
                WHEN dias_stock_disponible >= 365 THEN '365+ días'
                WHEN dias_stock_disponible < 0 THEN 'Sin consumo'
              END as rango_cobertura,
              COUNT(*) as cantidad_skus,
              SUM(stock_total_base) as stock_total_rango,
              CASE 
                WHEN dias_stock_disponible = 0 THEN 1
                WHEN dias_stock_disponible > 0 AND dias_stock_disponible < 7 THEN 2
                WHEN dias_stock_disponible >= 7 AND dias_stock_disponible < 15 THEN 3
                WHEN dias_stock_disponible >= 15 AND dias_stock_disponible < 45 THEN 4
                WHEN dias_stock_disponible >= 45 AND dias_stock_disponible < 120 THEN 5
                WHEN dias_stock_disponible >= 120 AND dias_stock_disponible < 365 THEN 6
                WHEN dias_stock_disponible >= 365 THEN 7
                WHEN dias_stock_disponible < 0 THEN 8
              END as orden_fijo
            FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
            ${sku ? "WHERE sku = @sku" : ""}
            GROUP BY 
              CASE 
                WHEN dias_stock_disponible = 0 THEN '0 días'
                WHEN dias_stock_disponible > 0 AND dias_stock_disponible < 7 THEN '0-7 días'
                WHEN dias_stock_disponible >= 7 AND dias_stock_disponible < 15 THEN '7-15 días'
                WHEN dias_stock_disponible >= 15 AND dias_stock_disponible < 45 THEN '15-45 días'
                WHEN dias_stock_disponible >= 45 AND dias_stock_disponible < 120 THEN '45-120 días'
                WHEN dias_stock_disponible >= 120 AND dias_stock_disponible < 365 THEN '120-365 días'
                WHEN dias_stock_disponible >= 365 THEN '365+ días'
                WHEN dias_stock_disponible < 0 THEN 'Sin consumo'
              END,
              CASE 
                WHEN dias_stock_disponible = 0 THEN 1
                WHEN dias_stock_disponible > 0 AND dias_stock_disponible < 7 THEN 2
                WHEN dias_stock_disponible >= 7 AND dias_stock_disponible < 15 THEN 3
                WHEN dias_stock_disponible >= 15 AND dias_stock_disponible < 45 THEN 4
                WHEN dias_stock_disponible >= 45 AND dias_stock_disponible < 120 THEN 5
                WHEN dias_stock_disponible >= 120 AND dias_stock_disponible < 365 THEN 6
                WHEN dias_stock_disponible >= 365 THEN 7
                WHEN dias_stock_disponible < 0 THEN 8
              END
          ) as subquery
          ORDER BY orden_fijo
          OPTION (RECOMPILE)
        `;

        const distribucionCoberturaResult = await pool.request()
          .input('sku', sql.VarChar(80), sku)
          .query(distribucionCoberturaQuery);

        // Query para clasificación de riesgo
        const clasificacionRiesgoQuery = `
          SELECT 
            COUNT(*) as total_skus,
            SUM(CASE WHEN dias_stock_disponible < 7 AND dias_stock_disponible >= 0 THEN 1 ELSE 0 END) as skus_riesgo_critico,
            SUM(CASE WHEN dias_stock_disponible > 120 THEN 1 ELSE 0 END) as skus_sobrestock,
            SUM(CASE WHEN dpd_base_30d = 0 OR dpd_base_30d IS NULL THEN 1 ELSE 0 END) as skus_sin_consumo,
            SUM(CASE WHEN dias_stock_disponible >= 0 AND dias_stock_disponible IS NOT NULL THEN dias_stock_disponible ELSE 0 END) as suma_cobertura,
            SUM(CASE WHEN dias_stock_disponible >= 0 AND dias_stock_disponible IS NOT NULL THEN 1 ELSE 0 END) as skus_con_cobertura
          FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
          ${sku ? "WHERE sku = @sku" : ""}
          OPTION (RECOMPILE)
        `;

        const clasificacionRiesgoResult = await pool.request()
          .input('sku', sql.VarChar(80), sku)
          .query(clasificacionRiesgoQuery);

        // Query para Top 10 SKUs con riesgo de quiebre (con más datos)
        const riesgoQuiebreQuery = `
          SELECT TOP 10
            sku,
            articulo_desc,
            dias_stock_disponible as cobertura,
            stock_total_base as stock_actual,
            dpd_base_30d as consumo_diario
          FROM bi.fact_stock_sku_vigente WITH (NOLOCK)
          WHERE dias_stock_disponible >= 0 
          AND dias_stock_disponible < 15
          AND stock_total_base > 0
          ${sku ? "AND sku = @sku" : ""}
          ORDER BY dias_stock_disponible ASC, dpd_base_30d DESC
          OPTION (RECOMPILE)
        `;

        const riesgoQuiebreResult = await pool.request()
          .input('sku', sql.VarChar(80), sku)
          .query(riesgoQuiebreQuery);

        // Formatear datos para el frontend
        const riesgoData = clasificacionRiesgoResult.recordset[0];
        const coberturaPonderada = riesgoData.skus_con_cobertura > 0 ? 
          riesgoData.suma_cobertura / riesgoData.skus_con_cobertura : 0;

        const responseData = {
          databaseName: extractDatabaseName(config.mssqlConnectionString),
          filtros: {
            sku: sku || "Todos"
          },
          maxFechaDatos: mainData.ultima_actualizacion,
          resumenEjecutivo: {
            coberturaGlobal: Math.round(coberturaPonderada),
            porcentajeRiesgoCritico: riesgoData.total_skus > 0 ? 
              Math.round((riesgoData.skus_riesgo_critico / riesgoData.total_skus) * 100) : 0,
            porcentajeSobrestock: riesgoData.total_skus > 0 ? 
              Math.round((riesgoData.skus_sobrestock / riesgoData.total_skus) * 100) : 0,
            porcentajeSinConsumo: riesgoData.total_skus > 0 ? 
              Math.round((riesgoData.skus_sin_consumo / riesgoData.total_skus) * 100) : 0,
            totalSkus: riesgoData.total_skus || 0,
            stockTotal: Math.round(mainData.stock_total || 0),
            consumoTotalDiario: Math.round(mainData.consumo_promedio_diario || 0)
          },
          distribucionCobertura: distribucionCoberturaResult.recordset.map(item => ({
            rango: item.rango_cobertura,
            cantidadSkus: item.cantidad_skus,
            stockTotal: Math.round(item.stock_total_rango || 0),
            porcentaje: riesgoData.total_skus > 0 ? 
              Math.round((item.cantidad_skus / riesgoData.total_skus) * 100) : 0
          })),
          stockEstado: stockEstadoResult.recordset.map(item => ({
            name: item.estado,
            value: Math.round(item.valor || 0),
            color: item.estado === 'Disponible' ? '#10b981' : 
                   item.estado === 'Reservado' ? '#f59e0b' : '#ef4444'
          })),
          riesgoQuiebre: riesgoQuiebreResult.recordset.map(item => ({
            sku: item.sku,
            articulo: item.articulo_desc,
            cobertura: Math.round(item.cobertura || 0),
            stockActual: Math.round(item.stock_actual || 0),
            consumoDiario: Math.round(item.consumo_diario || 0)
          })),
          inmovilizados: sinMovimientoResult.recordset.map(item => ({
            sku: item.sku,
            articulo: item.articulo_desc,
            diasSinMovimiento: item.dias_sin_movimiento,
            stockActual: Math.round(item.stock_total_base || 0),
            consumoPromedioDiario: Math.round(item.dpd_base_30d || 0),
            ultimaFechaMovimiento: item.last_move_dt
          })),
          topStockSkus: topStockResult.recordset.map(item => ({
            sku: item.sku,
            articulo: item.articulo_desc,
            stockTotal: Math.round(item.stock_total_base || 0),
            stockDisponible: Math.round(item.stock_disponible_base || 0)
          })),
          generatedAt: new Date().toISOString()
        };

        // Guardar en cache
        cache.set(cacheKey, responseData);

        return reply.send(responseData);

      } catch (error) {
        console.error("Error en stock route:", error);
        return reply.status(500).send(
          errorResponse("INTERNAL_ERROR", "Error interno del servidor")
        );
      }
    }
  );
};
