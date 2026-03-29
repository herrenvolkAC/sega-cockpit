import { FastifyInstance } from "fastify";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { getPool } from "../db";
import { ErrorResponse } from "../types";

const cache = new MemoryCache<any>(config.cacheTtlSeconds);

const errorResponse = (code: string, message: string): ErrorResponse => ({
  ok: false,
  error: { code, message },
});

export const slottingRoute = async (app: FastifyInstance): Promise<void> => {
  app.get("/slotting", async (request, reply) => {
    const startedAt = Date.now();
    const cacheKey = "slotting_sugerencias";

    const cached = cache.get(cacheKey);
    if (cached) {
      request.log.info({
        endpoint: "/slotting",
        durationMs: Date.now() - startedAt,
        cache: "hit",
      });
      return reply.send(cached);
    }

    try {
      const pool = await getPool();

      const result = await pool.request().query(`
        SELECT
          sku,
          articulo,
          tipologia_actual_observada,
          grupo_tipologia_actual,
          sugerencia,
          grupo_tipologia_objetivo,
          lineas_picking,
          unidades_pickeadas,
          avg_qty_por_linea,
          porc_lineas_unitarias,
          porc_lineas_multiplo_caja,
          porc_lineas_multiplo_pallet,
          lineas_por_1000_unidades,
          dias_con_actividad,
          ubicaciones_distintas,
          porc_unidades_desde_ubic_asignada,
          score_hacia_rack_pallet,
          score_hacia_balda,
          prioridad,
          lineas_potencialmente_evitables,
          ventana_desde,
          ventana_hasta,
          loaded_at
        FROM [bi].[fact_slotting_sugerencias]
        ORDER BY
          CASE WHEN sugerencia LIKE 'SUGERIR:%' THEN 0 ELSE 1 END,
          lineas_potencialmente_evitables DESC,
          prioridad DESC,
          lineas_picking DESC
      `);

      const rows = result.recordset;

      // KPIs agregados
      const totalEvaluados = rows.length;
      const conSugerencia = rows.filter((r: any) =>
        r.sugerencia?.startsWith("SUGERIR:")
      ).length;
      const rackToBalda = rows.filter(
        (r: any) => r.sugerencia === "SUGERIR: RACK/PALLET -> BALDA"
      ).length;
      const baldaToRack = rows.filter(
        (r: any) => r.sugerencia === "SUGERIR: BALDA -> RACK/PALLET"
      ).length;
      const aRevisar = rows.filter((r: any) =>
        r.sugerencia?.startsWith("REVISAR")
      ).length;
      const lineasEvitables = rows.reduce(
        (sum: number, r: any) =>
          sum + (Number(r.lineas_potencialmente_evitables) || 0),
        0
      );

      const metadata =
        rows.length > 0
          ? {
              ventana_desde: rows[0].ventana_desde,
              ventana_hasta: rows[0].ventana_hasta,
              loaded_at: rows[0].loaded_at,
            }
          : null;

      // Top 10 por líneas evitables (para el gráfico)
      const top10 = rows
        .filter(
          (r: any) => (Number(r.lineas_potencialmente_evitables) || 0) > 0
        )
        .slice(0, 10)
        .map((r: any) => ({
          sku: r.sku,
          articulo: r.articulo,
          lineas_evitables: Number(r.lineas_potencialmente_evitables),
          sugerencia: r.sugerencia,
          grupo_tipologia_objetivo: r.grupo_tipologia_objetivo,
        }));

      const response = {
        ok: true,
        kpis: {
          totalEvaluados,
          conSugerencia,
          rackToBalda,
          baldaToRack,
          aRevisar,
          lineasEvitables,
        },
        top10,
        detalle: rows.map((r: any) => ({
          sku: r.sku,
          articulo: r.articulo,
          tipologia_actual_observada: r.tipologia_actual_observada,
          grupo_tipologia_actual: r.grupo_tipologia_actual,
          sugerencia: r.sugerencia,
          grupo_tipologia_objetivo: r.grupo_tipologia_objetivo,
          lineas_picking: Number(r.lineas_picking),
          unidades_pickeadas: Number(r.unidades_pickeadas),
          avg_qty_por_linea: Number(r.avg_qty_por_linea),
          porc_lineas_unitarias: Number(r.porc_lineas_unitarias),
          porc_lineas_multiplo_caja: Number(r.porc_lineas_multiplo_caja),
          porc_lineas_multiplo_pallet: Number(r.porc_lineas_multiplo_pallet),
          lineas_por_1000_unidades: Number(r.lineas_por_1000_unidades),
          dias_con_actividad: Number(r.dias_con_actividad),
          ubicaciones_distintas: Number(r.ubicaciones_distintas),
          porc_unidades_desde_ubic_asignada: Number(
            r.porc_unidades_desde_ubic_asignada
          ),
          score_hacia_rack_pallet: Number(r.score_hacia_rack_pallet),
          score_hacia_balda: Number(r.score_hacia_balda),
          prioridad: Number(r.prioridad),
          lineas_potencialmente_evitables:
            r.lineas_potencialmente_evitables !== null
              ? Number(r.lineas_potencialmente_evitables)
              : null,
        })),
        metadata,
      };

      cache.set(cacheKey, response);
      request.log.info({
        endpoint: "/slotting",
        durationMs: Date.now() - startedAt,
        cache: "miss",
        rows: totalEvaluados,
      });
      return reply.send(response);
    } catch (err: any) {
      request.log.error({ endpoint: "/slotting", error: err.message });
      return reply
        .status(500)
        .send(errorResponse("INTERNAL_ERROR", "Error al consultar datos de slotting"));
    }
  });
};
