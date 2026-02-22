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
      const { getPool } = await import('../db');
      const connection = await getPool();

      // Query para obtener unidades recibidas por día
      const recepcionesPorDiaQuery = `
        SELECT 
          CONVERT(varchar, fecha_operativa, 103) as fecha,
          FORMAT(fecha_operativa, 'dd/MM') as dia,
          SUM(COALESCE(cantidad_unidades, 0)) as unidades
        FROM bi.fact_recepcion_sku
        WHERE fecha_operativa >= @from_date
          AND fecha_operativa <= @to_date
          ${proveedor && proveedor.trim() ? "AND UPPER(LTRIM(RTRIM(proveedor))) LIKE UPPER(@proveedor)" : ""}
          ${sku && sku.trim() ? "AND UPPER(LTRIM(RTRIM(sku))) LIKE UPPER(@sku)" : ""}
        GROUP BY fecha_operativa, FORMAT(fecha_operativa, 'dd/MM'), CONVERT(varchar, fecha_operativa, 103)
        ORDER BY fecha_operativa
      `;

      const result = await connection.request()
        .input('from_date', sql.Date, from_date)
        .input('to_date', sql.Date, to_date)
        .input('proveedor', sql.NVarChar, proveedor ? `%${proveedor}%` : '')
        .input('sku', sql.NVarChar, sku ? `%${sku}%` : '')
        .query(recepcionesPorDiaQuery);

      console.log('Query ejecutada, resultados:', result.recordset.length, 'filas');

      // Formatear datos para el frontend
      const recepcionesPorDia = result.recordset.map((row: any) => ({
        fecha: row.fecha,
        dia: row.dia,
        unidades: parseFloat(row.unidades || 0)
      }));

      const response = {
        databaseName: 'MACROMERCADO',
        fechaInicio: from_date,
        fechaFin: to_date,
        filtros: {
          proveedor: proveedor || 'Todos',
          sku: sku || 'Todos'
        },
        recepcionesPorDia,
        totalUnidades: recepcionesPorDia.reduce((sum, item) => sum + item.unidades, 0),
        totalDias: recepcionesPorDia.length,
        promedioDiario: recepcionesPorDia.length > 0 
          ? recepcionesPorDia.reduce((sum, item) => sum + item.unidades, 0) / recepcionesPorDia.length 
          : 0,
        generatedAt: new Date().toISOString()
      };

      console.log('Response prepared:', {
        totalUnidades: response.totalUnidades,
        totalDias: response.totalDias,
        promedioDiario: response.promedioDiario
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
