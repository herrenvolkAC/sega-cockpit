USE MACROMERCADO;
GO

/* ============================================================
   TABLA: bi.fact_carga_camion_viaje
   - Sin corchetes en nombres de columnas (evita el bug del canal)
   ============================================================ */

IF OBJECT_ID('bi.fact_carga_camion_viaje','U') IS NOT NULL
    DROP TABLE bi.fact_carga_camion_viaje;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE TABLE bi.fact_carga_camion_viaje
(
    snapshot_dt           datetime2(0) NOT NULL
        CONSTRAINT DF_fact_carga_camion_viaje_snapshot_dt DEFAULT (SYSDATETIME()),
    fecha_operativa       date         NOT NULL,

    fecha                date         NOT NULL,
    camion_id            int          NOT NULL,
    viaje_seq            int          NOT NULL,

    matricula            varchar(50)  NOT NULL,

    uls                  int          NOT NULL,
    cantidad_destinos    int          NOT NULL,

    inicio_carga         datetime2(0) NOT NULL,
    fin_carga            datetime2(0) NOT NULL,
    duracion_carga_min   int          NOT NULL,

    fin_preparacion      datetime2(0) NULL,

    uls_sin_fin_prep     int          NOT NULL,
    uls_sin_volumen      int          NOT NULL,
    uls_overfill         int          NOT NULL,

    ocupacion_contenedores decimal(9,4) NULL,

    CONSTRAINT PK_fact_carga_camion_viaje
        PRIMARY KEY CLUSTERED (fecha, camion_id, viaje_seq)
);
GO

CREATE INDEX IX_fact_carga_camion_viaje_fecha
    ON bi.fact_carga_camion_viaje (fecha)
    INCLUDE (camion_id, viaje_seq, matricula, uls, cantidad_destinos, inicio_carga, fin_carga, duracion_carga_min, ocupacion_contenedores);
GO

CREATE INDEX IX_fact_carga_camion_viaje_camion
    ON bi.fact_carga_camion_viaje (camion_id, fecha, viaje_seq);
GO


/* ============================================================
   SP: bi.usp_load_carga_camion_viaje
   - TRUNCATE + INSERT
   - NO mezcla dos cargas del mismo camión el mismo día:
     corta viajes por gaps > @gap_min (minutos) entre intervalos
   - Devuelve filas afectadas
   ============================================================ */
