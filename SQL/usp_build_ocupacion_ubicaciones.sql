USE [MACROMERCADO]
GO

SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [bi].[usp_build_ocupacion_ubicaciones]
    @fecha date = NULL   -- fecha lógica del snapshot
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @fecha_snapshot date = ISNULL(@fecha, CAST(GETDATE() AS date));
    DECLARE @loaded_at      datetime2(0) = SYSDATETIME();

    BEGIN TRANSACTION;

        /* ================================================================
           Ocupación de ubicaciones
           - Guarda una foto diaria por ubicación
           - Si se re-ejecuta para la misma fecha, reemplaza la foto
           - loaded_at guarda cuándo se ejecutó realmente la carga
           ================================================================ */

        DELETE FROM [bi].[fact_ocupacion_ubicaciones]
        WHERE [fecha] = @fecha_snapshot;

        ;WITH CTE_Contenedores AS (
            SELECT
                a.ID_UBIC_ACTUAL AS IdUbicacion,
                COUNT(DISTINCT a.ID) AS CantContenedores,
                SUM(
                    CASE
                        WHEN c.NOMBRE_FORMATO = 'UNIDAD' THEN ISNULL(b.NUM_UNIDADES_FORM, 0)
                        ELSE 0
                    END
                ) AS CantUnidades,
                SUM(
                    CASE
                        WHEN c.NOMBRE_FORMATO = 'CAJA' THEN ISNULL(b.NUM_UNIDADES_FORM, 0)
                        ELSE 0
                    END
                ) AS CantCajas
            FROM CONTENEDORES a
            INNER JOIN ART_CONT_CONT b
                ON a.ID = b.ID_CONTENEDOR
            INNER JOIN FORMATOS c
                ON b.ID_FORMATO = c.ID
            WHERE a.TIPO_UBIC_ACTUAL = 2
            GROUP BY a.ID_UBIC_ACTUAL
        )
        INSERT INTO [bi].[fact_ocupacion_ubicaciones] (
            [fecha],
            [id_ubicacion],
            [pasillo],
            [columna],
            [nivel],
            [compart],
            [es_de_picking],
            [capacidad],
            [tipo_ubicacion],
            [sector],
            [seccion],
            [cant_contenedores],
            [cant_unidades],
            [cant_cajas],
            [bloqueo],
            [lugares_libres],
            [ocupacion_pct],
            [loaded_at]
        )
        SELECT
            @fecha_snapshot AS [fecha],
            a.ID AS [id_ubicacion],
            a.PASILLO,
            a.COLUMNA,
            a.NIVEL,
            a.COMPART,
            a.ES_DE_PICKING,
            CAST(a.CAPACIDAD AS decimal(18,2)) AS [capacidad],
            b.NOMBRE AS [tipo_ubicacion],
            c.DESCRIPCION AS [sector],
            d.DESCRIPCION AS [seccion],
            ISNULL(e.CantContenedores, 0) AS [cant_contenedores],
            CAST(ISNULL(e.CantUnidades, 0) AS decimal(18,2)) AS [cant_unidades],
            CAST(ISNULL(e.CantCajas, 0) AS decimal(18,2)) AS [cant_cajas],
            a.BLOQUEO AS [bloqueo],
            CASE
                WHEN a.CAPACIDAD IS NULL THEN NULL
                ELSE CAST(a.CAPACIDAD AS decimal(18,2))
                     - CAST(ISNULL(e.CantContenedores, 0) AS decimal(18,2))
            END AS [lugares_libres],
            CASE
                WHEN a.CAPACIDAD IS NULL OR a.CAPACIDAD = 0 THEN NULL
                ELSE CAST(ISNULL(e.CantContenedores, 0) * 1.0 / a.CAPACIDAD AS decimal(18,4))
            END AS [ocupacion_pct],
            @loaded_at AS [loaded_at]
        FROM UBICALMACENES a
        INNER JOIN TIPOS_UBIC_ALMACEN b
            ON a.ID_TIPO_UBICALM = b.ID
        LEFT JOIN SECTORES c
            ON a.ID_SECTOR = c.ID
        LEFT JOIN SECCIONES d
            ON a.ID_SECCION = d.ID
        LEFT JOIN CTE_Contenedores e
            ON a.ID = e.IdUbicacion
        WHERE a.PASILLO IS NOT NULL;

    COMMIT TRANSACTION;
END
GO