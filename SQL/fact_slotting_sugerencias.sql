/****** Object: Table [bi].[fact_slotting_sugerencias]   Script Date: hoy ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [bi].[fact_slotting_sugerencias] (
    [sku]                               [varchar](100)    NOT NULL,
    [articulo]                          [varchar](300)    NULL,
    [tipologia_actual_observada]        [varchar](100)    NULL,
    [grupo_tipologia_actual]            [varchar](20)     NOT NULL,   -- BALDA / RACK_PALLET
    [sugerencia]                        [varchar](100)    NOT NULL,   -- texto accionable
    [grupo_tipologia_objetivo]          [varchar](20)     NULL,       -- BALDA / RACK_PALLET / NULL si no aplica
    [lineas_picking]                    [int]             NOT NULL,
    [unidades_pickeadas]                [int]             NOT NULL,
    [avg_qty_por_linea]                 [decimal](18, 2)  NOT NULL,
    [porc_lineas_unitarias]             [decimal](18, 4)  NOT NULL,
    [porc_lineas_multiplo_caja]         [decimal](18, 4)  NOT NULL,
    [porc_lineas_multiplo_pallet]       [decimal](18, 4)  NOT NULL,
    [lineas_por_1000_unidades]          [decimal](18, 2)  NOT NULL,
    [dias_con_actividad]                [int]             NOT NULL,
    [ubicaciones_distintas]             [int]             NOT NULL,
    [porc_unidades_desde_ubic_asignada] [decimal](18, 4)  NOT NULL,
    [score_hacia_rack_pallet]           [decimal](18, 2)  NOT NULL,
    [score_hacia_balda]                 [decimal](18, 2)  NOT NULL,
    [prioridad]                         [decimal](18, 2)  NOT NULL,
    [lineas_potencialmente_evitables]   [decimal](18, 0)  NULL,       -- NULL si no hay benchmark objetivo
    [ventana_desde]                     [date]            NOT NULL,   -- inicio del período analizado
    [ventana_hasta]                     [date]            NOT NULL,   -- fin del período analizado (exclusivo)
    [loaded_at]                         [datetime2](0)    NOT NULL,
    CONSTRAINT [PK_fact_slotting_sugerencias] PRIMARY KEY CLUSTERED
    (
        [sku] ASC
    ) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF,
            ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON,
            OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [bi].[fact_slotting_sugerencias]
    ADD CONSTRAINT [DF_fact_slotting_sugerencias_loaded_at]
    DEFAULT (sysdatetime()) FOR [loaded_at]
GO
