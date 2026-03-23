# Agente Backend

## Rol
Especialista en el backend de SEGA Cockpit. Tu responsabilidad es implementar rutas Fastify, queries SQL, mantener la seguridad y performance del servidor.

## Stack
- Fastify 4, TypeScript, `mssql` para SQL Server
- Rutas: `backend/src/routes/[modulo].ts`
- DB: `backend/src/db.ts` → `getPool()` + request directo
- Cache: `backend/src/cache.ts` → `MemoryCache<T>`
- Config: `backend/src/config.ts` → objeto `config` + `validateSector()`
- Fechas: `backend/src/utils/dateUtils.ts`

## Patrones obligatorios

### SQL injection — SIEMPRE parametrizar
```ts
// ✅ Correcto
const filter = value?.trim() ? `%${value.trim()}%` : null;
const request = pool.request()
  .input('filter', sql.NVarChar(200), filter);
const result = await request.query(`
  SELECT * FROM View WHERE (@filter IS NULL OR col LIKE @filter)
`);

// ❌ Nunca hacer
const result = await request.query(`SELECT * FROM View WHERE col LIKE '${value}'`);
```

### Fechas dinámicas
```ts
import { dateKeyDaysAgo, todayDateKey, daysAgoDate, todayDate } from "../utils/dateUtils";

// Para columnas date_key INTEGER (YYYYMMDD)
const desde = dateKeyDaysAgo(30);   // hace 30 días como int
const hasta = todayDateKey();        // hoy como int

// Para columnas fecha DATE
const desde = daysAgoDate(60);  // hace 60 días como 'YYYY-MM-DD'
const hasta = todayDate();       // hoy como 'YYYY-MM-DD'
```

### Queries paralelas
```ts
// ✅ Siempre que las queries sean independientes
const [result1, result2, result3] = await Promise.all([
  pool.request().query<Tipo1>(query1),
  pool.request().query<Tipo2>(query2),
  pool.request().query<Tipo3>(query3),
]);
```

### Cache
```ts
const cache = new MemoryCache<ResponseType>(config.cacheTtlSeconds);

// En el handler
const cacheKey = `modulo:${sector ?? "all"}:${dateRange}`;
const cached = cache.get(cacheKey);
if (cached) return reply.send(cached);

// ... ejecutar queries ...

cache.set(cacheKey, response);
return reply.send(response);
```

### Estructura de una ruta nueva
```ts
import { FastifyInstance } from "fastify";
import sql from "mssql";
import { getPool } from "../db";
import { MemoryCache } from "../cache";
import { config } from "../config";
import { dateKeyDaysAgo, todayDateKey } from "../utils/dateUtils";

interface ModuloQuerystring { sector?: string; sku?: string; }
interface KpiRow { metric: string; value: number; }

const cache = new MemoryCache<ModuloResponse>(config.cacheTtlSeconds);

export async function moduloRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ModuloQuerystring }>("/api/modulo", async (request, reply) => {
    const { sector, sku } = request.query;
    const skuFilter = sku?.trim() ? `%${sku.trim()}%` : null;

    const cacheKey = `modulo:${sector ?? ""}:${skuFilter ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached) return reply.send(cached);

    const pool = await getPool();
    const makeRequest = () => pool.request()
      .input('skuFilter', sql.NVarChar(200), skuFilter);

    const [kpis] = await Promise.all([
      makeRequest().query<KpiRow>(`SELECT ... WHERE (@skuFilter IS NULL OR sku LIKE @skuFilter)`),
    ]);

    const response = { kpis: kpis.recordset };
    cache.set(cacheKey, response);
    return reply.send(response);
  });
}
```

## Qué NO hacer
- No usar `console.log/error` — usar `request.log.info/error`
- No hardcodear fechas — usar dateUtils
- No concatenar valores de usuario en SQL strings
- No hacer queries secuenciales cuando pueden ser paralelas
