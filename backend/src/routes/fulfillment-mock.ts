import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { ErrorResponse } from "../types";

const cache = new MemoryCache<any>(config.cacheTtlSeconds);

const errorResponse = (code: string, message: string): ErrorResponse => ({
  ok: false,
  error: { code, message },
});

// Mock data generator
const generateMockData = (fechaInicio?: string, fechaFin?: string) => {
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  
  return {
    databaseName: "SEGA_MZA (Mock)",
    fechaInicio: fechaInicio || null,
    fechaFin: fechaFin || null,
    totalPedidos: Math.floor(Math.random() * 1000) + 500,
    totalSolicitado: Math.floor(Math.random() * 10000) + 5000,
    totalFaltantes: Math.floor(Math.random() * 500) + 100,
    tasaSatisfaccion: 95 - Math.random() * 10, // 85-95%
    
    // Datos para gráfico de líneas - Pedidos y faltantes por día
    pedidosPorDia: dias.map((dia) => ({
      dia,
      pedidos: Math.floor(Math.random() * 150) + 50,
      faltantes: Math.floor(Math.random() * 30) + 5,
    })),
    
    // Datos para gráfico de pie - Estado de fulfillment
    estadoFulfillment: [
      { name: "Completo", value: Math.floor(Math.random() * 400) + 300, color: "#10b981" },
      { name: "Parcial", value: Math.floor(Math.random() * 100) + 50, color: "#f59e0b" },
      { name: "Con Faltantes", value: Math.floor(Math.random() * 80) + 20, color: "#ef4444" },
    ],
    
    // Datos para gráfico de barras - Productos con más shortage
    productosConShortage: [
      { categoria: "Hamburguesas", monto: Math.floor(Math.random() * 500) + 100, cantidad: Math.floor(Math.random() * 50) + 10 },
      { categoria: "Bebidas", monto: Math.floor(Math.random() * 300) + 80, cantidad: Math.floor(Math.random() * 40) + 8 },
      { categoria: "Postres", monto: Math.floor(Math.random() * 200) + 60, cantidad: Math.floor(Math.random() * 30) + 6 },
      { categoria: "Snacks", monto: Math.floor(Math.random() * 150) + 40, cantidad: Math.floor(Math.random() * 25) + 5 },
      { categoria: "Otros", monto: Math.floor(Math.random() * 100) + 20, cantidad: Math.floor(Math.random() * 20) + 4 },
    ],
    
    productosTop: [
      { 
        nombre: "Hamburguesa Clásica", 
        cantidad_solicitada: Math.floor(Math.random() * 200) + 100, 
        cantidad_faltante: Math.floor(Math.random() * 30) + 5,
        porcentaje_faltante: Math.random() * 15 + 5
      },
      { 
        nombre: "Pizza Margarita", 
        cantidad_solicitada: Math.floor(Math.random() * 150) + 80, 
        cantidad_faltante: Math.floor(Math.random() * 25) + 3,
        porcentaje_faltante: Math.random() * 12 + 3
      },
      { 
        nombre: "Ensalada César", 
        cantidad_solicitada: Math.floor(Math.random() * 100) + 50, 
        cantidad_faltante: Math.floor(Math.random() * 20) + 2,
        porcentaje_faltante: Math.random() * 10 + 2
      },
      { 
        nombre: "Lomo Completo", 
        cantidad_solicitada: Math.floor(Math.random() * 120) + 60, 
        cantidad_faltante: Math.floor(Math.random() * 22) + 4,
        porcentaje_faltante: Math.random() * 13 + 4
      },
      { 
        nombre: "Papas Fritas", 
        cantidad_solicitada: Math.floor(Math.random() * 180) + 90, 
        cantidad_faltante: Math.floor(Math.random() * 28) + 6,
        porcentaje_faltante: Math.random() * 14 + 6
      },
    ].sort((a, b) => b.porcentaje_faltante - a.porcentaje_faltante),
    
    pedidosRecientes: [
      {
        id: `#${Math.floor(Math.random() * 9000) + 1000}`,
        cliente: ["Centro A", "Centro B", "Centro C", "Centro D", "Centro E"][Math.floor(Math.random() * 5)],
        monto_faltante: Math.floor(Math.random() * 100) + 10,
        estado: ["completado", "parcial", "con_faltantes"][Math.floor(Math.random() * 3)],
        fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleString(),
      },
      {
        id: `#${Math.floor(Math.random() * 9000) + 1000}`,
        cliente: ["Distribuidor X", "Distribuidor Y", "Distribuidor Z", "Sucursal 1", "Sucursal 2"][Math.floor(Math.random() * 5)],
        monto_faltante: Math.floor(Math.random() * 80) + 5,
        estado: ["completado", "parcial", "con_faltantes"][Math.floor(Math.random() * 3)],
        fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleString(),
      },
      {
        id: `#${Math.floor(Math.random() * 9000) + 1000}`,
        cliente: ["Tienda 1", "Tienda 2", "Tienda 3", "Tienda 4", "Tienda 5"][Math.floor(Math.random() * 5)],
        monto_faltante: Math.floor(Math.random() * 120) + 15,
        estado: ["completado", "parcial", "con_faltantes"][Math.floor(Math.random() * 3)],
        fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleString(),
      },
      {
        id: `#${Math.floor(Math.random() * 9000) + 1000}`,
        cliente: ["Local A", "Local B", "Local C", "Local D", "Local E"][Math.floor(Math.random() * 5)],
        monto_faltante: Math.floor(Math.random() * 90) + 8,
        estado: ["completado", "parcial", "con_faltantes"][Math.floor(Math.random() * 3)],
        fecha: new Date(Date.now() - Math.random() * 86400000).toLocaleString(),
      },
    ],
    generatedAt: new Date().toISOString(),
  };
};

export const fulfillmentMockRoute = async (app: FastifyInstance): Promise<void> => {
  app.get(
    "/fulfillment",
    async (
      request: FastifyRequest<{
        Querystring: {
          fechaInicio?: string;
          fechaFin?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const startedAt = Date.now();
      const { fechaInicio, fechaFin } = request.query;
      
      // Crear cache key basado en las fechas
      const cacheKey = `fulfillment_mock_${fechaInicio || 'default'}_${fechaFin || 'default'}`;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        request.log.info({
          endpoint: "/fulfillment",
          durationMs: Date.now() - startedAt,
          cache: "hit",
          fechaInicio,
          fechaFin,
        });
        return cached;
      }

      try {
        // Simular delay de base de datos
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generar datos mock
        const response = generateMockData(fechaInicio, fechaFin);

        // Cache response
        const cacheTtl = fechaInicio && fechaFin ? 60 : config.cacheTtlSeconds;
        cache.set(cacheKey, response);

        request.log.info({
          endpoint: "/fulfillment",
          durationMs: Date.now() - startedAt,
          cache: "miss",
          fechaInicio,
          fechaFin,
          cacheTtl,
        });

        return response;
      } catch (error) {
        request.log.error({
          endpoint: "/fulfillment",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
          fechaInicio,
          fechaFin,
        });

        const errorRes = errorResponse(
          "DATABASE_ERROR",
          "Error al obtener datos de fulfillment"
        );
        return reply.status(500).send(errorRes);
      }
    }
  );
};
