import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { query, getPool } from "../db";
import { ErrorResponse } from "../types";

const cache = new MemoryCache<any>(config.cacheTtlSeconds);

interface ProductivityQuerystring {
  operacion?: string;
  from?: string;
  to?: string;
}

export const productivityRoute = async (app: FastifyInstance): Promise<void> => {
  app.get(
    "/productividad",
    async (request: FastifyRequest<{ Querystring: ProductivityQuerystring }>, reply: FastifyReply) => {
      const startedAt = Date.now();
      const query = request.query as any;
      
      // Extraer parámetros
      const operacion = query.operacion as string;
      const fromDate = query.from as string;
      const toDate = query.to as string;
      
      console.log('Productivity request:', { operacion, fromDate, toDate });
      
      // Validar parámetros
      if (!operacion || operacion !== 'PICKING') {
        const errorRes = {
          ok: false,
          error: { code: "INVALID_OPERATION", message: "Operación no válida. Solo PICKING es soportado." }
        };
        return reply.status(400).send(errorRes);
      }
      
      if (!fromDate || !toDate) {
        const errorRes = {
          ok: false,
          error: { code: "INVALID_DATES", message: "Se requieren fechas from y to" }
        };
        return reply.status(400).send(errorRes);
      }
      
      // Convertir fechas al formato YYYY-MM-DD
      const from_date = fromDate.split('T')[0];
      const to_date = toDate.split('T')[0];
      
      // Crear cache key
      const cacheKey = `productivity_${operacion}_${from_date}_${to_date}`;
      
      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('Cache hit for productivity');
        return reply.send(cached);
      }
      
      try {
        const connection = await getPool();
        
        // 1) DAILY (serie diaria grupal)
        const dailyResult = await connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .query(`
            WITH e AS (
              SELECT *
              FROM bi.fact_operacion_evento
              WHERE operacion = 'PICKING'
                AND fecha_operativa >= @from_date
                AND fecha_operativa < @to_date
            ),
            ops AS (
              SELECT
                fecha_operativa,
                usuario_id,
                operacion_rf_id,
                MIN(inicio_dt) as inicio_dt,
                MAX(fin_dt) as fin_dt
              FROM e
              WHERE operacion_rf_id IS NOT NULL
                AND inicio_dt IS NOT NULL
                AND fin_dt IS NOT NULL
              GROUP BY fecha_operativa, usuario_id, operacion_rf_id
            ),
            tiempos AS (
              SELECT 
                fecha_operativa, 
                SUM(DATEDIFF(SECOND, inicio_dt, fin_dt)) as segundos
              FROM ops
              GROUP BY fecha_operativa
            ),
            vol AS (
              SELECT 
                fecha_operativa, 
                COUNT(*) as movimientos, 
                SUM(cantidad) as unidades
              FROM e
              GROUP BY fecha_operativa
            )
            SELECT
              v.fecha_operativa,
              v.movimientos,
              v.unidades,
              ISNULL(t.segundos,0) as segundos,
              CASE WHEN ISNULL(t.segundos,0) > 0 THEN v.movimientos * 3600.0 / t.segundos END as mov_x_h,
              CASE WHEN ISNULL(t.segundos,0) > 0 THEN v.unidades * 3600.0 / t.segundos END as uni_x_h
            FROM vol v
            LEFT JOIN tiempos t ON t.fecha_operativa = v.fecha_operativa
            ORDER BY v.fecha_operativa
          `);

        // 2) BY UOM (para tarjetas de CAJA / UNIDAD / PACK)
        const byUomResult = await connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .query(`
            SELECT
              UPPER(LTRIM(RTRIM(ISNULL(uom_text,'OTROS')))) as uom,
              SUM(cantidad) as unidades
            FROM bi.fact_operacion_evento
            WHERE operacion = 'PICKING'
              AND fecha_operativa >= @from_date
              AND fecha_operativa < @to_date
            GROUP BY UPPER(LTRIM(RTRIM(ISNULL(uom_text,'OTROS'))))
          `);

        // 3) KPIS (operarios + horas promedio por operario)
        const kpisResult = await connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .query(`
            WITH e AS (
              SELECT *
              FROM bi.fact_operacion_evento
              WHERE operacion = 'PICKING'
                AND fecha_operativa >= @from_date
                AND fecha_operativa < @to_date
            ),
            ops AS (
              SELECT
                fecha_operativa,
                usuario_id,
                operacion_rf_id,
                MIN(inicio_dt) as inicio_dt,
                MAX(fin_dt) as fin_dt
              FROM e
              WHERE operacion_rf_id IS NOT NULL
                AND inicio_dt IS NOT NULL
                AND fin_dt IS NOT NULL
              GROUP BY fecha_operativa, usuario_id, operacion_rf_id
            ),
            t_user_day AS (
              SELECT 
                fecha_operativa, 
                usuario_id, 
                SUM(DATEDIFF(SECOND, inicio_dt, fin_dt)) as segundos
              FROM ops
              GROUP BY fecha_operativa, usuario_id
            )
            SELECT
              COUNT(DISTINCT usuario_id) as operarios,
              CASE
                WHEN COUNT(DISTINCT usuario_id) > 0
                  THEN (SUM(segundos) / 3600.0) / COUNT(DISTINCT usuario_id)
              END as horas_promedio_por_operario
            FROM t_user_day
          `);

        // 4) PER OPERATOR (grilla)
        const perOperatorResult = await connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .query(`
            WITH e AS (
              SELECT *
              FROM bi.fact_operacion_evento
              WHERE operacion = 'PICKING'
                AND fecha_operativa >= @from_date
                AND fecha_operativa < @to_date
            ),
            ops AS (
              SELECT
                usuario_id,
                MAX(legajo) as legajo,
                MAX(operario) as operario,
                operacion_rf_id,
                MIN(inicio_dt) as inicio_dt,
                MAX(fin_dt) as fin_dt
              FROM e
              WHERE operacion_rf_id IS NOT NULL
                AND inicio_dt IS NOT NULL
                AND fin_dt IS NOT NULL
              GROUP BY usuario_id, operacion_rf_id
            ),
            t_user AS (
              SELECT 
                usuario_id, 
                legajo, 
                operario, 
                SUM(DATEDIFF(SECOND, inicio_dt, fin_dt)) as segundos
              FROM ops
              GROUP BY usuario_id, legajo, operario
            ),
            v_user AS (
              SELECT
                usuario_id,
                COUNT(*) as movimientos,
                SUM(cantidad) as unidades,
                SUM(CASE WHEN UPPER(uom_text)='CAJA' THEN cantidad ELSE 0 END) as cajas,
                SUM(CASE WHEN UPPER(uom_text)='UNIDAD' THEN cantidad ELSE 0 END) as unidades_uom,
                SUM(CASE WHEN UPPER(uom_text)='PACK' THEN cantidad ELSE 0 END) as packs
              FROM e
              GROUP BY usuario_id
            )
            SELECT
              v.usuario_id,
              t.legajo,
              t.operario,
              v.movimientos,
              v.unidades,
              v.cajas,
              v.unidades_uom,
              v.packs,
              ISNULL(t.segundos,0) / 3600.0 as horas,
              CASE WHEN ISNULL(t.segundos,0) > 0 THEN v.movimientos * 3600.0 / t.segundos END as mov_x_h,
              CASE WHEN ISNULL(t.segundos,0) > 0 THEN v.unidades * 3600.0 / t.segundos END as uni_x_h
            FROM v_user v
            LEFT JOIN t_user t ON t.usuario_id = v.usuario_id
            ORDER BY uni_x_h DESC, mov_x_h DESC
          `);

        // 5) DAILY PER OPERATOR (para gráfico de líneas por operario)
        const dailyPerOperatorResult = await connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .query(`
            WITH e AS (
              SELECT *
              FROM bi.fact_operacion_evento
              WHERE operacion = 'PICKING'
                AND fecha_operativa >= @from_date
                AND fecha_operativa < @to_date
            ),
            ops AS (
              SELECT
                fecha_operativa,
                usuario_id,
                operacion_rf_id,
                MIN(inicio_dt) as inicio_dt,
                MAX(fin_dt) as fin_dt
              FROM e
              WHERE operacion_rf_id IS NOT NULL
                AND inicio_dt IS NOT NULL
                AND fin_dt IS NOT NULL
              GROUP BY fecha_operativa, usuario_id, operacion_rf_id
            ),
            t_user_day AS (
              SELECT 
                fecha_operativa, 
                usuario_id, 
                SUM(DATEDIFF(SECOND, inicio_dt, fin_dt)) as segundos
              FROM ops
              GROUP BY fecha_operativa, usuario_id
            ),
            v_user_day AS (
              SELECT 
                fecha_operativa,
                usuario_id,
                COUNT(*) as movimientos,
                SUM(cantidad) as unidades
              FROM e
              GROUP BY fecha_operativa, usuario_id
            )
            SELECT
              d.fecha_operativa,
              d.usuario_id,
              MAX(o.operario) as operario,
              MAX(o.legajo) as legajo,
              d.movimientos,
              d.unidades,
              ISNULL(t.segundos,0) as segundos,
              CASE WHEN ISNULL(t.segundos,0) > 0 THEN d.unidades * 3600.0 / t.segundos END as uni_x_h,
              CASE WHEN ISNULL(t.segundos,0) > 0 THEN d.movimientos * 3600.0 / t.segundos END as mov_x_h
            FROM v_user_day d
            LEFT JOIN t_user_day t ON t.fecha_operativa = d.fecha_operativa AND t.usuario_id = d.usuario_id
            LEFT JOIN (
              SELECT DISTINCT usuario_id, operario, legajo
              FROM bi.fact_operacion_evento
              WHERE operacion = 'PICKING'
                AND fecha_operativa >= @from_date
                AND fecha_operativa < @to_date
                AND operario IS NOT NULL
            ) o ON o.usuario_id = d.usuario_id
            GROUP BY d.fecha_operativa, d.usuario_id, d.movimientos, d.unidades, t.segundos
            ORDER BY d.fecha_operativa, d.usuario_id
          `);

        // 6) DAILY DETAIL GRID (para grilla detallada por operario y día)
        const dailyDetailGridResult = await connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .query(`
            WITH e AS (
              SELECT *
              FROM bi.fact_operacion_evento
              WHERE operacion = 'PICKING'
                AND fecha_operativa >= @from_date
                AND fecha_operativa < @to_date
            ),
            ops AS (
              SELECT
                fecha_operativa,
                usuario_id,
                operacion_rf_id,
                MIN(inicio_dt) as inicio_dt,
                MAX(fin_dt) as fin_dt
              FROM e
              WHERE operacion_rf_id IS NOT NULL
                AND inicio_dt IS NOT NULL
                AND fin_dt IS NOT NULL
              GROUP BY fecha_operativa, usuario_id, operacion_rf_id
            ),
            t_user_day AS (
              SELECT 
                fecha_operativa, 
                usuario_id, 
                SUM(DATEDIFF(SECOND, inicio_dt, fin_dt)) as segundos
              FROM ops
              GROUP BY fecha_operativa, usuario_id
            ),
            v_user_day AS (
              SELECT 
                fecha_operativa,
                usuario_id,
                COUNT(*) as movimientos,
                SUM(cantidad) as unidades
              FROM e
              GROUP BY fecha_operativa, usuario_id
            )
            SELECT
              d.fecha_operativa,
              d.usuario_id,
              MAX(o.operario) as operario,
              MAX(o.legajo) as legajo,
              d.movimientos,
              d.unidades as bultos,
              ISNULL(t.segundos,0) / 60.0 as minutos,
              CASE WHEN ISNULL(t.segundos,0) > 0 THEN d.unidades * 3600.0 / t.segundos END as productividad
            FROM v_user_day d
            LEFT JOIN t_user_day t ON t.fecha_operativa = d.fecha_operativa AND t.usuario_id = d.usuario_id
            LEFT JOIN (
              SELECT DISTINCT usuario_id, operario, legajo
              FROM bi.fact_operacion_evento
              WHERE operacion = 'PICKING'
                AND fecha_operativa >= @from_date
                AND fecha_operativa < @to_date
                AND operario IS NOT NULL
            ) o ON o.usuario_id = d.usuario_id
            GROUP BY d.fecha_operativa, d.usuario_id, d.movimientos, d.unidades, t.segundos
            ORDER BY d.fecha_operativa DESC, d.usuario_id
          `);

        // Procesar resultados
        console.log('=== RAW RESULTS ===');
        console.log('Daily result:', dailyResult.recordset);
        console.log('ByUOM result:', byUomResult.recordset);
        console.log('KPIs result:', kpisResult.recordset);
        console.log('PerOperator result:', perOperatorResult.recordset);
        console.log('DailyPerOperator result:', dailyPerOperatorResult.recordset);
        console.log('DailyDetailGrid result:', dailyDetailGridResult.recordset);
        
        const daily = dailyResult.recordset.map((row: any) => ({
          fecha_operativa: row.fecha_operativa,
          unidades: row.unidades || 0,
          movimientos: row.movimientos || 0,
          segundos: row.segundos || 0,
          uni_x_h: parseFloat(row.uni_x_h || 0),
          mov_x_h: parseFloat(row.mov_x_h || 0)
        }));

        const byUom = byUomResult.recordset;
        
        // Mapear a cards
        let cajas = 0, unidades_uom = 0, packs = 0;
        byUom.forEach((row: any) => {
          const uom = (row.uom || '').toUpperCase();
          console.log('Processing UOM:', uom, 'value:', row.unidades);
          if (uom === 'CAJA') cajas = row.unidades;
          else if (uom === 'UNIDAD') unidades_uom = row.unidades;
          else if (uom === 'PACK') packs = row.unidades;
        });

        const kpisRow = kpisResult.recordset[0] as any;
        const cards = {
          cajas,
          unidades_uom,
          packs,
          operarios: kpisRow?.operarios || 0,
          horas_promedio_por_operario: parseFloat(kpisRow?.horas_promedio_por_operario || 0)
        };

        const perOperator = perOperatorResult.recordset.map((row: any) => ({
          usuario_id: row.usuario_id,
          legajo: row.legajo,
          operario: row.operario,
          horas: parseFloat(row.horas || 0),
          movimientos: row.movimientos || 0,
          unidades: row.unidades || 0,
          cajas: row.cajas || 0,
          unidades_uom: row.unidades_uom || 0,
          packs: row.packs || 0,
          uni_x_h: parseFloat(row.uni_x_h || 0),
          mov_x_h: parseFloat(row.mov_x_h || 0)
        }));

        const dailyPerOperator = dailyPerOperatorResult.recordset.map((row: any) => ({
          fecha_operativa: row.fecha_operativa,
          usuario_id: row.usuario_id,
          operario: row.operario || `Operario ${row.usuario_id}`,
          unidades: row.unidades || 0,
          movimientos: row.movimientos || 0,
          segundos: row.segundos || 0,
          uni_x_h: parseFloat(row.uni_x_h || 0),
          mov_x_h: parseFloat(row.mov_x_h || 0)
        }));

        const dailyDetailGrid = dailyDetailGridResult.recordset.map((row: any) => ({
          fecha_operativa: row.fecha_operativa,
          usuario_id: row.usuario_id,
          operario: row.operario || `Operario ${row.usuario_id}`,
          legajo: row.legajo || '',
          bultos: row.bultos || 0,
          minutos: parseFloat(row.minutos || 0),
          productividad: parseFloat(row.productividad || 0)
        }));

        console.log('=== PROCESSED RESULTS ===');
        console.log('Daily processed:', daily);
        console.log('Cards processed:', cards);
        console.log('PerOperator processed:', perOperator);
        console.log('DailyPerOperator processed:', dailyPerOperator);
        console.log('DailyDetailGrid processed:', dailyDetailGrid);

        // Estructurar respuesta
        const response = {
          from: from_date,
          to: to_date,
          operacion: operacion,
          daily,
          cards,
          perOperator,
          dailyPerOperator,
          dailyDetailGrid
        };

        // Cache response
        const cacheTtl = 60; // 1 minuto
        cache.set(cacheKey, response);

        console.log('Productivity response generated successfully');

        return reply.send(response);

      } catch (error) {
        console.error('Productivity error:', error);
        
        const errorRes = {
          ok: false,
          error: { 
            code: "DATABASE_ERROR", 
            message: "Error al obtener datos de productividad" 
          }
        };
        return reply.status(500).send(errorRes);
      }
    }
  );
};
