import { FastifyInstance } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { getPool } from "../db";
import { ErrorResponse } from "../types";

interface OcupacionQuerystring {
  fechaInicio?: string;
  fechaFin?: string;
  sector?: string;
  seccion?: string;
}

const cache = new MemoryCache<any>(config.cacheTtlSeconds);

const errorResponse = (code: string, message: string): ErrorResponse => ({
  ok: false,
  error: { code, message },
});

export const ocupacionRoute = async (app: FastifyInstance): Promise<void> => {
  app.get("/ocupacion", async (request, reply) => {
    const startedAt = Date.now();
    const qs = request.query as OcupacionQuerystring;
    const { fechaInicio, fechaFin, sector, seccion } = qs;

    if (!fechaInicio || !fechaFin) {
      return reply
        .status(400)
        .send(errorResponse("INVALID_DATES", "Se requieren fechaInicio y fechaFin"));
    }

    const cacheKey = `ocupacion_${fechaInicio}_${fechaFin}_${sector ?? "all"}_${seccion ?? "all"}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      request.log.info({ endpoint: "/ocupacion", durationMs: Date.now() - startedAt, cache: "hit" });
      return cached;
    }

    try {
      const pool = await getPool();

      const sectorFilter  = sector  ? "AND sector  = @sector"  : "";
      const seccionFilter = seccion ? "AND seccion = @seccion" : "";
      const baseFilters   = `${sectorFilter} ${seccionFilter}`;

      const makeRequest = () => {
        const req = pool.request();
        req.input("fechaInicio", sql.Date, fechaInicio);
        req.input("fechaFin",    sql.Date, fechaFin);
        if (sector)  req.input("sector",  sql.VarChar(100), sector);
        if (seccion) req.input("seccion", sql.VarChar(100), seccion);
        return req;
      };

      // ── 1. KPIs: snapshot del último día disponible en el rango ──────────────
      const kpisQuery = `
        WITH ultima_fecha AS (
          SELECT MAX(fecha) AS fecha
          FROM bi.fact_ocupacion_ubicaciones WITH (NOLOCK)
          WHERE fecha BETWEEN @fechaInicio AND @fechaFin
            ${baseFilters}
        ),
        snap AS (
          SELECT f.*
          FROM bi.fact_ocupacion_ubicaciones f WITH (NOLOCK)
          INNER JOIN ultima_fecha uf ON f.fecha = uf.fecha
          WHERE 1=1 ${baseFilters}
        )
        SELECT
          fecha_snapshot          = MAX(fecha),
          total_posiciones        = COUNT(*),
          capacidad_total         = SUM(ISNULL(capacidad, 0)),
          posiciones_con_stock    = SUM(CASE WHEN cant_contenedores > 0               THEN 1 ELSE 0 END),
          posiciones_libres       = SUM(CASE WHEN cant_contenedores = 0
                                              AND ISNULL(bloqueo, 0) = 0              THEN 1 ELSE 0 END),
          posiciones_bloqueadas   = SUM(CASE WHEN ISNULL(bloqueo, 0) > 0             THEN 1 ELSE 0 END),
          contenedores_totales    = SUM(cant_contenedores),
          cajas_totales           = SUM(ISNULL(cant_cajas, 0)),
          unidades_totales        = SUM(ISNULL(cant_unidades, 0)),
          lugares_libres_total    = SUM(ISNULL(lugares_libres, 0)),
          ocupacion_pct_global    = CASE
                                      WHEN SUM(ISNULL(capacidad, 0)) > 0
                                      THEN CAST(SUM(cant_contenedores) AS float)
                                           / NULLIF(SUM(ISNULL(capacidad, 0)), 0) * 100
                                      ELSE 0
                                    END
        FROM snap
        OPTION (RECOMPILE)
      `;

      // ── 2. Evolución temporal diaria ─────────────────────────────────────────
      const evolucionQuery = `
        SELECT
          fecha,
          total_posiciones      = COUNT(*),
          capacidad_total       = SUM(ISNULL(capacidad, 0)),
          posiciones_ocupadas   = SUM(CASE WHEN cant_contenedores > 0               THEN 1 ELSE 0 END),
          posiciones_libres     = SUM(CASE WHEN cant_contenedores = 0
                                            AND ISNULL(bloqueo, 0) = 0              THEN 1 ELSE 0 END),
          posiciones_bloqueadas = SUM(CASE WHEN ISNULL(bloqueo, 0) > 0             THEN 1 ELSE 0 END),
          contenedores_totales  = SUM(cant_contenedores),
          ocupacion_pct         = CASE
                                    WHEN SUM(ISNULL(capacidad, 0)) > 0
                                    THEN CAST(SUM(cant_contenedores) AS float)
                                         / NULLIF(SUM(ISNULL(capacidad, 0)), 0) * 100
                                    ELSE 0
                                  END
        FROM bi.fact_ocupacion_ubicaciones WITH (NOLOCK)
        WHERE fecha BETWEEN @fechaInicio AND @fechaFin
          ${baseFilters}
        GROUP BY fecha
        ORDER BY fecha
        OPTION (RECOMPILE)
      `;

      // ── 3. Ocupación por sector (último día) ─────────────────────────────────
      const sectorQuery = `
        WITH ultima_fecha AS (
          SELECT MAX(fecha) AS fecha
          FROM bi.fact_ocupacion_ubicaciones WITH (NOLOCK)
          WHERE fecha BETWEEN @fechaInicio AND @fechaFin
            ${baseFilters}
        )
        SELECT
          f.sector,
          posiciones            = COUNT(*),
          capacidad_total       = SUM(ISNULL(f.capacidad, 0)),
          posiciones_ocupadas   = SUM(CASE WHEN f.cant_contenedores > 0              THEN 1 ELSE 0 END),
          posiciones_libres     = SUM(CASE WHEN f.cant_contenedores = 0
                                            AND ISNULL(f.bloqueo, 0) = 0             THEN 1 ELSE 0 END),
          posiciones_bloqueadas = SUM(CASE WHEN ISNULL(f.bloqueo, 0) > 0            THEN 1 ELSE 0 END),
          contenedores          = SUM(f.cant_contenedores),
          ocupacion_pct         = CASE
                                    WHEN SUM(ISNULL(f.capacidad, 0)) > 0
                                    THEN CAST(SUM(f.cant_contenedores) AS float)
                                         / NULLIF(SUM(ISNULL(f.capacidad, 0)), 0) * 100
                                    ELSE 0
                                  END
        FROM bi.fact_ocupacion_ubicaciones f WITH (NOLOCK)
        INNER JOIN ultima_fecha uf ON f.fecha = uf.fecha
        WHERE 1=1 ${baseFilters}
        GROUP BY f.sector
        ORDER BY ocupacion_pct DESC
        OPTION (RECOMPILE)
      `;

      // ── 4. Top secciones por % de ocupación (último día) ─────────────────────
      const seccionQuery = `
        WITH ultima_fecha AS (
          SELECT MAX(fecha) AS fecha
          FROM bi.fact_ocupacion_ubicaciones WITH (NOLOCK)
          WHERE fecha BETWEEN @fechaInicio AND @fechaFin
            ${baseFilters}
        ),
        base AS (
          SELECT
            f.seccion,
            posiciones        = COUNT(*),
            capacidad_total   = SUM(ISNULL(f.capacidad, 0)),
            contenedores      = SUM(f.cant_contenedores),
            ocupacion_pct     = CASE
                                  WHEN SUM(ISNULL(f.capacidad, 0)) > 0
                                  THEN CAST(SUM(f.cant_contenedores) AS float)
                                       / NULLIF(SUM(ISNULL(f.capacidad, 0)), 0) * 100
                                  ELSE 0
                                END
          FROM bi.fact_ocupacion_ubicaciones f WITH (NOLOCK)
          INNER JOIN ultima_fecha uf ON f.fecha = uf.fecha
          WHERE 1=1 ${baseFilters}
          GROUP BY f.seccion
        ),
        ranked AS (
          SELECT *, rn = ROW_NUMBER() OVER (ORDER BY ocupacion_pct DESC)
          FROM base
        )
        SELECT
          seccion       = CASE WHEN rn <= 15 THEN seccion ELSE 'Otros' END,
          posiciones    = SUM(posiciones),
          contenedores  = SUM(contenedores),
          ocupacion_pct = AVG(ocupacion_pct)
        FROM ranked
        GROUP BY CASE WHEN rn <= 15 THEN seccion ELSE 'Otros' END
        ORDER BY MAX(rn)
        OPTION (RECOMPILE)
      `;

      // ── 5. Picking vs Reserva/Bulto (último día) ─────────────────────────────
      const pickingReservaQuery = `
        WITH ultima_fecha AS (
          SELECT MAX(fecha) AS fecha
          FROM bi.fact_ocupacion_ubicaciones WITH (NOLOCK)
          WHERE fecha BETWEEN @fechaInicio AND @fechaFin
            ${baseFilters}
        )
        SELECT
          tipo_ubicacion      = CASE WHEN f.es_de_picking = 1 THEN 'Picking' ELSE 'Reserva / Bulto' END,
          posiciones          = COUNT(*),
          capacidad_total     = SUM(ISNULL(f.capacidad, 0)),
          posiciones_ocupadas = SUM(CASE WHEN f.cant_contenedores > 0 THEN 1 ELSE 0 END),
          contenedores        = SUM(f.cant_contenedores),
          ocupacion_pct       = CASE
                                  WHEN SUM(ISNULL(f.capacidad, 0)) > 0
                                  THEN CAST(SUM(f.cant_contenedores) AS float)
                                       / NULLIF(SUM(ISNULL(f.capacidad, 0)), 0) * 100
                                  ELSE 0
                                END
        FROM bi.fact_ocupacion_ubicaciones f WITH (NOLOCK)
        INNER JOIN ultima_fecha uf ON f.fecha = uf.fecha
        WHERE 1=1 ${baseFilters}
        GROUP BY CASE WHEN f.es_de_picking = 1 THEN 'Picking' ELSE 'Reserva / Bulto' END
        OPTION (RECOMPILE)
      `;

      // ── Ejecutar todas las queries en paralelo ────────────────────────────────
      const [
        kpisResult,
        evolucionResult,
        sectorResult,
        seccionResult,
        pickingReservaResult,
      ] = await Promise.all([
        makeRequest().query(kpisQuery),
        makeRequest().query(evolucionQuery),
        makeRequest().query(sectorQuery),
        makeRequest().query(seccionQuery),
        makeRequest().query(pickingReservaQuery),
      ]);

      const kpi = kpisResult.recordset[0] as any;

      const response = {
        fechaInicio,
        fechaFin,
        filtros: {
          sector:  sector  ?? null,
          seccion: seccion ?? null,
        },
        snapshot: {
          fecha: kpi?.fecha_snapshot ?? null,
        },
        kpis: {
          totalPosiciones:      kpi?.total_posiciones      ?? 0,
          capacidadTotal:       kpi?.capacidad_total       ?? 0,
          posicionesConStock:   kpi?.posiciones_con_stock  ?? 0,
          posicionesLibres:     kpi?.posiciones_libres     ?? 0,
          posicionesBloqueadas: kpi?.posiciones_bloqueadas ?? 0,
          contenedoresTotales:  kpi?.contenedores_totales  ?? 0,
          cajasTotales:         kpi?.cajas_totales         ?? 0,
          unidadesTotales:      kpi?.unidades_totales      ?? 0,
          lugaresLibresTotal:   kpi?.lugares_libres_total  ?? 0,
          ocupacionPctGlobal:   parseFloat((kpi?.ocupacion_pct_global ?? 0).toFixed(2)),
        },
        graficos: {
          evolucionDiaria:  evolucionResult.recordset,
          porSector:        sectorResult.recordset,
          porSeccion:       seccionResult.recordset,
          pickingVsReserva: pickingReservaResult.recordset,
        },
        generatedAt: new Date().toISOString(),
      };

      cache.set(cacheKey, response);

      request.log.info({
        endpoint: "/ocupacion",
        durationMs: Date.now() - startedAt,
        cache: "miss",
      });

      return response;
    } catch (error) {
      request.log.error({
        endpoint: "/ocupacion",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
      return reply
        .status(500)
        .send(errorResponse("DATABASE_ERROR", "Error al obtener datos de ocupación del almacén"));
    }
  });
};
