-- Cubre los filtros más frecuentes: activo, proveedor, completa_flag
CREATE INDEX [IX_fact_satisfaccion_oc_activo]
ON [bi].[fact_satisfaccion_oc_actual] ([activo], [proveedor])
INCLUDE ([oc], [completa_flag], [unidades_pedidas], [unidades_recibidas],
         [unidades_pendientes], [cajas_pedidas], [cajas_recibidas],
         [cajas_pendientes], [porc_satisfaccion])
GO

-- Cubre la query de evolución (activo=0 + fin_vigencia)
CREATE INDEX [IX_fact_satisfaccion_oc_cerradas_vigencia]
ON [bi].[fact_satisfaccion_oc_actual] ([activo], [fin_vigencia])
INCLUDE ([oc], [completa_flag], [unidades_pedidas], [unidades_recibidas], [porc_satisfaccion])
GO

-- Cubre la query de artículos pendientes
CREATE INDEX [IX_fact_satisfaccion_oc_pendientes]
ON [bi].[fact_satisfaccion_oc_actual] ([unidades_pendientes], [activo])
INCLUDE ([articulo], [oc], [unidades_pedidas], [cajas_pendientes], [porc_satisfaccion])
GO
