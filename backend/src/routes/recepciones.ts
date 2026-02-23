import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { getPool } from "../db";

export default async function recepcionesRoute(fastify: FastifyInstance) {
  // Endpoint para obtener datos de recepciones
  fastify.get('/recepciones', async (request, reply) => {
    try {
      const { fechaInicio, fechaFin, proveedor, sku } = request.query as {
        fechaInicio?: string;
        fechaFin?: string;
        proveedor?: string;
        sku?: string;
      };

      // Validar parámetros requeridos
      if (!fechaInicio || !fechaFin) {
        return reply.status(400).send({
          error: {
            message: 'Faltan parámetros requeridos: fechaInicio, fechaFin'
          }
        });
      }

      // Convertir fechas del formato YYYYMMDD a YYYY-MM-DD
      const from_date = `${fechaInicio.substring(0, 4)}-${fechaInicio.substring(4, 6)}-${fechaInicio.substring(6, 8)}`;
      const to_date = `${fechaFin.substring(0, 4)}-${fechaFin.substring(4, 6)}-${fechaFin.substring(6, 8)}`;
      
      console.log('=== RECEPCIONES REQUEST ===');
      console.log('Params:', { fechaInicio, fechaFin, proveedor, sku });
      console.log('Dates:', { from_date, to_date });

      // Obtener conexión a la base de datos
      const connection = await getPool();

      // 1. ULs recepcionadas por día (pallets)
      const ulsPorDiaQuery = `
        SELECT 
          CONVERT(varchar, fecha_operativa, 103) as fecha,
          FORMAT(fecha_operativa, 'dd/MM') as dia,
          SUM(COALESCE(pallets, 0)) as uls
        FROM bi.fact_recepcion_sku
        WHERE fecha_operativa >= @from_date
          AND fecha_operativa <= @to_date
          ${proveedor && proveedor.trim() ? "AND UPPER(LTRIM(RTRIM(proveedor))) LIKE UPPER(@proveedor)" : ""}
          ${sku && sku.trim() ? "AND UPPER(LTRIM(RTRIM(sku))) LIKE UPPER(@sku)" : ""}
        GROUP BY fecha_operativa, FORMAT(fecha_operativa, 'dd/MM'), CONVERT(varchar, fecha_operativa, 103)
        ORDER BY fecha_operativa
      `;

      // 2. Cajas recepcionadas por día (cantidad_cajas)
      const cajasPorDiaQuery = `
        SELECT 
          CONVERT(varchar, fecha_operativa, 103) as fecha,
          FORMAT(fecha_operativa, 'dd/MM') as dia,
          SUM(COALESCE(cantidad_cajas, 0)) as cajas
        FROM bi.fact_recepcion_sku
        WHERE fecha_operativa >= @from_date
          AND fecha_operativa <= @to_date
          ${proveedor && proveedor.trim() ? "AND UPPER(LTRIM(RTRIM(proveedor))) LIKE UPPER(@proveedor)" : ""}
          ${sku && sku.trim() ? "AND UPPER(LTRIM(RTRIM(sku))) LIKE UPPER(@sku)" : ""}
        GROUP BY fecha_operativa, FORMAT(fecha_operativa, 'dd/MM'), CONVERT(varchar, fecha_operativa, 103)
        ORDER BY fecha_operativa
      `;

      // 3. Tiempo medio de recepción por día (inicio_dt → fin_dt en horas)
      const tiempoRecepcionPorDiaQuery = `
        SELECT 
          CONVERT(varchar, fecha_operativa, 103) as fecha,
          FORMAT(fecha_operativa, 'dd/MM') as dia,
          AVG(DATEDIFF(minute, inicio_dt, fin_dt) / 60.0) as tiempo_promedio_horas
        FROM bi.fact_recepcion_sku
        WHERE fecha_operativa >= @from_date
          AND fecha_operativa <= @to_date
          AND inicio_dt IS NOT NULL 
          AND fin_dt IS NOT NULL
          ${proveedor && proveedor.trim() ? "AND UPPER(LTRIM(RTRIM(proveedor))) LIKE UPPER(@proveedor)" : ""}
          ${sku && sku.trim() ? "AND UPPER(LTRIM(RTRIM(sku))) LIKE UPPER(@sku)" : ""}
        GROUP BY fecha_operativa, FORMAT(fecha_operativa, 'dd/MM'), CONVERT(varchar, fecha_operativa, 103)
        ORDER BY fecha_operativa
      `;

      // 4. Tiempo medio de estada de camión por día (camion_entrada_dt → camion_salida_dt en horas)
      const tiempoCamionPorDiaQuery = `
        SELECT 
          CONVERT(varchar, fecha_operativa, 103) as fecha,
          FORMAT(fecha_operativa, 'dd/MM') as dia,
          AVG(DATEDIFF(minute, camion_entrada_dt, camion_salida_dt) / 60.0) as tiempo_promedio_horas
        FROM bi.fact_recepcion_sku
        WHERE fecha_operativa >= @from_date
          AND fecha_operativa <= @to_date
          AND camion_entrada_dt IS NOT NULL 
          AND camion_salida_dt IS NOT NULL
          ${proveedor && proveedor.trim() ? "AND UPPER(LTRIM(RTRIM(proveedor))) LIKE UPPER(@proveedor)" : ""}
          ${sku && sku.trim() ? "AND UPPER(LTRIM(RTRIM(sku))) LIKE UPPER(@sku)" : ""}
        GROUP BY fecha_operativa, FORMAT(fecha_operativa, 'dd/MM'), CONVERT(varchar, fecha_operativa, 103)
        ORDER BY fecha_operativa
      `;

      // 5. Recepciones por sector (torta con SUM(pallets))
      const recepcionesPorSeccionQuery = `
        SELECT 
          LTRIM(RTRIM(sector_desc)) as sector,
          SUM(COALESCE(pallets, 0)) as uls
        FROM bi.fact_recepcion_sku
        WHERE fecha_operativa >= @from_date
          AND fecha_operativa <= @to_date
          ${proveedor && proveedor.trim() ? "AND UPPER(LTRIM(RTRIM(proveedor))) LIKE UPPER(@proveedor)" : ""}
          ${sku && sku.trim() ? "AND UPPER(LTRIM(RTRIM(sku))) LIKE UPPER(@sku)" : ""}
        GROUP BY LTRIM(RTRIM(sector_desc))
        ORDER BY uls DESC
      `;

      // Ejecutar todas las queries en paralelo
      const [ulsResult, cajasResult, tiempoRecepcionResult, tiempoCamionResult, seccionResult] = await Promise.all([
        connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .input('proveedor', sql.NVarChar, proveedor ? `%${proveedor}%` : '')
          .input('sku', sql.NVarChar, sku ? `%${sku}%` : '')
          .query(ulsPorDiaQuery),
        
        connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .input('proveedor', sql.NVarChar, proveedor ? `%${proveedor}%` : '')
          .input('sku', sql.NVarChar, sku ? `%${sku}%` : '')
          .query(cajasPorDiaQuery),
        
        connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .input('proveedor', sql.NVarChar, proveedor ? `%${proveedor}%` : '')
          .input('sku', sql.NVarChar, sku ? `%${sku}%` : '')
          .query(tiempoRecepcionPorDiaQuery),
        
        connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .input('proveedor', sql.NVarChar, proveedor ? `%${proveedor}%` : '')
          .input('sku', sql.NVarChar, sku ? `%${sku}%` : '')
          .query(tiempoCamionPorDiaQuery),
        
        connection.request()
          .input('from_date', sql.Date, from_date)
          .input('to_date', sql.Date, to_date)
          .input('proveedor', sql.NVarChar, proveedor ? `%${proveedor}%` : '')
          .input('sku', sql.NVarChar, sku ? `%${sku}%` : '')
          .query(recepcionesPorSeccionQuery)
      ]);

      console.log('Queries ejecutadas:', {
        uls: ulsResult.recordset.length,
        cajas: cajasResult.recordset.length,
        tiempoRecepcion: tiempoRecepcionResult.recordset.length,
        tiempoCamion: tiempoCamionResult.recordset.length,
        seccion: seccionResult.recordset.length
      });

      // Formatear datos para el frontend
      const ulsPorDia = ulsResult.recordset.map((row: any) => ({
        fecha: row.fecha,
        dia: row.dia,
        uls: parseFloat(row.uls || 0)
      }));

      const cajasPorDia = cajasResult.recordset.map((row: any) => ({
        fecha: row.fecha,
        dia: row.dia,
        cajas: parseFloat(row.cajas || 0)
      }));

      const tiempoRecepcionPorDia = tiempoRecepcionResult.recordset.map((row: any) => ({
        fecha: row.fecha,
        dia: row.dia,
        tiempo_promedio_horas: parseFloat(row.tiempo_promedio_horas || 0)
      }));

      const tiempoCamionPorDia = tiempoCamionResult.recordset.map((row: any) => ({
        fecha: row.fecha,
        dia: row.dia,
        tiempo_promedio_horas: parseFloat(row.tiempo_promedio_horas || 0)
      }));

      const recepcionesPorSeccion = seccionResult.recordset.map((row: any) => ({
        sector: row.sector || 'Sin Sector',
        uls: parseFloat(row.uls || 0),
        porcentaje: 0 // Se calculará después
      }));

      // Calcular porcentajes para el gráfico de torta
      const totalUls = recepcionesPorSeccion.reduce((sum, item) => sum + item.uls, 0);
      recepcionesPorSeccion.forEach(item => {
        item.porcentaje = totalUls > 0 ? (item.uls / totalUls) * 100 : 0;
      });

      // Calcular totales para KPIs
      const totalUlsPeriodo = ulsPorDia.reduce((sum, item) => sum + item.uls, 0);
      const totalCajasPeriodo = cajasPorDia.reduce((sum, item) => sum + item.cajas, 0);
      const totalDiasConRecepcion = ulsPorDia.length;
      const tiempoPromedioRecepcion = tiempoRecepcionPorDia.length > 0 
        ? tiempoRecepcionPorDia.reduce((sum, item) => sum + item.tiempo_promedio_horas, 0) / tiempoRecepcionPorDia.length 
        : 0;

      const response = {
        databaseName: 'MACROMERCADO',
        fechaInicio: from_date,
        fechaFin: to_date,
        filtros: {
          proveedor: proveedor || 'Todos',
          sku: sku || 'Todos'
        },
        // Datos para gráficos
        ulsPorDia,
        cajasPorDia,
        tiempoRecepcionPorDia,
        tiempoCamionPorDia,
        recepcionesPorSeccion,
        // KPIs
        kpis: {
          totalUls: totalUlsPeriodo,
          totalCajas: totalCajasPeriodo,
          totalDias: totalDiasConRecepcion,
          tiempoPromedioRecepcion: tiempoPromedioRecepcion,
          totalSecciones: recepcionesPorSeccion.length
        },
        generatedAt: new Date().toISOString()
      };

      console.log('Response prepared:', {
        totalUls: response.kpis.totalUls,
        totalCajas: response.kpis.totalCajas,
        totalDias: response.kpis.totalDias,
        tiempoPromedio: response.kpis.tiempoPromedioRecepcion,
        totalSecciones: response.kpis.totalSecciones
      });

      return reply.send(response);

    } catch (error) {
      console.error('Error en recepciones route:', error);
      return reply.status(500).send({
        error: {
          message: 'Error interno del servidor',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });
}
