CREATE TABLE bi.fact_oc_item
(
    date_key              int           NOT NULL,  -- fecha de creación OE (InicioVigencia)
    oc_codigo             varchar(100)  NOT NULL,  -- a.id_orden_compra (si es numérico, podés dejar int)
    id_orden_entrada      int           NOT NULL,  -- a.id
    id_oc_item            int           NOT NULL,  -- b.id (PK negocio)
    id_articulo           int           NOT NULL,

    sku                   varchar(100)  NULL,
    codigo_comercial      varchar(100)  NULL,
    articulo_desc         varchar(300)  NULL,

    proveedor_nombre      varchar(200)  NULL,
    tipo_orden_entrada    varchar(200)  NULL,

    ux_b                  decimal(18,4) NULL,
    unidades_ordenadas    decimal(18,4) NOT NULL,

    refreshed_at          datetime2(0)  NOT NULL
        CONSTRAINT DF_fact_oc_item_refreshed_at DEFAULT (sysutcdatetime()),

    CONSTRAINT PK_fact_oc_item PRIMARY KEY CLUSTERED (date_key, id_oc_item)
);

ALTER TABLE bi.fact_oc_item WITH CHECK
ADD CONSTRAINT CK_fact_oc_item_nonneg CHECK (unidades_ordenadas >= 0 AND (ux_b IS NULL OR ux_b >= 0));

CREATE TABLE bi.fact_receipt_item_day
(
    date_key             int           NOT NULL, -- FechaRecepcion
    id_orden_entrada     int           NOT NULL,
    id_oc_item           int           NOT NULL,
    unidades_recibidas   decimal(18,4) NOT NULL,

    refreshed_at         datetime2(0)  NOT NULL
        CONSTRAINT DF_fact_receipt_item_day_refreshed_at DEFAULT (sysutcdatetime()),

    CONSTRAINT PK_fact_receipt_item_day PRIMARY KEY CLUSTERED (date_key, id_orden_entrada, id_oc_item)
);

ALTER TABLE bi.fact_receipt_item_day WITH CHECK
ADD CONSTRAINT CK_fact_receipt_item_day_nonneg CHECK (unidades_recibidas >= 0);

CREATE TABLE bi.fact_oc_item_status
(
    id_oc_item              int           NOT NULL,
    id_orden_entrada         int           NOT NULL,
    oc_codigo                varchar(100)  NOT NULL,
    id_articulo              int           NOT NULL,

    date_key_inicio          int           NOT NULL, -- inicio vigencia (creación)
    date_key_ultima_rec      int           NULL,

    unidades_ordenadas       decimal(18,4) NOT NULL,
    unidades_recibidas_total decimal(18,4) NOT NULL,
    unidades_pendientes      AS (CASE WHEN unidades_ordenadas > unidades_recibidas_total
                                THEN unidades_ordenadas - unidades_recibidas_total
                                ELSE CONVERT(decimal(18,4),0) END) PERSISTED,

    recepciones_dias_count   int           NOT NULL, -- días con recepción (proxy)
    refreshed_at             datetime2(0)  NOT NULL
        CONSTRAINT DF_fact_oc_item_status_refreshed_at DEFAULT (sysutcdatetime()),

    CONSTRAINT PK_fact_oc_item_status PRIMARY KEY CLUSTERED (id_oc_item)
);

ALTER TABLE bi.fact_oc_item_status WITH CHECK
ADD CONSTRAINT CK_fact_oc_item_status_nonneg CHECK (unidades_ordenadas >= 0 AND unidades_recibidas_total >= 0);


