/* =========================================================
   TABLA FOTO: Stock + Contenedor + Ubicación (vigente) + Tipo contenedor
   + Flags derivados para tablero (pallet / fuera de almacenaje)
   - Foto al momento (TRUNCATE + INSERT)
   ========================================================= */

IF OBJECT_ID('bi.fact_stock_contenedor_ubic_vigente','U') IS NOT NULL
    DROP TABLE bi.fact_stock_contenedor_ubic_vigente;
GO

CREATE TABLE bi.fact_stock_contenedor_ubic_vigente
(
    snapshot_dt               datetime2(0)   NOT NULL,
    fecha_operativa           date           NOT NULL,

    TipoContenedor            varchar(200)   NULL,
    TipoContenedorArticulo    varchar(255)   NULL,

    /* Flags para tablero (heurísticos, no “verdad absoluta”) */
    EsPallet                  bit            NOT NULL,
    FueraDeAlmacenaje         bit            NOT NULL,

    Etiqueta                  varchar(60)    NOT NULL,
    SKU                       varchar(60)    NOT NULL,
    Articulo                  varchar(255)   NOT NULL,

    Formato                   varchar(80)    NULL,
    Unidades_Formato          int            NULL,
    Cantidad_Base             int            NULL,
    Cantidad_Total_Unidades   bigint         NULL,

    Proveedor                 varchar(200)   NOT NULL,

    FechaRecepcion            date           NULL,
    FechaVencimiento          date           NULL,

    Bloqueo_Contenedor        bit            NOT NULL,
    Bloqueo_Ubicacion         bit            NULL,
    Ubicacion_Bloqueada       bit            NOT NULL,

    Tipo_Ubicacion            varchar(100)   NULL,
    Seccion                   varchar(100)   NULL,
    Sector                    varchar(100)   NULL,
    TipoCanal                 varchar(100)   NULL
);

CREATE CLUSTERED INDEX CX_fact_stock_contenedor_ubic_vigente
    ON bi.fact_stock_contenedor_ubic_vigente (SKU, Etiqueta);

CREATE NONCLUSTERED INDEX IX_fact_stock_contenedor_ubic_vigente_flags
    ON bi.fact_stock_contenedor_ubic_vigente (EsPallet, FueraDeAlmacenaje)
    INCLUDE (TipoContenedor, TipoContenedorArticulo, Cantidad_Total_Unidades, Tipo_Ubicacion, Seccion, Sector, TipoCanal);

CREATE NONCLUSTERED INDEX IX_fact_stock_contenedor_ubic_vigente_TipoCont
    ON bi.fact_stock_contenedor_ubic_vigente (TipoContenedor)
    INCLUDE (EsPallet, FueraDeAlmacenaje, SKU, Etiqueta, Cantidad_Total_Unidades);

CREATE NONCLUSTERED INDEX IX_fact_stock_contenedor_ubic_vigente_FechaVto
    ON bi.fact_stock_contenedor_ubic_vigente (FechaVencimiento)
    INCLUDE (SKU, Etiqueta, Cantidad_Total_Unidades, TipoContenedor, EsPallet, Ubicacion_Bloqueada, Bloqueo_Contenedor);
GO


/* =========================================================
   SP de carga (foto vigente): TRUNCATE + INSERT
   - Devuelve filas afectadas
   - EsPallet: match tolerante PALET/PALLET en TipoContenedor/Envase
   - FueraDeAlmacenaje: heurística por Tipo_Ubicacion / TipoCanal
     (ajustable a la lista real de canales operativos)
   ========================================================= */

