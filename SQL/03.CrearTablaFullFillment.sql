-- Asegurar schema
IF SCHEMA_ID('bi') IS NULL
    EXEC('CREATE SCHEMA bi');
GO

IF OBJECT_ID('bi.fact_fulfillment_line_day','U') IS NOT NULL
    DROP TABLE bi.fact_fulfillment_line_day;
GO

CREATE TABLE bi.fact_fulfillment_line_day
(
    date_key            int           NOT NULL,   -- yyyymmdd

    centro_codigo       varchar(50)   NOT NULL,
    centro_nombre       varchar(200)  NULL,

    codigo_pedido       varchar(100)  NOT NULL,
    id_pedido           int           NULL,
    referencia          varchar(200)  NULL,
    tipo_pedido         int           NULL,

    id_articulo         int           NOT NULL,
    sku                 varchar(100)  NULL,
    articulo_desc       varchar(300)  NULL,

    formato             varchar(50)   NOT NULL,   -- CAJA/UNIDAD/PACK
    qty_solicitada      decimal(18,4) NOT NULL,
    qty_expedida        decimal(18,4) NOT NULL,

    shortage_qty        AS (CASE WHEN qty_solicitada > qty_expedida THEN qty_solicitada - qty_expedida ELSE CONVERT(decimal(18,4),0) END) PERSISTED,

    avisos_count        int           NOT NULL,
    aviso_ejemplo       varchar(100)  NULL,

    refreshed_at        datetime2(0)  NOT NULL CONSTRAINT DF_fact_fulfillment_line_day_refreshed_at DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_fact_fulfillment_line_day
        PRIMARY KEY CLUSTERED (date_key, centro_codigo, codigo_pedido, id_articulo, formato),

    CONSTRAINT CK_fact_fulfillment_qty_nonneg CHECK (qty_solicitada >= 0 AND qty_expedida >= 0),
    CONSTRAINT CK_fact_fulfillment_avisos_nonneg CHECK (avisos_count >= 0)
);
GO

-- Índices útiles para Power BI
CREATE INDEX IX_ffld_day__pedido ON bi.fact_fulfillment_line_day(date_key, codigo_pedido) INCLUDE (centro_codigo, qty_solicitada, qty_expedida);
CREATE INDEX IX_ffld_day__sku    ON bi.fact_fulfillment_line_day(date_key, sku) INCLUDE (qty_solicitada, qty_expedida, formato);
GO
