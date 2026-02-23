CREATE PROCEDURE bi.usp_load_oc_item
(
    @from_date date,
    @to_date   date = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @to_date IS NULL
        SET @to_date = DATEADD(DAY, 1, @from_date);

    DECLARE @from_key int = CONVERT(int, FORMAT(@from_date,'yyyyMMdd'));
    DECLARE @to_key   int = CONVERT(int, FORMAT(DATEADD(DAY,-1,@to_date),'yyyyMMdd'));

    BEGIN TRAN;

    DELETE FROM bi.fact_oc_item
    WHERE date_key BETWEEN @from_key AND @to_key;

    INSERT INTO bi.fact_oc_item
    (
        date_key,
        oc_codigo, id_orden_entrada, id_oc_item, id_articulo,
        sku, codigo_comercial, articulo_desc,
        proveedor_nombre, tipo_orden_entrada,
        ux_b, unidades_ordenadas
    )
    SELECT
        CONVERT(int, FORMAT(CAST(TRY_CONVERT(datetime2(0),
            LEFT(a.FECHA,10) + ' ' + SUBSTRING(a.FECHA,12,8), 111) AS date),'yyyyMMdd')) AS date_key,

        CONVERT(varchar(100), a.id_orden_compra) AS oc_codigo,
        a.id AS id_orden_entrada,
        b.id AS id_oc_item,
        b.ID_ARTICULO AS id_articulo,

        c.CODE_ERP AS sku,
        c.CODE_PRESENTACION AS codigo_comercial,
        c.DESCRIPCION AS articulo_desc,

        d.NOMBRE AS proveedor_nombre,
        e.DESCRIPCION AS tipo_orden_entrada,

        CAST(f.CANT_FORM_BASE AS decimal(18,4)) AS ux_b,
        CAST(b.NUM_UNIDADES AS decimal(18,4)) AS unidades_ordenadas
    FROM ORDENES_ENTRADA a
    JOIN ART_CONT_OE b ON a.id = b.ID_MAESTRO
    JOIN ARTICULOS c   ON b.ID_ARTICULO = c.ID
    JOIN CENTROS d     ON a.ID_ORIGEN = d.ID
    JOIN TIPOS_ORDENES_ENTRADA e ON a.TIPO_EXTERNO = e.ID
    JOIN Formatos f    ON c.id = f.ID_ARTICULO AND f.NOMBRE_FORMATO = 'CAJA'
    WHERE CAST(TRY_CONVERT(datetime2(0),
            LEFT(a.FECHA,10) + ' ' + SUBSTRING(a.FECHA,12,8), 111) AS date) >= @from_date
      AND CAST(TRY_CONVERT(datetime2(0),
            LEFT(a.FECHA,10) + ' ' + SUBSTRING(a.FECHA,12,8), 111) AS date) <  @to_date;

    COMMIT TRAN;
END;
go

CREATE PROCEDURE bi.usp_load_receipt_item_day
(
    @from_date date,
    @to_date   date = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @to_date IS NULL
        SET @to_date = DATEADD(DAY, 1, @from_date);

    DECLARE @from_key int = CONVERT(int, FORMAT(@from_date,'yyyyMMdd'));
    DECLARE @to_key   int = CONVERT(int, FORMAT(DATEADD(DAY,-1,@to_date),'yyyyMMdd'));

    BEGIN TRAN;

    DELETE FROM bi.fact_receipt_item_day
    WHERE date_key BETWEEN @from_key AND @to_key;

    INSERT INTO bi.fact_receipt_item_day
    (
        date_key,
        id_orden_entrada,
        id_oc_item,
        unidades_recibidas
    )
    SELECT
        CONVERT(int, FORMAT(CAST(TRY_CONVERT(datetime2(0),
            LEFT(a.FECHAH_RECEPCION,10) + ' ' + SUBSTRING(a.FECHAH_RECEPCION,12,8), 111) AS date),'yyyyMMdd')) AS date_key,

        a.ID_ORDEN_ENTRADA AS id_orden_entrada,
        b.ID_ART_CONT_OE   AS id_oc_item,
        CAST(SUM(b.NUM_UNIDADES) AS decimal(18,4)) AS unidades_recibidas
    FROM ORDENES_ENTRAD_REC a
    JOIN ART_CONT_OE_REC b ON a.id = b.ID_MAESTRO
    WHERE CAST(TRY_CONVERT(datetime2(0),
            LEFT(a.FECHAH_RECEPCION,10) + ' ' + SUBSTRING(a.FECHAH_RECEPCION,12,8), 111) AS date) >= @from_date
      AND CAST(TRY_CONVERT(datetime2(0),
            LEFT(a.FECHAH_RECEPCION,10) + ' ' + SUBSTRING(a.FECHAH_RECEPCION,12,8), 111) AS date) <  @to_date
    GROUP BY
        a.ID_ORDEN_ENTRADA,
        b.ID_ART_CONT_OE,
        CAST(TRY_CONVERT(datetime2(0),
            LEFT(a.FECHAH_RECEPCION,10) + ' ' + SUBSTRING(a.FECHAH_RECEPCION,12,8), 111) AS date);

    COMMIT TRAN;
END;
go

CREATE PROCEDURE bi.usp_build_oc_item_status
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;

    TRUNCATE TABLE bi.fact_oc_item_status;

    INSERT INTO bi.fact_oc_item_status
    (
        id_oc_item, id_orden_entrada, oc_codigo, id_articulo,
        date_key_inicio, date_key_ultima_rec,
        unidades_ordenadas, unidades_recibidas_total,
        recepciones_dias_count
    )
    SELECT
        o.id_oc_item,
        o.id_orden_entrada,
        o.oc_codigo,
        o.id_articulo,
        o.date_key AS date_key_inicio,

        MAX(r.date_key) AS date_key_ultima_rec,

        o.unidades_ordenadas,
        ISNULL(SUM(r.unidades_recibidas), CONVERT(decimal(18,4),0)) AS unidades_recibidas_total,

        ISNULL(COUNT(DISTINCT r.date_key), 0) AS recepciones_dias_count
    FROM bi.fact_oc_item o
    LEFT JOIN bi.fact_receipt_item_day r
      ON r.id_oc_item = o.id_oc_item
    GROUP BY
        o.id_oc_item, o.id_orden_entrada, o.oc_codigo, o.id_articulo, o.date_key, o.unidades_ordenadas;

    COMMIT TRAN;
END;
go