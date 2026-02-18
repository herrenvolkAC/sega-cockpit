import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { query, getPool } from "../db";
import { ErrorResponse } from "../types";

interface FulfillmentQuerystring {
  fechaInicio?: string;
  fechaFin?: string;
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

// Convertir fecha DD/MM/YYYY a YYYYMMDD para date_key
const convertToDateKey = (fechaStr: string): string => {
  if (!fechaStr) return "";
  
  // Si viene en formato YYYY-MM-DD (del input type="date")
  if (fechaStr.includes('-')) {
    return fechaStr.replace(/-/g, '').substring(0, 8); // YYYY-MM-DD -> YYYYMMDD
  }
  
  // Si viene en formato DD/MM/YYYY
  const parts = fechaStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}${parts[1].padStart(2, '0')}${parts[0].padStart(2, '0')}`;
  }
  
  return fechaStr;
};

export const fulfillmentRoute = async (app: FastifyInstance): Promise<void> => {
  app.get(
    "/fulfillment",
    async (request, reply) => {
      const startedAt = Date.now();
      const query = request.query as any;
      
      // Acceder manualmente a los parámetros
      const fechaInicio = query.fechaInicio as string;
      const fechaFin = query.fechaFin as string;
      const sku = query.sku as string;
      
      // Debug: Mostrar parámetros recibidos
      console.log({
        endpoint: "/fulfillment",
        rawQuery: query,
        params: { fechaInicio, fechaFin, sku }
      });
      
      // Crear condición de filtro por SKU si se proporciona
      const skuCondition = sku ? `AND SKU LIKE '%${sku}%'` : '';
      
      console.log('Backend received:', { fechaInicio, fechaFin, sku });
      console.log('SKU Condition:', skuCondition);

      // Crear cache key basado en las fechas y SKU
      const cacheKey = `fulfillment_${fechaInicio || 'default'}_${fechaFin || 'default'}_${sku || 'all'}`;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        request.log.info({
          endpoint: "/fulfillment",
          durationMs: Date.now() - startedAt,
          cache: "hit",
          fechaInicio,
          fechaFin,
        });
        return cached;
      }

      try {
        // Convertir fechas o usar defaults
        const fechaInicioKey = fechaInicio 
          ? convertToDateKey(fechaInicio)
          : '20260118'; // 30 días atrás desde hoy (17/02/2026)
          
        const fechaFinKey = fechaFin
          ? convertToDateKey(fechaFin)
          : '20260217'; // Hoy

        // Validar que las fechas sean válidas
        if (!fechaInicioKey || !fechaFinKey) {
          const errorRes = errorResponse(
            "INVALID_DATE_RANGE",
            "Fechas inválidas"
          );
          return reply.status(400).send(errorRes);
        }

        // Ejecutar consultas con conexión directa para evitar el error query2
        const connection = await getPool();
        
        const totalPedidosResult = await connection.request()
          .query(`SELECT COUNT(DISTINCT codigo_pedido) as total_pedidos 
                   FROM bi.fact_fulfillment_line_day 
                   WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey} ${skuCondition}`);

        const totalSolicitadoResult = await connection.request()
          .query(`SELECT SUM(qty_solicitada) as total_solicitado 
                   FROM bi.fact_fulfillment_line_day 
                   WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey} ${skuCondition}`);

        const totalFaltantesResult = await connection.request()
          .query(`SELECT SUM(shortage_qty) as total_faltantes 
                   FROM bi.fact_fulfillment_line_day 
                   WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey} ${skuCondition}`);

        const tasaSatisfaccionResult = await connection.request()
          .query(`SELECT (1 - (SUM(shortage_qty) * 1.0 / NULLIF(SUM(qty_solicitada), 0))) * 100 as tasa_satisfaccion
                   FROM bi.fact_fulfillment_line_day 
                   WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey} ${skuCondition}`);

        const pedidosPorDiaResult = await connection.request()
          .query(`SELECT FORMAT(DATEFROMPARTS(date_key / 10000, date_key % 10000 / 100, date_key % 100), 'dd/MM') as dia,
                          COUNT(DISTINCT codigo_pedido) as pedidos,
                          SUM(qty_solicitada) as qty_solicitada,
                          SUM(shortage_qty) as faltantes
                   FROM bi.fact_fulfillment_line_day 
                   WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey} ${skuCondition}
                   GROUP BY date_key
                   ORDER BY date_key`);

        const estadoFulfillmentResult = await connection.request()
          .query(`SELECT CASE WHEN shortage_qty = 0 THEN 'Completo'
                                 WHEN shortage_qty < qty_solicitada * 0.1 THEN 'Parcial'
                                 ELSE 'Con Faltantes' END as name,
                          COUNT(*) as value,
                          CASE WHEN shortage_qty = 0 THEN '#10b981'
                                 WHEN shortage_qty < qty_solicitada * 0.1 THEN '#f59e0b'
                                 ELSE '#ef4444' END as color
                   FROM bi.fact_fulfillment_line_day 
                   WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey} ${skuCondition}
                   GROUP BY CASE WHEN shortage_qty = 0 THEN 'Completo'
                               WHEN shortage_qty < qty_solicitada * 0.1 THEN 'Parcial'
                               ELSE 'Con Faltantes' END,
                            CASE WHEN shortage_qty = 0 THEN '#10b981'
                                 WHEN shortage_qty < qty_solicitada * 0.1 THEN '#f59e0b'
                                 ELSE '#ef4444' END`);

        const productosConShortageResult = await connection.request()
          .query(`SELECT TOP 20 articulo_desc as name, SUM(shortage_qty) as shortage
                   FROM bi.fact_fulfillment_line_day 
                   WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey} ${skuCondition}
                     AND shortage_qty > 0
                   GROUP BY articulo_desc
                   ORDER BY SUM(shortage_qty) DESC`);

        const productosTopResult = await connection.request()
          .query(`SELECT TOP 5 articulo_desc as nombre, SUM(shortage_qty) as monto, COUNT(*) as cantidad
                   FROM bi.fact_fulfillment_line_day 
                   WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey} ${skuCondition}
                     AND shortage_qty > 0
                   GROUP BY articulo_desc
                   ORDER BY (SUM(shortage_qty) * 1.0 / NULLIF(SUM(qty_solicitada), 0)) DESC`);

        const pedidosRecientesResult = await connection.request()
          .query(`SELECT TOP 5 codigo_pedido as id, 'Cliente Desconocido' as cliente,
                          SUM(shortage_qty) as monto_faltante,
                          CASE WHEN SUM(shortage_qty) = 0 THEN 'completado'
                                 WHEN SUM(shortage_qty) < SUM(qty_solicitada) * 0.1 THEN 'parcial'
                                 ELSE 'con_faltantes' END as estado,
                          MAX(date_key) as fecha
                   FROM bi.fact_fulfillment_line_day 
                   WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey} ${skuCondition}
                   GROUP BY codigo_pedido
                   ORDER BY MAX(date_key) DESC`);

        // Estructurar respuesta
        const response = {
          databaseName: extractDatabaseName(config.mssqlConnectionString),
          fechaInicio: fechaInicio || null,
          fechaFin: fechaFin || null,
          totalPedidos: (totalPedidosResult.recordset[0] as any)?.total_pedidos || 0,
          totalSolicitado: (totalSolicitadoResult.recordset[0] as any)?.total_solicitado || 0,
          totalFaltantes: (totalFaltantesResult.recordset[0] as any)?.total_faltantes || 0,
          tasaSatisfaccion: (tasaSatisfaccionResult.recordset[0] as any)?.tasa_satisfaccion || 0,
          pedidosPorDia: pedidosPorDiaResult.recordset,
          estadoFulfillment: estadoFulfillmentResult.recordset,
          productosConShortage: productosConShortageResult.recordset,
          productosTop: productosTopResult.recordset,
          pedidosRecientes: pedidosRecientesResult.recordset,
          generatedAt: new Date().toISOString()
        };

        // Cache response (por menos tiempo si hay fechas específicas)
        const cacheTtlValue = fechaInicio && fechaFin ? 60 : config.cacheTtlSeconds; // 1 min si hay filtros, default si no
        
        cache.set(cacheKey, response);

        console.log({
          endpoint: "/fulfillment",
          durationMs: Date.now() - startedAt,
          cache: "miss",
          fechaInicio,
          fechaFin,
          cacheTtl: cacheTtlValue,
        });

        return response;
      } catch (error) {
        console.error({
          endpoint: "/fulfillment",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
          fechaInicio,
          fechaFin,
          sku,
        });

        const errorRes = errorResponse(
          "DATABASE_ERROR",
          "Error al obtener datos de fulfillment"
        );
        return reply.status(500).send(errorRes);
      }
    }
  );
};
