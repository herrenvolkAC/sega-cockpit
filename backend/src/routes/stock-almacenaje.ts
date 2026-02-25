import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { query, getPool } from "../db";
import { ErrorResponse } from "../types";

interface StockAlmacenajeQuerystring {
  sku?: string;
  proveedor?: string;
}

const cache = new MemoryCache<any>(config.cacheTtlSeconds);

const errorResponse = (code: string, message: string): ErrorResponse => ({
  ok: false,
  error: { code, message },
});

const extractDatabaseName = (connectionString: string): string => {
  try {
    const match = connectionString.match(/Database=([^;]+)/i);
    return match ? match[1] : "Unknown";
  } catch {
    return "Unknown";
  }
};

// Helper para ejecutar queries con medición de tiempo
const executeWithTiming = async (pool: any, query: string, inputs: any[] = [], queryName: string) => {
  const startTime = Date.now();
  try {
    const request = pool.request();
    inputs.forEach(input => {
      request.input(input.name, input.type, input.value);
    });
    
    const result = await request.query(query);
    const duration = Date.now() - startTime;
    
    console.log(`[Query] ${queryName}: ${duration}ms, ${result.recordset.length} filas`);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Query ERROR] ${queryName}: ${duration}ms, Error: ${error}`);
    throw error;
  }
};

export const stockAlmacenajeRoute = async (app: FastifyInstance): Promise<void> => {
  app.get(
    "/stock-almacenaje",
    async (request, reply) => {
      const startedAt = Date.now();
      const query = request.query as any;
      
      // Acceder manualmente a los parámetros
      const sku = query.sku as string;
      const proveedor = query.proveedor as string;
      
      console.log({
        endpoint: "/stock-almacenaje",
        params: { sku, proveedor }
      });

      // Crear cache key basado en los filtros
      const cacheKey = `stock-almacenaje_${sku || 'all'}_${proveedor || 'all'}`;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        request.log.info({
          endpoint: "/stock-almacenaje",
          durationMs: Date.now() - startedAt,
          cache: "hit",
          sku,
          proveedor,
        });
        return cached;
      }

      try {
        const connection = await getPool();
        
        // Construir filtros dinámicos seguros
        const skuFilter = sku ? "AND SKU = @sku" : "";
        const proveedorFilter = proveedor ? "AND Proveedor = @proveedor" : "";
        const baseFilters = `${skuFilter} ${proveedorFilter}`;
        
        // Inputs para las queries
        const queryInputs = [];
        if (sku) queryInputs.push({ name: "sku", type: sql.VarChar(60), value: sku });
        if (proveedor) queryInputs.push({ name: "proveedor", type: sql.VarChar(200), value: proveedor });

        // 1) FECHA FOTO (header)
        const fechaFotoQuery = `
          SELECT
              snapshot_dt_max = MAX(snapshot_dt),
              fecha_operativa_max = MAX(fecha_operativa)
          FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
          OPTION (RECOMPILE)
        `;
        
        const fechaFotoResult = await executeWithTiming(connection, fechaFotoQuery, queryInputs, "Fecha Foto");

        // 2.1 Stock (Cajas) - suma Unidades_Formato para formatos "caja"
        const stockCajasQuery = `
          SELECT
              Stock_Cajas = SUM(CAST(Unidades_Formato AS bigint))
          FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
            AND Formato IN ('CAJA','CAJAS','CJ','BOX')
          OPTION (RECOMPILE)
        `;
        
        const stockCajasResult = await executeWithTiming(connection, stockCajasQuery, queryInputs, "Stock Cajas");

        // 2.2 Stock (Unidades) - suma Unidades_Formato para formatos "unidad"
        const stockUnidadesQuery = `
          SELECT
              Stock_Unidades = SUM(CAST(Unidades_Formato AS bigint))
          FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
            AND Formato IN ('UNIDAD','UNIDADES','UN','EA')
          OPTION (RECOMPILE)
        `;
        
        const stockUnidadesResult = await executeWithTiming(connection, stockUnidadesQuery, queryInputs, "Stock Unidades");

        // 2.3 Pallets almacenados - distinct etiqueta con EsPallet=1
        const palletsQuery = `
          SELECT
              Pallets = COUNT(DISTINCT Etiqueta)
          FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
            AND EsPallet = 1
          OPTION (RECOMPILE)
        `;
        
        const palletsResult = await executeWithTiming(connection, palletsQuery, queryInputs, "Pallets");

        // 2.4 Contenedores fuera de almacenaje - distinct etiqueta con FueraDeAlmacenaje=1
        const contFueraAlmacenajeQuery = `
          SELECT
              Cont_Fuera_Almacenaje = COUNT(DISTINCT Etiqueta)
          FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
            AND FueraDeAlmacenaje = 1
          OPTION (RECOMPILE)
        `;
        
        const contFueraAlmacenajeResult = await executeWithTiming(connection, contFueraAlmacenajeQuery, queryInputs, "Cont. Fuera Almacenaje");

        // 2.5 Contenedores bloqueados (por contenedor)
        const contBloqueadosQuery = `
          SELECT
              Cont_Bloqueados = COUNT(DISTINCT CASE WHEN Bloqueo_Contenedor = 1 THEN Etiqueta END)
          FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
          OPTION (RECOMPILE)
        `;
        
        const contBloqueadosResult = await executeWithTiming(connection, contBloqueadosQuery, queryInputs, "Cont. Bloqueados");

        // 2.6 Contenedores en ubicación bloqueada
        const contUbicBloqueadaQuery = `
          SELECT
              Cont_Ubic_Bloqueada = COUNT(DISTINCT CASE WHEN Ubicacion_Bloqueada = 1 THEN Etiqueta END)
          FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
          OPTION (RECOMPILE)
        `;
        
        const contUbicBloqueadaResult = await executeWithTiming(connection, contUbicBloqueadaQuery, queryInputs, "Cont. Ubic. Bloqueada");

        // 2.7 Vencidos (contenerizado) - OJO 1900-01-01 = "sin vencimiento"
        const contVencidosQuery = `
          SELECT
              Cont_Vencidos = COUNT(DISTINCT Etiqueta)
          FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
          WHERE 1=1 ${baseFilters}
            AND FechaVencimiento IS NOT NULL
            AND FechaVencimiento <> '19000101'
            AND FechaVencimiento < CAST(GETDATE() AS date)
          OPTION (RECOMPILE)
        `;
        
        const contVencidosResult = await executeWithTiming(connection, contVencidosQuery, queryInputs, "Cont. Vencidos");

        // 3.1 Pallets por Sector (Top 10 + Otros)
        const palletsSectorQuery = `
          ;WITH x AS (
            SELECT
                Sector,
                Pallets = COUNT(DISTINCT Etiqueta)
            FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
            WHERE 1=1 ${baseFilters}
              AND EsPallet = 1
            GROUP BY Sector
          ),
          r AS (
            SELECT *,
                   rn = ROW_NUMBER() OVER (ORDER BY Pallets DESC)
            FROM x
          )
          SELECT
              Sector = CASE WHEN rn <= 10 THEN Sector ELSE 'Otros' END,
              Pallets = SUM(Pallets)
          FROM r
          GROUP BY CASE WHEN rn <= 10 THEN Sector ELSE 'Otros' END
          ORDER BY Pallets DESC
          OPTION (RECOMPILE)
        `;
        
        const palletsSectorResult = await executeWithTiming(connection, palletsSectorQuery, queryInputs, "Pallets por Sector");

        // 3.2 Pallets por Seccion (Top 15 + Otros)
        const palletsSeccionQuery = `
          ;WITH x AS (
            SELECT
                Seccion,
                Pallets = COUNT(DISTINCT Etiqueta)
            FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
            WHERE 1=1 ${baseFilters}
              AND EsPallet = 1
            GROUP BY Seccion
          ),
          r AS (
            SELECT *,
                   rn = ROW_NUMBER() OVER (ORDER BY Pallets DESC)
            FROM x
          )
          SELECT
              Seccion = CASE WHEN rn <= 15 THEN Seccion ELSE 'Otros' END,
              Pallets = SUM(Pallets)
          FROM r
          GROUP BY CASE WHEN rn <= 15 THEN Seccion ELSE 'Otros' END
          ORDER BY Pallets DESC
          OPTION (RECOMPILE)
        `;
        
        const palletsSeccionResult = await executeWithTiming(connection, palletsSeccionQuery, queryInputs, "Pallets por Sección");

        // 3.3 Contenedores por TipoCanal (Top 10 + Otros)
        const contenedoresCanalQuery = `
          ;WITH x AS (
            SELECT
                TipoCanal = COALESCE(TipoCanal, 'Sin canal'),
                Contenedores = COUNT(DISTINCT Etiqueta)
            FROM bi.fact_stock_contenedor_ubic_vigente WITH (NOLOCK)
            WHERE 1=1 ${baseFilters}
            GROUP BY COALESCE(TipoCanal, 'Sin canal')
          ),
          r AS (
            SELECT *,
                   rn = ROW_NUMBER() OVER (ORDER BY Contenedores DESC)
            FROM x
          )
          SELECT
              TipoCanal = CASE WHEN rn <= 10 THEN TipoCanal ELSE 'Otros' END,
              Contenedores = SUM(Contenedores)
          FROM r
          GROUP BY CASE WHEN rn <= 10 THEN TipoCanal ELSE 'Otros' END
          ORDER BY Contenedores DESC
          OPTION (RECOMPILE)
        `;
        
        const contenedoresCanalResult = await executeWithTiming(connection, contenedoresCanalQuery, queryInputs, "Contenedores por Canal");

        // Estructurar respuesta
        const response = {
          databaseName: extractDatabaseName(config.mssqlConnectionString),
          fechaFoto: {
            snapshot_dt: (fechaFotoResult.recordset[0] as any)?.snapshot_dt_max,
            fecha_operativa: (fechaFotoResult.recordset[0] as any)?.fecha_operativa_max
          },
          filtros: {
            sku: sku || null,
            proveedor: proveedor || null
          },
          kpis: {
            stockCajas: (stockCajasResult.recordset[0] as any)?.Stock_Cajas || 0,
            stockUnidades: (stockUnidadesResult.recordset[0] as any)?.Stock_Unidades || 0,
            pallets: (palletsResult.recordset[0] as any)?.Pallets || 0,
            contenedoresFueraAlmacenaje: (contFueraAlmacenajeResult.recordset[0] as any)?.Cont_Fuera_Almacenaje || 0,
            contenedoresBloqueados: (contBloqueadosResult.recordset[0] as any)?.Cont_Bloqueados || 0,
            ubicacionesBloqueadas: (contUbicBloqueadaResult.recordset[0] as any)?.Cont_Ubic_Bloqueada || 0,
            contenedoresVencidos: (contVencidosResult.recordset[0] as any)?.Cont_Vencidos || 0
          },
          graficos: {
            palletsPorSector: palletsSectorResult.recordset,
            palletsPorSeccion: palletsSeccionResult.recordset,
            contenedoresPorCanal: contenedoresCanalResult.recordset
          },
          generatedAt: new Date().toISOString()
        };

        // Cache response (por menos tiempo si hay filtros)
        const cacheTtlValue = (sku || proveedor) ? 60 : config.cacheTtlSeconds; // 1 min si hay filtros, default si no
        
        cache.set(cacheKey, response);

        console.log({
          endpoint: "/stock-almacenaje",
          durationMs: Date.now() - startedAt,
          cache: "miss",
          sku,
          proveedor,
          cacheTtl: cacheTtlValue,
        });

        return response;
      } catch (error) {
        console.error({
          endpoint: "/stock-almacenaje",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
          sku,
          proveedor,
        });

        const errorRes = errorResponse(
          "DATABASE_ERROR",
          "Error al obtener datos de stock y almacenaje"
        );
        return reply.status(500).send(errorRes);
      }
    }
  );
};