CREATE OR ALTER PROCEDURE bi.usp_load_stock_contenedor_ubic_vigente
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @snapshot_dt     datetime2(0) = sysdatetime();
    DECLARE @fecha_operativa date         = CAST(@snapshot_dt AS date);

    TRUNCATE TABLE bi.fact_stock_contenedor_ubic_vigente;

    ;WITH
        CTERec AS (
            SELECT
                a.id        AS IdOERec,
                c.NOMBRE    AS Proveedor
            FROM ORDENES_ENTRAD_REC a
            JOIN ORDENES_ENTRADA b
                ON b.id = a.ID_ORDEN_ENTRADA
            JOIN CENTROS c
                ON c.ID = b.ID_ORIGEN
        ),
        CTEProv AS (
            SELECT
                a.ID_ARTICULO,
                c.NOMBRE AS Proveedor
            FROM PROVEEDOR_ARTICULO a
            JOIN CENTROS c
                ON a.ID_PROVEEDOR = c.ID
            WHERE a.ES_PRINCIPAL = 1
        ),
        XMLData AS (
            SELECT CAST(
                '<x>' +
                REPLACE(
                    (SELECT valor
                     FROM PARAMETROS
                     WHERE grupo = 'UBICACIONES'
                       AND param = 'TIPOS'),
                    '|',
                    '</x><x>'
                ) +
                '</x>' AS XML
            ) AS Data
        ),
        Tipos AS (
            SELECT
                ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS idparametro,
                T.C.value('.', 'varchar(100)') AS descripcion
            FROM XMLData
            CROSS APPLY Data.nodes('/x') AS T(C)
        ),
        XMLDataCanales AS (
            SELECT CAST(
                '<x>' +
                REPLACE(
                    (SELECT valor
                     FROM PARAMETROS
                     WHERE grupo = 'CANALES'
                       AND param = 'TIPOS'),
                    '|',
                    '</x><x>'
                ) +
                '</x>' AS XML
            ) AS Data
        ),
        TiposCanales AS (
            SELECT
                ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS idparametro,
                T.C.value('.', 'varchar(100)') AS descripcion
            FROM XMLDataCanales
            CROSS APPLY Data.nodes('/x') AS T(C)
        )
    INSERT INTO bi.fact_stock_contenedor_ubic_vigente
    (
        snapshot_dt,
        fecha_operativa,
        TipoContenedor,
        TipoContenedorArticulo,
        EsPallet,
        FueraDeAlmacenaje,
        Etiqueta,
        SKU,
        Articulo,
        Formato,
        Unidades_Formato,
        Cantidad_Base,
        Cantidad_Total_Unidades,
        Proveedor,
        FechaRecepcion,
        FechaVencimiento,
        Bloqueo_Contenedor,
        Bloqueo_Ubicacion,
        Ubicacion_Bloqueada,
        Tipo_Ubicacion,
        Seccion,
        Sector,
        TipoCanal
    )
    SELECT
        @snapshot_dt                                   AS snapshot_dt,
        @fecha_operativa                               AS fecha_operativa,

        COALESCE(tc.DESCRIPCION, 'SIN TIPO CONTENEDOR')   AS TipoContenedor,
        COALESCE(art.DESCRIPCION, 'SIN ENVASE ASOCIADO')  AS TipoContenedorArticulo,

        /* EsPallet: tolera PALET / PALLET en tipo/envase */
        CAST(
            CASE
                WHEN UPPER(COALESCE(tc.DESCRIPCION,''))  LIKE '%PALET%'  OR UPPER(COALESCE(tc.DESCRIPCION,''))  LIKE '%PALLET%'
                  OR UPPER(COALESCE(art.DESCRIPCION,'')) LIKE '%PALET%'  OR UPPER(COALESCE(art.DESCRIPCION,'')) LIKE '%PALLET%'
                THEN 1 ELSE 0
            END
        AS bit)                                        AS EsPallet,

        /* FueraDeAlmacenaje: heurística por canal (TIPO_UBIC_ACTUAL 0/1) */
        CAST(
            CASE
                WHEN a.TIPO_UBIC_ACTUAL IN (0,1) THEN 1
                WHEN a.TIPO_UBIC_ACTUAL = 2 THEN 0
                ELSE 0
            END
        AS bit)                                        AS FueraDeAlmacenaje,

        a.ETIQUETA                                     AS Etiqueta,
        c.CODE_ERP                                     AS SKU,
        c.DESCRIPCION                                  AS Articulo,
        d.NOMBRE_FORMATO                               AS Formato,
        b.NUM_UNIDADES_FORM                            AS Unidades_Formato,
        d.CANT_FORM_BASE                               AS Cantidad_Base,
        CAST(b.num_unidades_form AS bigint)
        * CAST(d.CANT_FORM_BASE AS bigint)             AS Cantidad_Total_Unidades,

        CASE
            WHEN e.Proveedor IS NOT NULL THEN e.Proveedor
            WHEN f.Proveedor IS NOT NULL THEN f.Proveedor
            ELSE 'Desconocido'
        END                                            AS Proveedor,

        TRY_CAST(a.FECHAH_RECEPCION AS date)           AS FechaRecepcion,
        TRY_CAST(b.FECHA_VENCIMIENTO AS date)          AS FechaVencimiento,

        CAST(ISNULL(a.bloqueo, 0) AS bit)              AS Bloqueo_Contenedor,

        CAST(
            CASE
                WHEN a.TIPO_UBIC_ACTUAL = 2 THEN ISNULL(g.bloqueo, 0)
                WHEN a.TIPO_UBIC_ACTUAL IN (0,1) THEN ISNULL(can.bloqueo, 0)
                ELSE NULL
            END
        AS bit)                                        AS Bloqueo_Ubicacion,

        CAST(
            CASE
                WHEN a.TIPO_UBIC_ACTUAL = 2 THEN ISNULL(g.bloqueo, 0)
                WHEN a.TIPO_UBIC_ACTUAL IN (0,1) THEN ISNULL(can.bloqueo, 0)
                ELSE 0
            END
        AS bit)                                        AS Ubicacion_Bloqueada,

        z.descripcion                                  AS Tipo_Ubicacion,
        h.DESCRIPCION                                  AS Seccion,
        i.DESCRIPCION                                  AS Sector,
        tcan.descripcion                               AS TipoCanal
    FROM CONTENEDORES a
    /* FIX: LEFT JOIN para no filtrar masivamente */
    LEFT JOIN TIPOS_CONTENEDOR tc
        ON a.ID_TIPO_CONTENEDOR = tc.ID
    LEFT JOIN ARTICULOS art
        ON tc.ID_ENVASE = art.ID
    JOIN ART_CONT_CONT b
        ON a.id = b.ID_CONTENEDOR
    JOIN ARTICULOS c
        ON c.ID = b.ID_ARTICULO
    JOIN FORMATOS d
        ON d.ID = b.ID_FORMATO
    JOIN Tipos z
        ON a.TIPO_UBIC_ACTUAL = z.idparametro
    LEFT JOIN CTERec e
        ON e.IdOERec = b.ID_OE_REC
    LEFT JOIN CTEProv f
        ON f.ID_ARTICULO = b.ID_ARTICULO
    LEFT JOIN UBICALMACENES g
        ON g.ID = a.ID_UBIC_ACTUAL
       AND a.TIPO_UBIC_ACTUAL = 2
    LEFT JOIN SECCIONES h
        ON h.id = g.ID_SECCION
    LEFT JOIN SECTORES i
        ON g.ID_SECTOR = i.ID
    LEFT JOIN CANALES can
        ON a.ID_UBIC_ACTUAL = can.id
       AND a.TIPO_UBIC_ACTUAL IN (0,1)
    LEFT JOIN TiposCanales tcan
        ON can.TIPO_CANAL = tcan.idparametro;

    SELECT @@ROWCOUNT AS filas_afectadas;
END
GO