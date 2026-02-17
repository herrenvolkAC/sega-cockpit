import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { query } from "../db";
import { ErrorResponse } from "../types";

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
    async (
      request: FastifyRequest<{
        Querystring: {
          fechaInicio?: string;
          fechaFin?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const startedAt = Date.now();
      const { fechaInicio, fechaFin } = request.query;
      
      // Crear cache key basado en las fechas
      const cacheKey = `fulfillment_${fechaInicio || 'default'}_${fechaFin || 'default'}`;

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
        if (fechaInicioKey && fechaFinKey && fechaInicioKey > fechaFinKey) {
          const errorRes = errorResponse(
            "INVALID_DATE_RANGE",
            "La fecha de inicio no puede ser mayor a la fecha de fin"
          );
          return reply.status(400).send(errorRes);
        }

        // Ejecutar todas las consultas con el filtro de fechas
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
          // 1. Total Pedidos (rango de fechas)
          query(
            `SELECT COUNT(DISTINCT codigo_pedido) as total_pedidos 
             FROM bi.fact_fulfillment_line_day 
             WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey}`,
            []
          ),

          // 2. Total Artículos Solicitados
          query(
            `SELECT SUM(qty_solicitada) as total_solicitado 
             FROM bi.fact_fulfillment_line_day 
             WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey}`,
            []
          ),

          // 3. Total Shortage (faltantes)
          query(
            `SELECT SUM(shortage_qty) as total_faltantes 
             FROM bi.fact_fulfillment_line_day 
             WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey}`,
            []
          ),

          // 4. Tasa de Satisfacción
          query(
            `SELECT 
               (1 - (SUM(shortage_qty) * 1.0 / NULLIF(SUM(qty_solicitada), 0))) * 100 as tasa_satisfaccion
             FROM bi.fact_fulfillment_line_day 
             WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey}`,
            []
          ),

          // 5. Pedidos y Faltantes por Día
          query(
            `SELECT 
               FORMAT(DATEFROMPARTS(date_key / 10000, date_key % 10000 / 100, date_key % 100), 'dd/MM') as dia,
               COUNT(DISTINCT codigo_pedido) as pedidos,
               SUM(shortage_qty) as faltantes
             FROM bi.fact_fulfillment_line_day 
             WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey}
             GROUP BY date_key
             ORDER BY date_key`,
            []
          ),

          // 6. Estado de Fulfillment
          query(
            `SELECT 
               CASE 
                 WHEN shortage_qty = 0 THEN 'Completo'
                 WHEN shortage_qty < qty_solicitada * 0.1 THEN 'Parcial'
                 ELSE 'Con Faltantes'
               END as name,
               COUNT(*) as value,
               CASE 
                 WHEN shortage_qty = 0 THEN '#10b981'
                 WHEN shortage_qty < qty_solicitada * 0.1 THEN '#f59e0b'
                 ELSE '#ef4444'
               END as color
             FROM bi.fact_fulfillment_line_day 
             WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey}
             GROUP BY 
               CASE 
                 WHEN shortage_qty = 0 THEN 'Completo'
                 WHEN shortage_qty < qty_solicitada * 0.1 THEN 'Parcial'
                 ELSE 'Con Faltantes'
               END,
               CASE 
                 WHEN shortage_qty = 0 THEN '#10b981'
                 WHEN shortage_qty < qty_solicitada * 0.1 THEN '#f59e0b'
                 ELSE '#ef4444'
               END`,
            []
          ),

          // 7. Top 5 Productos con más Shortage
          query(
            `SELECT TOP 5
               articulo_desc as categoria,
               SUM(shortage_qty) as monto,
               COUNT(*) as cantidad
             FROM bi.fact_fulfillment_line_day 
             WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey}
               AND shortage_qty > 0
             GROUP BY articulo_desc
             ORDER BY SUM(shortage_qty) DESC`,
            []
          ),

          // 8. Productos con Mayor Problema de Shortage
          query(
            `SELECT TOP 5
               articulo_desc as nombre,
               SUM(qty_solicitada) as cantidad_solicitada,
               SUM(shortage_qty) as cantidad_faltante,
               (SUM(shortage_qty) * 100.0 / NULLIF(SUM(qty_solicitada), 0)) as porcentaje_faltante
             FROM bi.fact_fulfillment_line_day 
             WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey}
             GROUP BY articulo_desc
             ORDER BY (SUM(shortage_qty) * 100.0 / NULLIF(SUM(qty_solicitada), 0)) DESC`,
            []
          ),

          // 9. Pedidos Recientes con Problemas
          query(
            `SELECT TOP 5
               codigo_pedido as id,
               centro_nombre as cliente,
               SUM(shortage_qty) as monto_faltante,
               CASE 
                 WHEN SUM(shortage_qty) = 0 THEN 'completado'
                 WHEN SUM(shortage_qty) < SUM(qty_solicitada) * 0.1 THEN 'parcial'
                 ELSE 'con_faltantes'
               END as estado,
               FORMAT(DATEFROMPARTS(MAX(date_key) / 10000, MAX(date_key) % 10000 / 100, MAX(date_key) % 100), 'dd/MM/yyyy HH:mm') as fecha
             FROM bi.fact_fulfillment_line_day 
             WHERE date_key BETWEEN ${fechaInicioKey} AND ${fechaFinKey}
             GROUP BY codigo_pedido, centro_nombre
             ORDER BY MAX(date_key) DESC`,
            []
          ),
        ]);

        // Estructurar respuesta
        const response = {
          databaseName: extractDatabaseName(config.mssqlConnectionString),
          fechaInicio: fechaInicio || null,
          fechaFin: fechaFin || null,
          totalPedidos: (totalPedidosResult[0] as any)?.total_pedidos || 0,
          totalSolicitado: (totalSolicitadoResult[0] as any)?.total_solicitado || 0,
          totalFaltantes: (totalFaltantesResult[0] as any)?.total_faltantes || 0,
          tasaSatisfaccion: (tasaSatisfaccionResult[0] as any)?.tasa_satisfaccion || 0,
          pedidosPorDia: pedidosPorDiaResult,
          estadoFulfillment: estadoFulfillmentResult,
          productosConShortage: productosConShortageResult,
          productosTop: productosTopResult,
          pedidosRecientes: pedidosRecientesResult,
          generatedAt: new Date().toISOString(),
        };

        // Cache response (por menos tiempo si hay fechas específicas)
        const cacheTtl = fechaInicio && fechaFin ? 60 : config.cacheTtlSeconds; // 1 min si hay filtros, default si no
        cache.set(cacheKey, response);

        request.log.info({
          endpoint: "/fulfillment",
          durationMs: Date.now() - startedAt,
          cache: "miss",
          fechaInicio,
          fechaFin,
          cacheTtl,
        });

        return response;
      } catch (error) {
        request.log.error({
          endpoint: "/fulfillment",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
          fechaInicio,
          fechaFin,
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