CREATE OR ALTER PROCEDURE bi.usp_load_carga_camion_viaje
    @from_dt datetime2(0) = '2024-09-01 00:00:00',
    @to_dt   datetime2(0) = '2099-12-31 00:00:00',
    @gap_min int          = 60
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @snapshot_dt     datetime2(0) = SYSDATETIME();
    DECLARE @fecha_operativa date         = CAST(@snapshot_dt AS date);

    TRUNCATE TABLE bi.fact_carga_camion_viaje;

    ;WITH
    MovPicking AS (
        SELECT
            a.ID_CONT_DESTINO AS id_contenedor,
            fin_operacion_dt = MAX(c.FECHAH_FIN)
        FROM TRASPASOS a
        JOIN CONT_DESP_PICK b ON a.ID_AGRUPACION = b.ID
        JOIN OPERACIONES_RF c ON b.ID_RECORRIDO = c.ID
        WHERE a.TIPO_TRASPASO = 0
        GROUP BY a.ID_CONT_DESTINO
    ),
    MovCross AS (
        SELECT
            a.ID_CONT_DESTINO AS id_contenedor,
            fin_operacion_dt = MAX(c.FECHAH_FIN)
        FROM TRASPASOS a
        JOIN OPERACIONES_RF c ON a.ID_AGRUPACION = c.ID
        WHERE a.TIPO_TRASPASO = 1
        GROUP BY a.ID_CONT_DESTINO
    ),
    MovExtr AS (
        SELECT
            z.ID_CONTENEDOR AS id_contenedor,
            fin_operacion_dt = MAX(d.FECHAH_FIN)
        FROM TRASPASOS a
        JOIN CONT_DESP_COMPL  c  ON a.ID_AGRUPACION = c.ID
        JOIN MOV_EXTRACCION   z  ON c.ID = z.ID_CONT_COMPL
        JOIN OPERACIONES_RF   d  ON z.ID_OPERACION = d.ID
        WHERE a.TIPO_TRASPASO = 2
        GROUP BY z.ID_CONTENEDOR
    ),
    VolumenUls AS (
        SELECT
            ul.ID AS ul_id,
            ocupacion_pct_raw =
                CASE
                    WHEN tc.VOLUMEN_CM3 IS NULL OR tc.VOLUMEN_CM3 = 0 THEN NULL
                    ELSE
                        (SUM(CAST(acm.NUM_UNIDADES_FORM AS decimal(18,4)) * CAST(fm.VOLUMEN_CM3 AS decimal(18,4))) * 100.0)
                        / CAST(tc.VOLUMEN_CM3 AS decimal(18,4))
                END
        FROM UL_MAYOR_MERCADER ul
        JOIN ART_CONT_MERCADER acm ON ul.ID = acm.ID_UL_MAYOR
        JOIN FORMATOS fm           ON acm.ID_FORMATO = fm.ID
        JOIN TIPOS_CONTENEDOR tc   ON ul.ID_TIPO_CONTENEDOR = tc.ID
        GROUP BY ul.ID, tc.VOLUMEN_CM3
    ),
    Base AS (
        SELECT
            aviso_id = a.ID,
            aviso_dt = TRY_CONVERT(datetime2(0), a.FECHA_HORA, 120),
            fecha    = CAST(TRY_CONVERT(datetime2(0), a.FECHA_HORA, 120) AS date),

            camion_id = e.ID,
            e.MATRICULA,

            b.ETIQUETA,
            destino_id = d.ID,

            inicio_carga_dt = i.FECHAH_INICIO,
            fin_carga_dt    = i.FECHAH_FIN,

            fin_preparacion_dt = COALESCE(mp.fin_operacion_dt, mc.fin_operacion_dt, me.fin_operacion_dt),

            ocupacion_pct_raw = vul.ocupacion_pct_raw
        FROM AVISOS_MERCADERIA a
        JOIN UL_MAYOR_MERCADER b ON a.ID = b.ID_MERCADERIA
        JOIN CENTROS d           ON d.ID = a.ID_CENTRO_DESTINO
        JOIN CAMIONES e          ON e.ID = a.ID_CAMION
        JOIN OPERACION_RF_EXPE h ON a.ID_OPERACION = h.ID_EXPEDICION
        JOIN OPERACIONES_RF i    ON i.ID = h.ID

        LEFT JOIN MovPicking mp  ON b.ID_CONTENEDOR = mp.id_contenedor
        LEFT JOIN MovCross   mc  ON b.ID_CONTENEDOR = mc.id_contenedor
        LEFT JOIN MovExtr    me  ON b.ID_CONTENEDOR = me.id_contenedor
        LEFT JOIN VolumenUls vul ON b.ID = vul.ul_id

        WHERE a.TIPO_AV = 1
          AND b.ID_TIPO_CONTENEDOR IS NOT NULL
          AND TRY_CONVERT(datetime2(0), a.FECHA_HORA, 120) IS NOT NULL
          AND TRY_CONVERT(datetime2(0), a.FECHA_HORA, 120) >= @from_dt
          AND TRY_CONVERT(datetime2(0), a.FECHA_HORA, 120) <  @to_dt
          AND i.FECHAH_INICIO IS NOT NULL
          AND i.FECHAH_FIN IS NOT NULL
          AND i.FECHAH_FIN >= i.FECHAH_INICIO
    ),

    /* Intervalos por operación (inicio/fin) para cortar por gap */
    Intervalos AS (
        SELECT
            fecha,
            camion_id,
            matricula = MAX(MATRICULA),
            inicio = MIN(inicio_carga_dt),
            fin    = MAX(fin_carga_dt)
        FROM Base
        GROUP BY fecha, camion_id, inicio_carga_dt, fin_carga_dt
    ),
    Ordenado AS (
        SELECT
            i.*,
            prev_fin = LAG(i.fin) OVER (PARTITION BY i.fecha, i.camion_id ORDER BY i.inicio, i.fin)
        FROM Intervalos i
    ),
    Marcado AS (
        SELECT
            o.*,
            nueva_vuelta =
                CASE
                    WHEN o.prev_fin IS NULL THEN 1
                    WHEN DATEDIFF(minute, o.prev_fin, o.inicio) > @gap_min THEN 1
                    ELSE 0
                END
        FROM Ordenado o
    ),
    Trips AS (
        SELECT
            m.*,
            viaje_seq =
                SUM(m.nueva_vuelta) OVER (PARTITION BY m.fecha, m.camion_id ORDER BY m.inicio, m.fin ROWS UNBOUNDED PRECEDING)
        FROM Marcado m
    ),

    /* Asignar cada fila Base a su viaje por inclusión en el intervalo */
    BaseConViaje AS (
        SELECT
            b.*,
            t.viaje_seq,
            t.inicio AS trip_inicio,
            t.fin    AS trip_fin
        FROM Base b
        JOIN Trips t
          ON t.fecha = b.fecha
         AND t.camion_id = b.camion_id
         AND b.inicio_carga_dt >= t.inicio
         AND b.fin_carga_dt    <= t.fin
    )

    INSERT INTO bi.fact_carga_camion_viaje
    (
        snapshot_dt,
        fecha_operativa,
        fecha,
        camion_id,
        viaje_seq,
        matricula,
        uls,
        cantidad_destinos,
        inicio_carga,
        fin_carga,
        duracion_carga_min,
        fin_preparacion,
        uls_sin_fin_prep,
        uls_sin_volumen,
        uls_overfill,
        ocupacion_contenedores
    )
    SELECT
        @snapshot_dt,
        @fecha_operativa,

        b.fecha,
        b.camion_id,
        b.viaje_seq,
        MAX(b.MATRICULA),

        COUNT(DISTINCT b.ETIQUETA),
        COUNT(DISTINCT b.destino_id),

        MIN(b.inicio_carga_dt),
        MAX(b.fin_carga_dt),
        DATEDIFF(minute, MIN(b.inicio_carga_dt), MAX(b.fin_carga_dt)),

        MAX(b.fin_preparacion_dt),

        SUM(CASE WHEN b.fin_preparacion_dt IS NULL THEN 1 ELSE 0 END),
        SUM(CASE WHEN b.ocupacion_pct_raw IS NULL THEN 1 ELSE 0 END),
        SUM(CASE WHEN b.ocupacion_pct_raw > 100 THEN 1 ELSE 0 END),

        AVG(CASE
                WHEN b.ocupacion_pct_raw IS NULL THEN NULL
                WHEN b.ocupacion_pct_raw < 0 THEN 0
                WHEN b.ocupacion_pct_raw > 100 THEN 100
                ELSE b.ocupacion_pct_raw
            END)
    FROM BaseConViaje b
    GROUP BY b.fecha, b.camion_id, b.viaje_seq
    ORDER BY b.fecha, b.camion_id, b.viaje_seq;

    SELECT @@ROWCOUNT AS filas_afectadas;
END
GO
