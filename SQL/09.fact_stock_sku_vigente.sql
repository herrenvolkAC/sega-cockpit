IF OBJECT_ID('bi.fact_stock_sku_vigente', 'U') IS NOT NULL
    DROP TABLE bi.fact_stock_sku_vigente;
GO

CREATE TABLE bi.fact_stock_sku_vigente
(
    stock_vigente_id          bigint IDENTITY(1,1) NOT NULL,

    snapshot_dt               datetime2(0) NOT NULL,
    fecha_operativa           date         NOT NULL,

    articulo_id               bigint       NOT NULL,
    sku                       varchar(80)  NULL,
    articulo_desc             varchar(200) NULL,

    stock_total_base          decimal(18,4) NOT NULL,
    stock_disponible_base     decimal(18,4) NOT NULL,
    stock_reservado_base      decimal(18,4) NOT NULL,
    stock_bloqueado_base      decimal(18,4) NOT NULL,

    dpd_base_30d              decimal(18,6) NULL,
    dias_stock_disponible     decimal(18,6) NULL,

    last_move_dt              datetime2(0) NULL,   -- queda NULL por ahora

    loaded_at                 datetime2(0) NOT NULL
        CONSTRAINT df_fact_stock_sku_vigente_loaded_at DEFAULT (sysdatetime()),

    CONSTRAINT pk_fact_stock_sku_vigente
        PRIMARY KEY CLUSTERED (stock_vigente_id)
);
GO

CREATE INDEX ix_fact_stock_sku_vigente_articulo
    ON bi.fact_stock_sku_vigente (articulo_id);

CREATE INDEX ix_fact_stock_sku_vigente_sku
    ON bi.fact_stock_sku_vigente (sku);

CREATE INDEX ix_fact_stock_sku_vigente_fecha
    ON bi.fact_stock_sku_vigente (fecha_operativa);
GO