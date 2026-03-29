USE [MACROMERCADO]
GO

SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

create TABLE [bi].[fact_satisfaccion_oc_actual](
    [id_orden_entrada]         int             NOT NULL,
    [oc]                       varchar(100)    NULL,
    [estado_codigo]            int             NOT NULL,
    [estado_desc]              varchar(100)    NULL,
    [inicio_vigencia]          datetime        NULL,
    [fin_vigencia]             datetime        NULL,
    [id_origen]                int             NULL,
    [proveedor]                varchar(200)    NULL,
    [id_articulo]              int             NOT NULL,
    [articulo]                 varchar(300)    NULL,
    [unidades_pedidas]         decimal(18,2)   NOT NULL,
    [uxb]                      decimal(18,2)   NULL,
    [unidades_recibidas]       decimal(18,2)   NOT NULL,
    [unidades_pendientes]      decimal(18,2)   NOT NULL,
    [porc_satisfaccion]        decimal(18,4)   NULL,
    [cajas_pedidas]            decimal(18,2)   NULL,
    [cajas_recibidas]          decimal(18,2)   NULL,
    [cajas_pendientes]         decimal(18,2)   NULL,
    [completa_flag]            bit             NOT NULL,
    [activo]                   bit             NOT NULL,
    [first_loaded_at]          datetime2(0)    NOT NULL,
    [last_loaded_at]           datetime2(0)    NOT NULL,
    CONSTRAINT [PK_fact_satisfaccion_oc_actual] PRIMARY KEY CLUSTERED
    (
        [id_orden_entrada] ASC,
        [id_articulo] ASC
    )
    WITH (
        PAD_INDEX = OFF,
        STATISTICS_NORECOMPUTE = OFF,
        IGNORE_DUP_KEY = OFF,
        ALLOW_ROW_LOCKS = ON,
        ALLOW_PAGE_LOCKS = ON,
        OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
    ) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [bi].[fact_satisfaccion_oc_actual]
ADD CONSTRAINT [DF_fact_satisfaccion_oc_actual_activo]
DEFAULT ((1)) FOR [activo]
GO

ALTER TABLE [bi].[fact_satisfaccion_oc_actual]
ADD CONSTRAINT [DF_fact_satisfaccion_oc_actual_first_loaded_at]
DEFAULT (sysdatetime()) FOR [first_loaded_at]
GO

ALTER TABLE [bi].[fact_satisfaccion_oc_actual]
ADD CONSTRAINT [DF_fact_satisfaccion_oc_actual_last_loaded_at]
DEFAULT (sysdatetime()) FOR [last_loaded_at]
GO

CREATE INDEX [IX_fact_satisfaccion_oc_actual_oc]
ON [bi].[fact_satisfaccion_oc_actual] ([oc])
GO

CREATE INDEX [IX_fact_satisfaccion_oc_actual_estado]
ON [bi].[fact_satisfaccion_oc_actual] ([estado_desc])
GO

CREATE INDEX [IX_fact_satisfaccion_oc_actual_centro]
ON [bi].[fact_satisfaccion_oc_actual] ([proveedor])
GO

CREATE INDEX [IX_fact_satisfaccion_oc_actual_activo]
ON [bi].[fact_satisfaccion_oc_actual] ([activo])
GO