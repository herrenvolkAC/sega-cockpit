IF OBJECT_ID('bi.fact_recepcion_sku', 'U') IS NOT NULL
    DROP TABLE bi.fact_recepcion_sku;
GO

CREATE TABLE bi.fact_recepcion_sku
(
    recep_sku_id           bigint IDENTITY(1,1) NOT NULL,

    recepcion_id           bigint NOT NULL,
    articulo_id            bigint NOT NULL,

    oc_id                  bigint NULL,
    orden_compra           varchar(50) NULL,

    proveedor_id           bigint NULL,
    proveedor              varchar(200) NULL,

    mercaderia_id          bigint NULL,
    camion_id              bigint NULL,
    descarga_id            bigint NULL,
    mision_id              bigint NULL,

    fechah_recepcion_dt    datetime2(0) NOT NULL,
    fecha_operativa        date NOT NULL,

    sku                    varchar(80) NULL,
    articulo_desc          varchar(200) NULL,

    cantidad_unidades      decimal(18,4) NULL,
    cantidad_cajas         decimal(18,4) NULL,
    pallets                int NULL,

    inicio_dt              datetime2(0) NULL,
    fin_dt                 datetime2(0) NULL,

    camion_entrada_dt      datetime2(0) NULL,
    camion_salida_dt       datetime2(0) NULL,

    seccion_desc           varchar(120) NULL,
    sector_desc            varchar(120) NULL,  -- nueva columna

    loaded_at              datetime2(0) NOT NULL
        CONSTRAINT df_fact_recepcion_sku_loaded_at DEFAULT (sysdatetime()),

    CONSTRAINT pk_fact_recepcion_sku
        PRIMARY KEY CLUSTERED (recep_sku_id),

    CONSTRAINT uq_fact_recepcion_sku
        UNIQUE NONCLUSTERED (recepcion_id, articulo_id)
);
GO

CREATE INDEX ix_fact_recepcion_sku_fecha
    ON bi.fact_recepcion_sku (fecha_operativa);

CREATE INDEX ix_fact_recepcion_sku_sku
    ON bi.fact_recepcion_sku (sku, fecha_operativa);

CREATE INDEX ix_fact_recepcion_sku_proveedor
    ON bi.fact_recepcion_sku (proveedor_id, fecha_operativa);
GO