USE [MACROMERCADO]
GO

SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [bi].[fact_ocupacion_ubicaciones](
    [fecha]                  date            NOT NULL,
    [id_ubicacion]           int             NOT NULL,
    [pasillo]                varchar(50)     NULL,
    [columna]                varchar(50)     NULL,
    [nivel]                  varchar(50)     NULL,
    [compart]                varchar(50)     NULL,
    [es_de_picking]          bit             NULL,
    [capacidad]              decimal(18,2)   NULL,
    [tipo_ubicacion]         varchar(100)    NULL,
    [sector]                 varchar(100)    NULL,
    [seccion]                varchar(100)    NULL,
    [cant_contenedores]      int             NOT NULL,
    [cant_unidades]          decimal(18,2)   NOT NULL,
    [cant_cajas]             decimal(18,2)   NOT NULL,
    [bloqueo]                int             NULL,
    [lugares_libres]         decimal(18,2)   NULL,
    [ocupacion_pct]          decimal(18,4)   NULL,
    [loaded_at]              datetime2(0)    NOT NULL,
    CONSTRAINT [PK_fact_ocupacion_ubicaciones] PRIMARY KEY CLUSTERED
    (
        [fecha] ASC,
        [id_ubicacion] ASC
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

ALTER TABLE [bi].[fact_ocupacion_ubicaciones]
ADD CONSTRAINT [DF_fact_ocupacion_ubicaciones_loaded_at]
DEFAULT (sysdatetime()) FOR [loaded_at]
GO

CREATE INDEX [IX_fact_ocupacion_ubicaciones_loaded_at]
ON [bi].[fact_ocupacion_ubicaciones] ([loaded_at])
GO

CREATE INDEX [IX_fact_ocupacion_ubicaciones_sector_fecha]
ON [bi].[fact_ocupacion_ubicaciones] ([sector], [fecha])
GO