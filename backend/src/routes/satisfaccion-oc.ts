import { FastifyInstance } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { getPool } from "../db";
import { ErrorResponse } from "../types";

interface SatisfaccionOcQuerystring {
  estado?: string;   // "activas" | "cerradas" | "all"  (default "all")
  proveedor?: string;
}

const cache = new MemoryCache<any>(config.cacheTtlSeconds);

const errorResponse = (code: string, message: string): ErrorResponse => ({
  ok: false,
  error: { code, message },
});

// activo = 1 → OC vigente/abierta en el WMS
// activo = 0 → OC cerrada/finalizada en el WMS

export const satisfaccionOcRoute = async (app: FastifyInstance): Promise<void> => {
  app.get("/satisfaccion-oc", async (request, reply) => {
    const startedAt = Date.now();
    const qs = request.query as SatisfaccionOcQuerystring;

    const estadoParam  = qs.estado    ?? "all";
    const proveedor    = qs.proveedor?.trim() ?? "";

    const cacheKey = `satisfaccion-oc_${estadoParam}_${proveedor || "all"}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      request.log.info({ endpoint: "/satisfaccion-oc", durationMs: Date.now() - startedAt, cache: "hit" });
      return cached;
    }

    try {
      const pool = await getPool();

      // activas = activo 1, cerradas = activo 0, all = sin filtro
      const estadoFilter =
        estadoParam === "activas"  ? "AND activo = 1" :
        estadoParam === "cerradas" ? "AND activo = 0" :
                                     "";

      const proveedorFilter = proveedor ? "AND proveedor = @proveedor" : "";

      const baseFilters = `${estadoFilter} ${proveedorFilter}`;

      const makeRequest = () => {
        const req = pool.request();
        if (proveedor) req.input("proveedor", sql.VarChar(200), proveedor);
        return req;
      };

      // ── 1. KPIs generales — agrupa por activo (1=activas, 0=cerradas) ─────────
      //    Devuelve siempre ambas filas para alimentar los dos tabs sin segunda llamada.
      //    porc_satisfaccion está en escala 0–1 → se multiplica × 100 al agregar.
      const kpisQuery = `
        SELECT
          es_cerrada            = CASE WHEN activo = 0 THEN 1 ELSE 0 END,
          total_lineas          = COUNT(*),
          total_oc              = COUNT(DISTINCT oc),
          lineas_completas      = SUM(CASE WHEN completa_flag = 1 THEN 1 ELSE 0 END),
          lineas_parciales      = SUM(CASE WHEN completa_flag = 0
                                            AND unidades_recibidas > 0 THEN 1 ELSE 0 END),
          lineas_sin_recepcion  = SUM(CASE WHEN unidades_recibidas  = 0 THEN 1 ELSE 0 END),
          unidades_pedidas      = SUM(unidades_pedidas),
          unidades_recibidas    = SUM(unidades_recibidas),
          unidades_pendientes   = SUM(unidades_pendientes),
          cajas_pedidas         = SUM(ISNULL(cajas_pedidas,    0)),
          cajas_recibidas       = SUM(ISNULL(cajas_recibidas,  0)),
          cajas_pendientes      = SUM(ISNULL(cajas_pendientes, 0)),
          satisfaccion_promedio = AVG(CASE WHEN unidades_pedidas > 0
                                     THEN porc_satisfaccion * 100.0 END)
        FROM bi.fact_satisfaccion_oc_actual WITH (NOLOCK)
        WHERE 1=1 ${proveedorFilter}
        GROUP BY CASE WHEN activo = 0 THEN 1 ELSE 0 END
        OPTION (RECOMPILE)
      `;

      // ── 2. Distribución por rango de satisfacción ────────────────────────────
      const distribucionQuery = `
        ;WITH normalizado AS (
          SELECT
            oc,
            pct = porc_satisfaccion * 100.0
          FROM bi.fact_satisfaccion_oc_actual WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
        )
        SELECT
          rango = CASE
                    WHEN pct >= 100 THEN '100% Completa'
                    WHEN pct >= 80  THEN '80–99% Alta'
                    WHEN pct >= 50  THEN '50–79% Media'
                    WHEN pct >  0   THEN '1–49% Baja'
                    ELSE '0% Sin recepción'
                  END,
          orden = CASE
                    WHEN pct >= 100 THEN 1
                    WHEN pct >= 80  THEN 2
                    WHEN pct >= 50  THEN 3
                    WHEN pct >  0   THEN 4
                    ELSE 5
                  END,
          cant_lineas = COUNT(*),
          cant_oc     = COUNT(DISTINCT oc)
        FROM normalizado
        GROUP BY
          CASE
            WHEN pct >= 100 THEN '100% Completa'
            WHEN pct >= 80  THEN '80–99% Alta'
            WHEN pct >= 50  THEN '50–79% Media'
            WHEN pct >  0   THEN '1–49% Baja'
            ELSE '0% Sin recepción'
          END,
          CASE
            WHEN pct >= 100 THEN 1
            WHEN pct >= 80  THEN 2
            WHEN pct >= 50  THEN 3
            WHEN pct >  0   THEN 4
            ELSE 5
          END
        ORDER BY orden
        OPTION (RECOMPILE)
      `;

      // ── 3. Top 15 proveedores con peor satisfacción ──────────────────────────
      //    Limitado a 15 para que el gráfico de barras sea legible en pantalla.
      const porProveedorQuery = `
        ;WITH base AS (
          SELECT
            proveedor             = ISNULL(proveedor, '(sin proveedor)'),
            total_oc              = COUNT(DISTINCT oc),
            total_lineas          = COUNT(*),
            lineas_completas      = SUM(CASE WHEN completa_flag = 1 THEN 1 ELSE 0 END),
            unidades_pedidas      = SUM(unidades_pedidas),
            unidades_recibidas    = SUM(unidades_recibidas),
            unidades_pendientes   = SUM(unidades_pendientes),
            satisfaccion_promedio = AVG(CASE WHEN unidades_pedidas > 0
                                       THEN porc_satisfaccion * 100.0 END)
          FROM bi.fact_satisfaccion_oc_actual WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
          GROUP BY ISNULL(proveedor, '(sin proveedor)')
        )
        SELECT TOP 15 *
        FROM base
        ORDER BY satisfaccion_promedio ASC
        OPTION (RECOMPILE)
      `;

      // ── 4. OCs próximas a vencer con recepción incompleta (solo activas) ──────
      const proximasVencerQuery = `
        SELECT TOP 15
          oc,
          proveedor             = ISNULL(proveedor, '(sin proveedor)'),
          fin_vigencia,
          dias_para_vencer      = DATEDIFF(DAY, GETDATE(), fin_vigencia),
          lineas_totales        = COUNT(*),
          lineas_completas      = SUM(CASE WHEN completa_flag = 1 THEN 1 ELSE 0 END),
          unidades_pedidas      = SUM(unidades_pedidas),
          unidades_recibidas    = SUM(unidades_recibidas),
          unidades_pendientes   = SUM(unidades_pendientes),
          satisfaccion_promedio = AVG(CASE WHEN unidades_pedidas > 0
                                     THEN porc_satisfaccion * 100.0 END)
        FROM bi.fact_satisfaccion_oc_actual WITH (NOLOCK)
        WHERE activo = 1
          AND fin_vigencia >= GETDATE()
          AND completa_flag = 0
          ${proveedorFilter}
        GROUP BY oc, ISNULL(proveedor, '(sin proveedor)'), fin_vigencia
        ORDER BY dias_para_vencer ASC, satisfaccion_promedio ASC
        OPTION (RECOMPILE)
      `;

      // ── 5. Top 15 artículos con mayor unidades pendientes ────────────────────
      const topArticulosQuery = `
        ;WITH base AS (
          SELECT
            articulo              = ISNULL(articulo, '(sin descripción)'),
            cant_oc               = COUNT(DISTINCT oc),
            unidades_pendientes   = SUM(unidades_pendientes),
            unidades_pedidas      = SUM(unidades_pedidas),
            unidades_recibidas    = SUM(unidades_recibidas),
            cajas_pendientes      = SUM(ISNULL(cajas_pendientes, 0)),
            satisfaccion_promedio = AVG(CASE WHEN unidades_pedidas > 0
                                       THEN porc_satisfaccion * 100.0 END)
          FROM bi.fact_satisfaccion_oc_actual WITH (NOLOCK)
          WHERE unidades_pendientes > 0
            ${baseFilters}
          GROUP BY ISNULL(articulo, '(sin descripción)')
        )
        SELECT TOP 15 *
        FROM base
        ORDER BY unidades_pendientes DESC
        OPTION (RECOMPILE)
      `;

      // ── 6. Evolución mensual de satisfacción en OCs cerradas ──────────────────
      //    CONVERT(varchar(7), ..., 120) reemplaza FORMAT() que es CLR y muy lenta.
      const evolucionCerradasQuery = `
        SELECT
          mes_cierre            = CONVERT(varchar(7), fin_vigencia, 120),
          total_oc              = COUNT(DISTINCT oc),
          oc_completas          = COUNT(DISTINCT CASE WHEN completa_flag = 1 THEN oc END),
          lineas_completas      = SUM(CASE WHEN completa_flag = 1 THEN 1 ELSE 0 END),
          lineas_totales        = COUNT(*),
          unidades_pedidas      = SUM(unidades_pedidas),
          unidades_recibidas    = SUM(unidades_recibidas),
          satisfaccion_promedio = AVG(CASE WHEN unidades_pedidas > 0
                                     THEN porc_satisfaccion * 100.0 END)
        FROM bi.fact_satisfaccion_oc_actual WITH (NOLOCK)
        WHERE activo = 0
          AND fin_vigencia IS NOT NULL
          ${proveedorFilter}
        GROUP BY CONVERT(varchar(7), fin_vigencia, 120)
        ORDER BY mes_cierre
        OPTION (RECOMPILE)
      `;

      // ── Ejecutar en paralelo ──────────────────────────────────────────────────
      const [
        kpisResult,
        distribucionResult,
        porProveedorResult,
        proximasVencerResult,
        topArticulosResult,
        evolucionCerradasResult,
      ] = await Promise.all([
        makeRequest().query(kpisQuery),
        makeRequest().query(distribucionQuery),
        makeRequest().query(porProveedorQuery),
        makeRequest().query(proximasVencerQuery),
        makeRequest().query(topArticulosQuery),
        makeRequest().query(evolucionCerradasQuery),
      ]);

      // Separar KPIs de activas y cerradas.
      // es_cerrada es int (0/1) pero se normaliza a número por si el driver
      // devuelve variantes (bit → boolean, o string).
      const kpiRows     = kpisResult.recordset as any[];
      const kpiActivas  = kpiRows.find((r) => Number(r.es_cerrada) === 0) ?? null;
      const kpiCerradas = kpiRows.find((r) => Number(r.es_cerrada) === 1) ?? null;

      const buildKpi = (r: any) => ({
        totalOc:              r.total_oc,
        totalLineas:          r.total_lineas,
        lineasCompletas:      r.lineas_completas,
        lineasParciales:      r.lineas_parciales,
        lineasSinRecepcion:   r.lineas_sin_recepcion,
        unidadesPedidas:      Number(r.unidades_pedidas),
        unidadesRecibidas:    Number(r.unidades_recibidas),
        unidadesPendientes:   Number(r.unidades_pendientes),
        cajasPedidas:         Number(r.cajas_pedidas),
        cajasRecibidas:       Number(r.cajas_recibidas),
        cajasPendientes:      Number(r.cajas_pendientes),
        satisfaccionPromedio: parseFloat(Number(r.satisfaccion_promedio ?? 0).toFixed(2)),
      });

      const response = {
        filtros: {
          estado:    estadoParam,
          proveedor: proveedor || null,
        },
        kpis: {
          activas:  kpiActivas  ? buildKpi(kpiActivas)  : null,
          cerradas: kpiCerradas ? buildKpi(kpiCerradas) : null,
        },
        graficos: {
          distribucion:      distribucionResult.recordset,
          porProveedor:      porProveedorResult.recordset,
          proximasVencer:    proximasVencerResult.recordset,
          topArticulos:      topArticulosResult.recordset,
          evolucionCerradas: evolucionCerradasResult.recordset,
        },
        generatedAt: new Date().toISOString(),
      };

      cache.set(cacheKey, response);

      request.log.info({
        endpoint: "/satisfaccion-oc",
        durationMs: Date.now() - startedAt,
        cache: "miss",
      });

      return response;
    } catch (error) {
      request.log.error({
        endpoint: "/satisfaccion-oc",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
      return reply
        .status(500)
        .send(errorResponse("DATABASE_ERROR", "Error al obtener datos de satisfacción de OC"));
    }
  });
};
