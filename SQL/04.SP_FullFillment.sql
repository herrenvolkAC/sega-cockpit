CREATE OR ALTER PROCEDURE bi.usp_load_fulfillment_daily
(
    @from_date date,              -- inclusive
    @to_date   date = NULL        -- exclusive; si NULL => @from_date + 1
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @to_date IS NULL
        SET @to_date = DATEADD(DAY, 1, @from_date);

    BEGIN TRAN;

    /* =========================
       0) Limpiar rango destino
       ========================= */
    DECLARE @from_key int = CONVERT(int, FORMAT(@from_date,'yyyyMMdd'));
    DECLARE @to_key   int = CONVERT(int, FORMAT(DATEADD(DAY,-1,@to_date),'yyyyMMdd'));

    DELETE FROM bi.fact_fulfillment_line_day
    WHERE date_key BETWEEN @from_key AND @to_key;

    /* =========================
       1) Parse fecha generación robusto
       (soporta varchar 'yyyy/mm/dd hh:mi:ss' o datetime)
       ========================= */
    IF OBJECT_ID('tempdb..#pedidos_det') IS NOT NULL DROP TABLE #pedidos_det;

    SELECT
        e.CODIGO                           AS centro_codigo,
        e.NOMBRE                           AS centro_nombre,

        a.ID                               AS id_pedido,
        a.CODIGO_PEDIDO                    AS codigo_pedido,

        -- Intento 1: convertir directo (si es datetime real o string compatible)
        -- Intento 2: armar 'yyyy/mm/dd hh:mi:ss' con style 111 + substring
        CAST(
            COALESCE(
                TRY_CONVERT(datetime2(0), a.FECHAH_GENERACION),
                TRY_CONVERT(datetime2(0),
                    (TRY_CONVERT(char(10), a.FECHAH_GENERACION, 111) + ' ' + SUBSTRING(CONVERT(varchar(30), a.FECHAH_GENERACION), 12, 8))
                )
            ) AS date
        )                                   AS fecha_generacion,

        a.REFERENCIA                       AS referencia,
        a.TIPO_PEDIDO                      AS tipo_pedido,

        b.ID_ARTICULO                      AS id_articulo,
        c.CODE_ERP                          AS sku,
        c.DESCRIPCION                      AS articulo_desc,

        d.NOMBRE_FORMATO                   AS formato,
        sum(CAST(b.NUM_UNIDADES_FORM AS decimal(18,4))) AS qty_solicitada
    INTO #pedidos_det
    FROM PEDIDOS a
    JOIN ART_CONT_PEDIDO b ON a.ID = b.ID_PEDIDO
    JOIN ARTICULOS c       ON b.ID_ARTICULO = c.ID
    JOIN FORMATOS d        ON b.ID_FORMATO = d.ID
    JOIN CENTROS e         ON a.ID_LOCAL = e.ID
    WHERE a.TIPO_PEDIDO NOT IN (10)
      AND CAST(
            COALESCE(
                TRY_CONVERT(datetime2(0), a.FECHAH_GENERACION),
                TRY_CONVERT(datetime2(0),
                    (TRY_CONVERT(char(10), a.FECHAH_GENERACION, 111) + ' ' + SUBSTRING(CONVERT(varchar(30), a.FECHAH_GENERACION), 12, 8))
                )
            ) AS date
          ) >= @from_date
      AND CAST(
            COALESCE(
                TRY_CONVERT(datetime2(0), a.FECHAH_GENERACION),
                TRY_CONVERT(datetime2(0),
                    (TRY_CONVERT(char(10), a.FECHAH_GENERACION, 111) + ' ' + SUBSTRING(CONVERT(varchar(30), a.FECHAH_GENERACION), 12, 8))
                )
            ) AS date
          ) < @to_date
    group by
                e.CODIGO,
        e.NOMBRE,

        a.ID,
        a.CODIGO_PEDIDO,

        -- Intento 1: convertir directo (si es datetime real o string compatible)
        -- Intento 2: armar 'yyyy/mm/dd hh:mi:ss' con style 111 + substring
        CAST(
            COALESCE(
                TRY_CONVERT(datetime2(0), a.FECHAH_GENERACION),
                TRY_CONVERT(datetime2(0),
                    (TRY_CONVERT(char(10), a.FECHAH_GENERACION, 111) + ' ' + SUBSTRING(CONVERT(varchar(30), a.FECHAH_GENERACION), 12, 8))
                )
            ) AS date
        ),

        a.REFERENCIA,
        a.TIPO_PEDIDO,

        b.ID_ARTICULO,
        c.CODE_ERP,
        c.DESCRIPCION ,

        d.NOMBRE_FORMATO

    CREATE INDEX IX__pedidos_det__pedido ON #pedidos_det(codigo_pedido) INCLUDE (id_articulo, formato, qty_solicitada, centro_codigo);

    /* =========================
       2) Expedido agregado SOLO para esos pedidos
       (si hay múltiples avisos, se suma y se cuenta avisos)
       ========================= */
    IF OBJECT_ID('tempdb..#expedido_agg') IS NOT NULL DROP TABLE #expedido_agg;

    SELECT
        a.COD_OC_PE_DE                      AS codigo_pedido,
        b.ID_ARTICULO                       AS id_articulo,
        c.NOMBRE_FORMATO                    AS formato,
        CAST(SUM(b.NUM_UNIDADES_FORM) AS decimal(18,4)) AS qty_expedida,
        COUNT(DISTINCT a.COD_AVISO_ENTREGA) AS avisos_count,
        MIN(a.COD_AVISO_ENTREGA)            AS aviso_ejemplo
    INTO #expedido_agg
    FROM AVISOS_MERCADERIA a
    JOIN ART_CONT_MERCADER b ON a.ID = b.ID_MERCADERIA
    JOIN FORMATOS c          ON b.ID_FORMATO = c.ID
    WHERE EXISTS (
        SELECT 1
        FROM #pedidos_det p
        WHERE p.codigo_pedido = a.COD_OC_PE_DE
    )
    GROUP BY
        a.COD_OC_PE_DE,
        b.ID_ARTICULO,
        c.NOMBRE_FORMATO;

    CREATE INDEX IX__expedido_agg__key ON #expedido_agg(codigo_pedido, id_articulo, formato);

    /* =========================
       3) Insert destino (grain: día-centro-pedido-articulo-formato)
       ========================= */
    INSERT INTO bi.fact_fulfillment_line_day
    (
        date_key,
        centro_codigo, centro_nombre,
        codigo_pedido, id_pedido, referencia, tipo_pedido,
        id_articulo, sku, articulo_desc,
        formato,
        qty_solicitada, qty_expedida,
        avisos_count, aviso_ejemplo
    )
    SELECT
        CONVERT(int, FORMAT(p.fecha_generacion,'yyyyMMdd')) AS date_key,

        p.centro_codigo,
        p.centro_nombre,

        p.codigo_pedido,
        p.id_pedido,
        p.referencia,
        p.tipo_pedido,

        p.id_articulo,
        p.sku,
        p.articulo_desc,

        p.formato,

        p.qty_solicitada,
        ISNULL(e.qty_expedida, CONVERT(decimal(18,4),0)) AS qty_expedida,

        ISNULL(e.avisos_count, 0) AS avisos_count,
        e.aviso_ejemplo
    FROM #pedidos_det p
    LEFT JOIN #expedido_agg e
      ON e.codigo_pedido = p.codigo_pedido
     AND e.id_articulo   = p.id_articulo
     AND e.formato       = p.formato;

    COMMIT TRAN;
END;
GO
