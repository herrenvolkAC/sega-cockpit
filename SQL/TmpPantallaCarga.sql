with MovPicking as (
	select a.ID_CONT_DESTINO as IdContenedor, max(c.fechah_fin) as FinOperacion 
	from TRASPASOS a join CONT_DESP_PICK b on a.ID_AGRUPACION = b.id join OPERACIONES_RF c on b.ID_RECORRIDO = c.id
	where TIPO_TRASPASO = 0 group by a.ID_CONT_DESTINO),
MovCross as (
	select a.ID_CONT_DESTINO as IdContenedor, max(c.fechah_fin) as FinOperacion 
	from TRASPASOS a join OPERACIONES_RF c on a.ID_AGRUPACION = c.id
	where TIPO_TRASPASO = 1 group by a.ID_CONT_DESTINO),
MovExtr as (
	select z.ID_CONTENEDOR as IdContenedor, max(d.fechah_fin) as FinOperacion 
	from TRASPASOS a
        JOIN CONT_DESP_COMPL c  ON a.ID_AGRUPACION = c.ID
        JOIN MOV_EXTRACCION z   ON c.ID = z.ID_CONT_COMPL
        JOIN OPERACIONES_RF d   ON z.ID_OPERACION = d.ID
	where TIPO_TRASPASO = 2 group by z.ID_CONTENEDOR)
select  
	TRY_CAST(a.FECHA_HORA AS date) AS Fecha,
	e.MATRICULA,
	count(distinct b.ETIQUETA) as ULs,
	count(distinct d.NOMBRE) as CantidadDestinos,
	min(i.fechah_inicio) as InicioCarga,
	max(i.fechah_fin) as FinCarga,
	max(isnull(mp.FinOperacion, mc.FinOperacion)),
	max(me.FinOperacion)
from
	AVISOS_MERCADERIA a join UL_MAYOR_MERCADER b on a.id = b.ID_MERCADERIA
	join CENTROS d on d.ID = a.ID_CENTRO_DESTINO
	join CAMIONES e on e.ID = a.ID_CAMION
	join OPERACION_RF_EXPE h on a.ID_OPERACION = h.ID_EXPEDICION
	join OPERACIONES_RF i on i.ID = h.ID
	join TIPOS_OPERACION j on i.TIPO_EXTERNO = j.ID
	left join MovPicking mp on b.ID_CONTENEDOR = mp.IdContenedor
	left join MovCross mc on b.ID_CONTENEDOR = mc.IdContenedor
	left join MovExtr me on b.ID_CONTENEDOR = me.IdContenedor
where
	TIPO_AV = 1 and b.ID_TIPO_CONTENEDOR is not null
and TRY_CONVERT(datetime2(0), a.FECHA_HORA, 120) >= '2024-09-01' and MATRICULA = 'F2 EXP.'
group by 	TRY_CAST(a.FECHA_HORA AS date),e.MATRICULA

select  distinct ETIQUETA, ID_CONTENEDOR
from
	AVISOS_MERCADERIA a join UL_MAYOR_MERCADER b on a.id = b.ID_MERCADERIA
	join CENTROS d on d.ID = a.ID_CENTRO_DESTINO
	join CAMIONES e on e.ID = a.ID_CAMION
	join OPERACION_RF_EXPE h on a.ID_OPERACION = h.ID_EXPEDICION
	join OPERACIONES_RF i on i.ID = h.ID
	join TIPOS_OPERACION j on i.TIPO_EXTERNO = j.ID
where
	TIPO_AV = 1 and b.ID_TIPO_CONTENEDOR is not null
and MATRICULA = 'F2 EXP.' and TRY_CAST(a.FECHA_HORA AS date) = '2025-09-25'

select * from TRASPASOS where ID_CONT_DESTINO = 484102

select * from CONT_DESP_PICK where ID_CONTENEDOR = 484102 

select * from MOVIMIENTOS_STOCK where ID_CONT_DEST = 484102 

select * from UL_MAYOR_MERCADER a join AVISOS_MERCADERIA b on a.ID_MERCADERIA = b.ID where ETIQUETA = 'RC1600000000005836'
and ID_CONTENEDOR = 484102 

select * from MOV_EXTRACCION where ID_CONTENEDOR = 484102 