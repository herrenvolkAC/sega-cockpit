CREATE OR ALTER PROCEDURE bi.usp_load_recepcion_sku_day
    @from_date date,
    @to_date   date
AS
BEGIN
    SET NOCOUNT ON;

    IF @from_date IS NULL OR @to_date IS NULL OR @to_date <= @from_date
    BEGIN
        RAISERROR('Rango de fechas inválido. Use @from_date < @to_date (rango semiabierto).', 16, 1);
        RETURN;
    END;

    DECLARE @from_dt datetime2(0) = CAST(@from_date AS datetime2(0));
    DECLARE @to_dt   datetime2(0) = CAST(@to_date   AS datetime2(0));

    ;WITH base AS
    (
        SELECT
            a.ID                                  AS recepcion_id,
            b.ID_ARTICULO                         AS articulo_id,

            d.ID                                  AS oc_id,
            d.ID_ORDEN_COMPRA                     AS orden_compra,

            e.ID                                  AS proveedor_id,
            e.NOMBRE                              AS proveedor,

            f.ID                                  AS mercaderia_id,
            cam.ID                                AS camion_id,
            g.ID                                  AS descarga_id,
            g.ID_MISION                           AS mision_id,

            TRY_CONVERT(datetime2(0), a.FECHAH_RECEPCION, 120) AS fechah_recepcion_dt,

            c.CODE_ERP                            AS sku,
            c.DESCRIPCION                         AS articulo_desc,

            CAST(b.NUM_UNIDADES AS decimal(18,4)) AS cantidad_unidades,

            fmt.CANT_FORM_BASE                    AS cant_form_base,

            uls.pallets                           AS pallets,

            rf.inicio_dt                          AS inicio_dt,
            fn.fin_dt                             AS fin_dt,

            cam.FECHAH_ENTRADA                    AS camion_entrada_dt,
            cam.FECHAH_SALIDA                     AS camion_salida_dt,

            ISNULL(sec.seccion_desc, 'Revisar')   AS seccion_desc,
            ISNULL(sector.sector_desc, 'Revisar') AS sector_desc
        FROM dbo.ORDENES_ENTRAD_REC a
        JOIN dbo.ART_CONT_OE_REC   b   ON a.ID = b.ID_MAESTRO
        JOIN dbo.ARTICULOS         c   ON b.ID_ARTICULO = c.ID
        JOIN dbo.ORDENES_ENTRADA   d   ON a.ID_ORDEN_ENTRADA = d.ID
        JOIN dbo.CENTROS           e   ON d.ID_ORIGEN = e.ID
        JOIN dbo.AVISOS_MERCADERIA f   ON a.ID = f.ID_OC_RECIBIDA
        JOIN dbo.DESCARGAS_MAESTRO g   ON a.ID_DESCARGA = g.ID
        JOIN dbo.CAMIONES          cam ON f.ID_CAMION = cam.ID

        OUTER APPLY (
            SELECT TOP (1) form.CANT_FORM_BASE
            FROM dbo.FORMATOS form
            WHERE form.ID_ARTICULO = b.ID_ARTICULO
              AND form.CODE_FORMATO = 'C'
        ) fmt

        OUTER APPLY (
            SELECT COUNT(DISTINCT ul.ETIQUETA) AS pallets
            FROM dbo.ART_CONT_MERCADER acm
            JOIN dbo.UL_MAYOR_MERCADER ul ON acm.ID_UL_MAYOR = ul.ID
            WHERE acm.ID_MERCADERIA = f.ID
              AND acm.ID_ARTICULO   = b.ID_ARTICULO
        ) uls

        OUTER APPLY (
            SELECT MIN(op.FECHAH_CREACION) AS inicio_dt
            FROM dbo.OPERACION_RF_RECEP rfr
            JOIN dbo.OPERACIONES_RF     op ON rfr.ID = op.ID
            WHERE rfr.ID_MISION = g.ID_MISION
        ) rf

        OUTER APPLY (
            SELECT MAX(op.FECHAH_FIN) AS fin_dt
            FROM dbo.MOV_RECEP_FISICA_GC mov
            JOIN dbo.OPERACIONES_RF      op ON mov.ID_OPERACION = op.ID
            WHERE mov.ID_DESCARGA = g.ID
        ) fn

        -- Sección predominante (misión de ID menor) + su ID_SECTOR
        OUTER APPLY (
            SELECT TOP (1)
                s.NOMBRE     AS seccion_desc,
                s.ID         AS seccion_id,
                s.ID_SECTOR  AS sector_id
            FROM dbo.MISIONES m
            JOIN dbo.SECCIONES s ON m.ID_SECCION_PREDOM = s.ID
            WHERE m.ID_CAMION = cam.ID
            ORDER BY m.ID ASC
        ) sec

        -- Sector por sec.ID_SECTOR (sin re-join a MISIONES)
        OUTER APPLY (
            SELECT
                sect.NOMBRE + ' - ' + sect.DESCRIPCION  AS sector_desc
            FROM dbo.SECTORES sect
            WHERE sect.ID = sec.sector_id
        ) sector
    ),
    src AS
    (
        SELECT
            recepcion_id,
            articulo_id,

            MAX(oc_id)              AS oc_id,
            MAX(orden_compra)       AS orden_compra,
            MAX(proveedor_id)       AS proveedor_id,
            MAX(proveedor)          AS proveedor,
            MAX(mercaderia_id)      AS mercaderia_id,
            MAX(camion_id)          AS camion_id,
            MAX(descarga_id)        AS descarga_id,
            MAX(mision_id)          AS mision_id,

            MAX(fechah_recepcion_dt) AS fechah_recepcion_dt,
            CAST(MAX(fechah_recepcion_dt) AS date) AS fecha_operativa,

            MAX(sku)                AS sku,
            MAX(articulo_desc)      AS articulo_desc,

            SUM(cantidad_unidades)  AS cantidad_unidades,

            CEILING(
                SUM(cantidad_unidades) /
                NULLIF(CAST(MAX(cant_form_base) AS decimal(18,4)), 0)
            )                       AS cantidad_cajas,

            MAX(pallets)            AS pallets,
            MAX(inicio_dt)          AS inicio_dt,
            MAX(fin_dt)             AS fin_dt,
            MAX(camion_entrada_dt)  AS camion_entrada_dt,
            MAX(camion_salida_dt)   AS camion_salida_dt,
            MAX(seccion_desc)       AS seccion_desc,
            MAX(sector_desc)        AS sector_desc
        FROM base
        WHERE fechah_recepcion_dt IS NOT NULL
          AND fechah_recepcion_dt >= @from_dt
          AND fechah_recepcion_dt <  @to_dt
        GROUP BY recepcion_id, articulo_id
    )
    INSERT INTO bi.fact_recepcion_sku
    (
        recepcion_id,
        articulo_id,
        oc_id,
        orden_compra,
        proveedor_id,
        proveedor,
        mercaderia_id,
        camion_id,
        descarga_id,
        mision_id,
        fechah_recepcion_dt,
        fecha_operativa,
        sku,
        articulo_desc,
        cantidad_unidades,
        cantidad_cajas,
        pallets,
        inicio_dt,
        fin_dt,
        camion_entrada_dt,
        camion_salida_dt,
        seccion_desc,
        sector_desc
    )
    SELECT
        s.recepcion_id,
        s.articulo_id,
        s.oc_id,
        s.orden_compra,
        s.proveedor_id,
        s.proveedor,
        s.mercaderia_id,
        s.camion_id,
        s.descarga_id,
        s.mision_id,
        s.fechah_recepcion_dt,
        s.fecha_operativa,
        s.sku,
        s.articulo_desc,
        s.cantidad_unidades,
        s.cantidad_cajas,
        s.pallets,
        s.inicio_dt,
        s.fin_dt,
        s.camion_entrada_dt,
        s.camion_salida_dt,
        s.seccion_desc,
        s.sector_desc
    FROM src s
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM bi.fact_recepcion_sku f
        WHERE f.recepcion_id = s.recepcion_id
          AND f.articulo_id  = s.articulo_id
    );

    SELECT @@ROWCOUNT AS inserted_rows;
END;
GO