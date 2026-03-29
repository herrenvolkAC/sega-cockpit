USE [MACROMERCADO]
GO

SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

create PROCEDURE [bi].[usp_upsert_satisfaccion_oc_actual]
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @loaded_at datetime2(0) = SYSDATETIME();
    DECLARE @hoy date = CAST(GETDATE() AS date);
    DECLARE @lock_result int;

    IF OBJECT_ID('tempdb..#src') IS NOT NULL
        DROP TABLE #src;

    ;WITH ParamEstado AS (
        SELECT TOP 1
            p.VALOR
        FROM PARAMETROS p
        WHERE p.GRUPO = 'ORDENES_COMPRA'
          AND p.PARAM  = 'ESTADOS'
    ),
    Estados AS (
        SELECT
            CAST(j.[key] AS int) AS estado_codigo,
            CAST(j.[value] AS varchar(100)) AS estado_desc
        FROM ParamEstado pe
        CROSS APPLY OPENJSON(
            '["' + REPLACE(
                      REPLACE(
                          REPLACE(pe.VALOR, '"', '\"'),
                      '|', '","'),
                  CHAR(13) + CHAR(10), ''
            ) + '"]'
        ) j
    ),
    Base AS (
        SELECT
            a.ID AS id_orden_entrada,
            CAST(a.ID_ORDEN_COMPRA AS varchar(100)) AS oc,
            a.ESTADO AS estado_codigo,
            ISNULL(est.estado_desc, CONCAT('Estado ', a.ESTADO)) AS estado_desc,
            a.FECHA AS inicio_vigencia,
            a.FECHA_VENCIMIENTO AS fin_vigencia,
            a.ID_ORIGEN AS id_origen,
            c.DESCRIPCION AS proveedor,
            b.ID_ARTICULO AS id_articulo,
            d.DESCRIPCION AS articulo,
            CAST(ISNULL(b.NUM_UNIDADES, 0) AS decimal(18,2)) AS unidades_pedidas,
            CAST(NULLIF(fx.CANT_FORM_BASE, 0) AS decimal(18,2)) AS uxb,
            CAST(ISNULL(b.CANTIDAD_RECIBIDA, 0) AS decimal(18,2)) AS unidades_recibidas
        FROM ORDENES_ENTRADA a
        INNER JOIN ART_CONT_OE b
            ON a.ID = b.ID_MAESTRO
        INNER JOIN CENTROS c
            ON a.ID_ORIGEN = c.ID
        INNER JOIN ARTICULOS d
            ON b.ID_ARTICULO = d.ID
        OUTER APPLY (
            SELECT TOP 1
                e.CANT_FORM_BASE
            FROM FORMATOS e
            WHERE e.ID_ARTICULO = d.ID
              AND e.NOMBRE_FORMATO = 'CAJA'
            ORDER BY e.ID
        ) fx
        LEFT JOIN Estados est
            ON a.ESTADO = est.estado_codigo
        where ES_DINAMICA = 0 -- Excluir dinámicas, que no representan órdenes de compra reales
    )
    SELECT
        b.id_orden_entrada,
        b.oc,
        b.estado_codigo,
        b.estado_desc,
        b.inicio_vigencia,
        b.fin_vigencia,
        b.id_origen,
        b.proveedor,
        b.id_articulo,
        b.articulo,
        b.unidades_pedidas,
        b.uxb,
        b.unidades_recibidas,
        CAST(
            CASE
                WHEN b.unidades_pedidas - b.unidades_recibidas < 0 THEN 0
                ELSE b.unidades_pedidas - b.unidades_recibidas
            END
        AS decimal(18,2)) AS unidades_pendientes,
        CAST(
            CASE
                WHEN NULLIF(b.unidades_pedidas, 0) IS NULL THEN NULL
                WHEN b.unidades_recibidas <= 0 THEN 0
                WHEN b.unidades_recibidas >= b.unidades_pedidas THEN 1
                ELSE b.unidades_recibidas / NULLIF(b.unidades_pedidas, 0)
            END
        AS decimal(18,4)) AS porc_satisfaccion,
        CAST(
            CASE
                WHEN NULLIF(b.uxb, 0) IS NULL THEN NULL
                ELSE b.unidades_pedidas / b.uxb
            END
        AS decimal(18,2)) AS cajas_pedidas,
        CAST(
            CASE
                WHEN NULLIF(b.uxb, 0) IS NULL THEN NULL
                ELSE b.unidades_recibidas / b.uxb
            END
        AS decimal(18,2)) AS cajas_recibidas,
        CAST(
            CASE
                WHEN NULLIF(b.uxb, 0) IS NULL THEN NULL
                WHEN b.unidades_pedidas - b.unidades_recibidas < 0 THEN 0
                ELSE (b.unidades_pedidas - b.unidades_recibidas) / b.uxb
            END
        AS decimal(18,2)) AS cajas_pendientes,
        CAST(
            CASE
                WHEN b.unidades_pedidas > 0
                 AND b.unidades_recibidas >= b.unidades_pedidas THEN 1
                ELSE 0
            END
        AS bit) AS completa_flag,
        CAST(
            CASE
                WHEN b.fin_vigencia IS NULL THEN 1
                WHEN CAST(b.fin_vigencia AS date) >= @hoy THEN 1
                ELSE 0
            END
        AS bit) AS activo_calc
    INTO #src
    FROM Base b
    OPTION (MAXDOP 1);

    CREATE CLUSTERED INDEX IX_src
        ON #src (id_orden_entrada, id_articulo);

    BEGIN TRANSACTION;

        EXEC @lock_result = sp_getapplock
            @Resource = 'bi.usp_upsert_satisfaccion_oc_actual',
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @LockTimeout = 0;

        IF @lock_result < 0
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50001, 'No se pudo obtener applock exclusivo para usp_upsert_satisfaccion_oc_actual.', 1;
        END

        UPDATE tgt
           SET tgt.oc                  = src.oc,
               tgt.estado_codigo       = src.estado_codigo,
               tgt.estado_desc         = src.estado_desc,
               tgt.inicio_vigencia     = src.inicio_vigencia,
               tgt.fin_vigencia        = src.fin_vigencia,
               tgt.id_origen           = src.id_origen,
               tgt.proveedor           = src.proveedor,
               tgt.articulo            = src.articulo,
               tgt.unidades_pedidas    = src.unidades_pedidas,
               tgt.uxb                 = src.uxb,
               tgt.unidades_recibidas  = src.unidades_recibidas,
               tgt.unidades_pendientes = src.unidades_pendientes,
               tgt.porc_satisfaccion   = src.porc_satisfaccion,
               tgt.cajas_pedidas       = src.cajas_pedidas,
               tgt.cajas_recibidas     = src.cajas_recibidas,
               tgt.cajas_pendientes    = src.cajas_pendientes,
               tgt.completa_flag       = src.completa_flag,
               tgt.activo              = src.activo_calc,
               tgt.last_loaded_at      = @loaded_at
        FROM [bi].[fact_satisfaccion_oc_actual] tgt
        INNER JOIN #src src
            ON tgt.id_orden_entrada = src.id_orden_entrada
           AND tgt.id_articulo      = src.id_articulo
        OPTION (MAXDOP 1);

        INSERT INTO [bi].[fact_satisfaccion_oc_actual] (
            [id_orden_entrada],
            [oc],
            [estado_codigo],
            [estado_desc],
            [inicio_vigencia],
            [fin_vigencia],
            [id_origen],
            [proveedor],
            [id_articulo],
            [articulo],
            [unidades_pedidas],
            [uxb],
            [unidades_recibidas],
            [unidades_pendientes],
            [porc_satisfaccion],
            [cajas_pedidas],
            [cajas_recibidas],
            [cajas_pendientes],
            [completa_flag],
            [activo],
            [first_loaded_at],
            [last_loaded_at]
        )
        SELECT
            src.id_orden_entrada,
            src.oc,
            src.estado_codigo,
            src.estado_desc,
            src.inicio_vigencia,
            src.fin_vigencia,
            src.id_origen,
            src.proveedor,
            src.id_articulo,
            src.articulo,
            src.unidades_pedidas,
            src.uxb,
            src.unidades_recibidas,
            src.unidades_pendientes,
            src.porc_satisfaccion,
            src.cajas_pedidas,
            src.cajas_recibidas,
            src.cajas_pendientes,
            src.completa_flag,
            src.activo_calc,
            @loaded_at,
            @loaded_at
        FROM #src src
        LEFT JOIN [bi].[fact_satisfaccion_oc_actual] tgt
            ON tgt.id_orden_entrada = src.id_orden_entrada
           AND tgt.id_articulo      = src.id_articulo
        WHERE tgt.id_orden_entrada IS NULL
        OPTION (MAXDOP 1);

        UPDATE tgt
           SET tgt.activo         = 0,
               tgt.last_loaded_at = @loaded_at
        FROM [bi].[fact_satisfaccion_oc_actual] tgt
        LEFT JOIN #src src
            ON tgt.id_orden_entrada = src.id_orden_entrada
           AND tgt.id_articulo      = src.id_articulo
        WHERE src.id_orden_entrada IS NULL
          AND tgt.activo = 1
        OPTION (MAXDOP 1);

    COMMIT TRANSACTION;
END
GO