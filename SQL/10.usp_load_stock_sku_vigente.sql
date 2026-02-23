CREATE OR ALTER PROCEDURE bi.usp_load_stock_sku_vigente
    @days int = 30
AS
BEGIN
    SET NOCOUNT ON;

    IF @days IS NULL OR @days <= 0
    BEGIN
        RAISERROR('@days inválido. Debe ser > 0.', 16, 1);
        RETURN;
    END;

    DECLARE @snapshot_dt datetime2(0) = sysdatetime();
    DECLARE @fecha_operativa date = CAST(@snapshot_dt AS date);

    DECLARE @from_dt datetime2(0) = DATEADD(day, -@days, @snapshot_dt);
    DECLARE @to_dt   datetime2(0) = @snapshot_dt;

    -- Foto vigente: reemplazo completo
    TRUNCATE TABLE bi.fact_stock_sku_vigente;

    ;WITH stock_estado AS
    (
        SELECT
            b.ID_ARTICULO AS articulo_id,
            estado = CASE
                WHEN a.TIPO_OPERACION <> 0 OR a.ID_OPERACION IS NOT NULL THEN 'RESERVADO'
                WHEN a.BLOQUEO = 1 THEN 'BLOQUEADO'
                ELSE 'DISPONIBLE'
            END,
            stock_base = SUM(
                CAST(b.NUM_UNIDADES_FORM AS decimal(18,4)) *
                CAST(fm.CANT_FORM_BASE    AS decimal(18,4))
            )
        FROM dbo.contenedores a
        JOIN dbo.art_cont_cont b ON a.id = b.id_contenedor
        JOIN dbo.FORMATOS fm     ON b.id_formato = fm.id
        GROUP BY
            b.ID_ARTICULO,
            CASE
                WHEN a.TIPO_OPERACION <> 0 OR a.ID_OPERACION IS NOT NULL THEN 'RESERVADO'
                WHEN a.BLOQUEO = 1 THEN 'BLOQUEADO'
                ELSE 'DISPONIBLE'
            END
    ),
    stock_articulo AS
    (
        SELECT
            articulo_id,
            stock_disponible_base = SUM(CASE WHEN estado='DISPONIBLE' THEN stock_base ELSE 0 END),
            stock_reservado_base  = SUM(CASE WHEN estado='RESERVADO'  THEN stock_base ELSE 0 END),
            stock_bloqueado_base  = SUM(CASE WHEN estado='BLOQUEADO'  THEN stock_base ELSE 0 END),
            stock_total_base      = SUM(stock_base)
        FROM stock_estado
        GROUP BY articulo_id
    ),
    dpd_daily AS
    (
        SELECT
            b.ID_ARTICULO AS articulo_id,
            fecha = TRY_CAST(am.FECHA_HORA as date),
            consumo_base_dia = SUM(
                CAST(b.NUM_UNIDADES_FORM AS decimal(18,4)) *
                CAST(fm.CANT_FORM_BASE    AS decimal(18,4))
            )
        FROM dbo.AVISOS_MERCADERIA am
        JOIN dbo.ART_CONT_MERCADER b ON am.id = b.ID_MERCADERIA
        JOIN dbo.FORMATOS fm         ON b.ID_FORMATO = fm.ID
        WHERE am.TIPO_AV = 1
          AND TRY_CONVERT(datetime2(0), am.FECHA_HORA, 120) >= @from_dt
          AND TRY_CONVERT(datetime2(0), am.FECHA_HORA, 120) <  @to_dt
          AND TRY_CAST(am.FECHA_HORA as date) IS NOT NULL
        GROUP BY b.ID_ARTICULO, TRY_CAST(am.FECHA_HORA as date)
    ),
    dpd_articulo AS
    (
        SELECT
            articulo_id,
            dpd_base_30d = SUM(consumo_base_dia) / NULLIF(@days,0)
        FROM dpd_daily
        GROUP BY articulo_id
    )
    INSERT INTO bi.fact_stock_sku_vigente
    (
        snapshot_dt,
        fecha_operativa,
        articulo_id,
        sku,
        articulo_desc,
        stock_total_base,
        stock_disponible_base,
        stock_reservado_base,
        stock_bloqueado_base,
        dpd_base_30d,
        dias_stock_disponible,
        last_move_dt
    )
    SELECT
        @snapshot_dt,
        @fecha_operativa,
        s.articulo_id,
        a.CODE_ERP,
        a.DESCRIPCION,
        s.stock_total_base,
        s.stock_disponible_base,
        s.stock_reservado_base,
        s.stock_bloqueado_base,
        d.dpd_base_30d,
        s.stock_disponible_base / NULLIF(d.dpd_base_30d, 0),
        NULL   -- last_move pendiente
    FROM stock_articulo s
    JOIN dbo.ARTICULOS a ON a.ID = s.articulo_id
    LEFT JOIN dpd_articulo d ON d.articulo_id = s.articulo_id;

    SELECT @@ROWCOUNT AS inserted_rows;
END;
GO