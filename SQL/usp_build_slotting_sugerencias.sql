/****** Object: StoredProcedure [bi].[usp_build_slotting_sugerencias]   ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [bi].[usp_build_slotting_sugerencias]
    @desde  datetime,   -- inicio ventana de picks (inclusivo)
    @hasta  datetime    -- fin ventana de picks (exclusivo)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    /* ================================================================
       Re-slotting: detecta SKUs cuya tipología de almacenamiento
       (BALDA vs RACK/PALLET) no coincide con su comportamiento real
       de picking. Ejecutar 1 vez/día. Reemplaza el contenido completo.
       Ventana recomendada: últimos 30 días corridos.
       ================================================================ */

    BEGIN TRANSACTION;

        TRUNCATE TABLE [bi].[fact_slotting_sugerencias];

        ;WITH pick_base AS (
            SELECT
                TRY_CONVERT(datetime, tr.FECHA_REALIZADO, 120)              AS dt_real,
                tr.id_articulo                                               AS IdArticulo,
                a.CODE_ERP                                                   AS SKU,
                a.DESCRIPCION                                                AS Articulo,
                tr.CANT_TRASPASADA                                           AS Qty,
                tr.ID_UBIC_ORIGEN                                            AS IdUbicacionOrigen,
                tu.NOMBRE                                                    AS TipoUbicacionOrigen,
                CASE WHEN ub.ID_ARTICULO = tr.id_articulo THEN 1 ELSE 0 END AS IsAssignedLoc,
                fx.CANT_FORM_BASE                                            AS UnidadesXCaja,
                (p.NUMERO_CAPAS * p.NUMERO_FORM_X_CAPA * fx.CANT_FORM_BASE) AS UnidadesXPalet
            FROM traspasos tr
            JOIN articulos             a   ON tr.id_articulo     = a.id
            JOIN UBICALMACENES         ub  ON tr.ID_UBIC_ORIGEN  = ub.ID
            JOIN TIPOS_UBIC_ALMACEN    tu  ON ub.ID_TIPO_UBICALM = tu.ID
            LEFT JOIN FORMATOS         fx  ON fx.ID_ARTICULO     = a.id
                                          AND fx.NOMBRE_FORMATO  = 'CAJA'
            LEFT JOIN PALETIZACIONES   p   ON p.ID_FORMATO       = fx.id
                                          AND p.ES_PALET_ESTANDAR = 1
            WHERE tr.TIPO_TRASPASO   = 0
              AND tr.CANT_TRASPASADA > 0
              AND TRY_CONVERT(datetime, tr.FECHA_REALIZADO, 120) IS NOT NULL
              AND TRY_CONVERT(datetime, tr.FECHA_REALIZADO, 120) >= @desde
              AND TRY_CONVERT(datetime, tr.FECHA_REALIZADO, 120) <  @hasta
        ),

        tipo_obs AS (
            SELECT
                SKU,
                TipoUbicacionOrigen,
                SUM(Qty)  AS UnitsInTipo,
                COUNT(*)  AS LinesInTipo,
                ROW_NUMBER() OVER (
                    PARTITION BY SKU
                    ORDER BY SUM(Qty) DESC, COUNT(*) DESC, MIN(TipoUbicacionOrigen) ASC
                ) AS rn
            FROM pick_base
            GROUP BY SKU, TipoUbicacionOrigen
        ),

        sku_stats AS (
            SELECT
                p.SKU,
                MAX(p.Articulo)                                                                      AS Articulo,
                COUNT(*)                                                                             AS PickLines,
                SUM(p.Qty)                                                                           AS UnitsPicked,
                CAST(SUM(p.Qty) * 1.0 / NULLIF(COUNT(*), 0)                      AS decimal(18,2)) AS AvgQtyPerLine,
                CAST(SUM(CASE WHEN p.Qty = 1 THEN 1 ELSE 0 END) * 1.0
                     / NULLIF(COUNT(*), 0)                                         AS decimal(18,4)) AS PctUnitLines,
                CAST(SUM(CASE WHEN ISNULL(p.UnidadesXCaja, 0)  > 0
                               AND p.Qty % p.UnidadesXCaja  = 0 THEN 1 ELSE 0 END) * 1.0
                     / NULLIF(COUNT(*), 0)                                         AS decimal(18,4)) AS PctCaseMultipleLines,
                CAST(SUM(CASE WHEN ISNULL(p.UnidadesXPalet, 0) > 0
                               AND p.Qty % p.UnidadesXPalet = 0 THEN 1 ELSE 0 END) * 1.0
                     / NULLIF(COUNT(*), 0)                                         AS decimal(18,4)) AS PctPalletMultipleLines,
                CAST(COUNT(*) * 1000.0 / NULLIF(SUM(p.Qty), 0)                   AS decimal(18,2)) AS LinesPer1000Units,
                COUNT(DISTINCT p.IdUbicacionOrigen)                                                 AS DistinctPickLocations,
                COUNT(DISTINCT CAST(p.dt_real AS date))                                             AS ActiveDays,
                CAST(SUM(CASE WHEN p.IsAssignedLoc = 1 THEN p.Qty ELSE 0 END) * 1.0
                     / NULLIF(SUM(p.Qty), 0)                                       AS decimal(18,4)) AS PctUnitsFromAssignedLoc
            FROM pick_base p
            GROUP BY p.SKU
        ),

        scored AS (
            SELECT
                ss.*,
                tobs.TipoUbicacionOrigen AS TipologiaActualObservada,
                CASE
                    WHEN tobs.TipoUbicacionOrigen = 'Camara Carn. Estante'
                      OR tobs.TipoUbicacionOrigen LIKE 'Estantes%'
                      OR tobs.TipoUbicacionOrigen LIKE 'Estantería%'  THEN 'BALDA'
                    WHEN tobs.TipoUbicacionOrigen LIKE 'Rack %'
                      OR tobs.TipoUbicacionOrigen LIKE 'Salon Rack %'
                      OR tobs.TipoUbicacionOrigen LIKE 'Racks %'      THEN 'RACK_PALLET'
                    WHEN tobs.TipoUbicacionOrigen LIKE 'Mesa %'       THEN 'MESA'
                    WHEN tobs.TipoUbicacionOrigen LIKE 'Camara %'     THEN 'CAMARA'
                    WHEN tobs.TipoUbicacionOrigen LIKE 'Serv.%'       THEN 'SERVICIO'
                    WHEN tobs.TipoUbicacionOrigen LIKE 'Salon %'      THEN 'SALON'
                    ELSE 'OTRA'
                END AS GrupoTipologiaActual,
                CAST(
                    (100.0 * ISNULL(ss.PctPalletMultipleLines, 0))
                  + ( 60.0 * ISNULL(ss.PctCaseMultipleLines,  0))
                  - ( 80.0 * ISNULL(ss.PctUnitLines,          0))
                  - (  0.6 * ISNULL(ss.LinesPer1000Units,      0))
                AS decimal(18,2)) AS ScoreToRackPallet,
                CAST(
                    (100.0 * ISNULL(ss.PctUnitLines,          0))
                  + (  0.6 * ISNULL(ss.LinesPer1000Units,      0))
                  - ( 60.0 * ISNULL(ss.PctCaseMultipleLines,  0))
                  - (100.0 * ISNULL(ss.PctPalletMultipleLines, 0))
                AS decimal(18,2)) AS ScoreToBalda
            FROM sku_stats ss
            LEFT JOIN tipo_obs tobs ON tobs.SKU = ss.SKU AND tobs.rn = 1
        ),

        bench AS (
            SELECT DISTINCT
                GrupoTipologiaActual,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LinesPer1000Units)
                    OVER (PARTITION BY GrupoTipologiaActual) AS Mediana_LineasPor1000
            FROM scored
            WHERE PickLines             >= 10
              AND GrupoTipologiaActual IN ('BALDA', 'RACK_PALLET')
        ),

        final AS (
            SELECT
                s.*,
                CASE
                    WHEN s.GrupoTipologiaActual NOT IN ('BALDA', 'RACK_PALLET') THEN NULL
                    WHEN s.PctUnitsFromAssignedLoc < 0.50                       THEN NULL
                    WHEN s.GrupoTipologiaActual = 'BALDA'
                      AND s.ScoreToRackPallet >= 20                             THEN 'RACK_PALLET'
                    WHEN s.GrupoTipologiaActual = 'RACK_PALLET'
                      AND s.ScoreToBalda      >= 20                             THEN 'BALDA'
                    ELSE NULL
                END AS GrupoTipologiaObjetivo,
                CASE
                    WHEN s.GrupoTipologiaActual NOT IN ('BALDA', 'RACK_PALLET')
                        THEN 'NO EVALUAR (area especial)'
                    WHEN s.PctUnitsFromAssignedLoc < 0.50
                        THEN 'REVISAR ASIGNACIONES (mucho pick fuera de slot)'
                    WHEN s.GrupoTipologiaActual = 'BALDA'
                      AND s.ScoreToRackPallet >= 20
                        THEN 'SUGERIR: BALDA -> RACK/PALLET'
                    WHEN s.GrupoTipologiaActual = 'RACK_PALLET'
                      AND s.ScoreToBalda      >= 20
                        THEN 'SUGERIR: RACK/PALLET -> BALDA'
                    ELSE 'OK / SIN CAMBIO SUGERIDO'
                END AS Sugerencia
            FROM scored s
            WHERE s.PickLines             >= 10
              AND s.GrupoTipologiaActual IN ('BALDA', 'RACK_PALLET')
        )

        INSERT INTO [bi].[fact_slotting_sugerencias] (
            [sku],
            [articulo],
            [tipologia_actual_observada],
            [grupo_tipologia_actual],
            [sugerencia],
            [grupo_tipologia_objetivo],
            [lineas_picking],
            [unidades_pickeadas],
            [avg_qty_por_linea],
            [porc_lineas_unitarias],
            [porc_lineas_multiplo_caja],
            [porc_lineas_multiplo_pallet],
            [lineas_por_1000_unidades],
            [dias_con_actividad],
            [ubicaciones_distintas],
            [porc_unidades_desde_ubic_asignada],
            [score_hacia_rack_pallet],
            [score_hacia_balda],
            [prioridad],
            [lineas_potencialmente_evitables],
            [ventana_desde],
            [ventana_hasta]
        )
        SELECT
            f.SKU,
            f.Articulo,
            f.TipologiaActualObservada,
            f.GrupoTipologiaActual,
            f.Sugerencia,
            f.GrupoTipologiaObjetivo,
            f.PickLines,
            f.UnitsPicked,
            f.AvgQtyPerLine,
            f.PctUnitLines,
            f.PctCaseMultipleLines,
            f.PctPalletMultipleLines,
            f.LinesPer1000Units,
            f.ActiveDays,
            f.DistinctPickLocations,
            f.PctUnitsFromAssignedLoc,
            f.ScoreToRackPallet,
            f.ScoreToBalda,
            CAST(ABS(f.ScoreToRackPallet - f.ScoreToBalda) AS decimal(18,2)),
            CAST(
                CASE
                    WHEN bt.Mediana_LineasPor1000 IS NULL                THEN NULL
                    WHEN f.LinesPer1000Units <= bt.Mediana_LineasPor1000 THEN 0
                    ELSE (f.LinesPer1000Units - bt.Mediana_LineasPor1000)
                         * (f.UnitsPicked / 1000.0)
                END
            AS decimal(18,0)),
            CAST(@desde AS date),
            CAST(@hasta AS date)
        FROM final f
        LEFT JOIN bench bt ON bt.GrupoTipologiaActual = f.GrupoTipologiaObjetivo
        ORDER BY
            CASE WHEN f.Sugerencia LIKE 'SUGERIR:%' THEN 0 ELSE 1 END,
            CASE
                WHEN bt.Mediana_LineasPor1000 IS NULL                THEN NULL
                WHEN f.LinesPer1000Units <= bt.Mediana_LineasPor1000 THEN 0
                ELSE (f.LinesPer1000Units - bt.Mediana_LineasPor1000)
                     * (f.UnitsPicked / 1000.0)
            END DESC,
            CAST(ABS(f.ScoreToRackPallet - f.ScoreToBalda) AS decimal(18,2)) DESC;

    COMMIT TRANSACTION;

END
GO
