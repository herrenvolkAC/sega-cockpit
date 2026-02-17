import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config, validateSector } from "../config";
import { query, isMissingViewError } from "../db";
import { ErrorResponse, StatusResponse } from "../types";
import { normalizeDatabaseDate } from "../utils/dateUtils";

type StatusQuery = {
  sector?: string;
};

const extractDatabaseName = (connectionString: string): string => {
  try {
    // Extraer Database= de la connection string
    const match = connectionString.match(/Database=([^;]+)/i);
    return match ? match[1] : "Unknown";
  } catch {
    return "Unknown";
  }
};

const cache = new MemoryCache<StatusResponse>(config.cacheTtlSeconds);

const errorResponse = (code: string, message: string): ErrorResponse => ({
  ok: false,
  error: { code, message },
});

const parseJson = <T>(value: unknown): T | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
};

const normalizeGeneratedAt = (row: Record<string, unknown>): string =>
  (row.generatedAt as string) ||
  (row.generated_at as string) ||
  new Date().toISOString();

const normalizeReplicationLag = (row: Record<string, unknown>): number | null => {
  const value =
    (row.replicationLagMinutes as number | null | undefined) ??
    (row.replication_lag_minutes as number | null | undefined);
  return value ?? null;
};

const buildMock = (sector: string): StatusResponse => ({
  sector,
  generatedAt: new Date().toISOString(),
  replicationLagMinutes: null,
  databaseName: extractDatabaseName(config.mssqlConnectionString),
  kpis: [
    {
      key: "mock_1",
      label: "KPI de Prueba 1",
      value: "123",
      unit: "u",
      status: "green",
    },
    {
      key: "mock_2",
      label: "KPI de Prueba 2",
      value: "456",
      unit: "$",
      status: "amber",
    },
    {
      key: "mock_3",
      label: "KPI de Prueba 3",
      value: "789",
      unit: "%",
      status: "red",
    },
  ],
  notes: [
    "Datos simulados para validación visual.",
    "La vista v_monitor_kpis no existe o no retornó datos.",
  ],
});

export const statusRoute = async (app: FastifyInstance): Promise<void> => {
  app.get(
    "/status",
    async (
      request: FastifyRequest<{ Querystring: StatusQuery }>,
      reply: FastifyReply
    ) => {
      const startedAt = Date.now();
      const sector = validateSector(request.query.sector);

      if (!sector) {
        const res = errorResponse("MISSING_SECTOR", "Query string 'sector' is required.");
        request.log.info({
          endpoint: "/status",
          sector: request.query.sector ?? null,
          durationMs: Date.now() - startedAt,
          error: res.error.code,
        });
        return reply.status(400).send(res);
      }

      if (config.sectors && !config.sectors.includes(sector)) {
        const res = errorResponse("INVALID_SECTOR", "Sector is not in the allowed list.");
        request.log.info({
          endpoint: "/status",
          sector,
          durationMs: Date.now() - startedAt,
          error: res.error.code,
        });
        return reply.status(400).send(res);
      }

      const cacheKey = `status:${sector}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        request.log.info({
          endpoint: "/status",
          sector,
          durationMs: Date.now() - startedAt,
          cache: "hit",
        });
        return cached;
      }

      try {
        const rows = await query<Record<string, unknown>>(
          "SELECT * FROM v_monitor_kpis WHERE sector = @sector ORDER BY kpi_order",
          [{ name: "sector", type: sql.VarChar, value: sector }]
        );

        if (!rows || rows.length === 0) {
          const res = errorResponse("NOT_FOUND", "No status data for sector.");
          request.log.info({
            endpoint: "/status",
            sector,
            durationMs: Date.now() - startedAt,
            error: res.error.code,
          });
          return reply.status(404).send(res);
        }

        // Transform the rows into KPI format
        const kpis = rows.map(row => ({
          key: String(row.kpi_key),
          label: String(row.kpi_label),
          value: row.kpi_value as string | number | null,
          unit: row.kpi_unit ? String(row.kpi_unit) : undefined,
          status: (row.kpi_status as "red" | "amber" | "green") || 'green'
        }));

        const response: StatusResponse = {
          sector,
          generatedAt: new Date().toISOString(), // Usar hora actual del servidor
          replicationLagMinutes: null, // You can add this logic if needed
          databaseName: extractDatabaseName(config.mssqlConnectionString),
          kpis,
        };

        cache.set(cacheKey, response);
        request.log.info({
          endpoint: "/status",
          sector,
          durationMs: Date.now() - startedAt,
        });
        return response;
      } catch (err) {
        console.error("Database error details:", err);
        
        if (isMissingViewError(err, "v_monitor_kpis")) {
          console.log("View v_monitor_kpis not found, returning mock data");
          const response = buildMock(sector);
          cache.set(cacheKey, response);
          request.log.warn({
            endpoint: "/status",
            sector,
            durationMs: Date.now() - startedAt,
            error: "MOCK_DATA",
          });
          return response;
        }
        
        request.log.error({
          endpoint: "/status",
          sector,
          durationMs: Date.now() - startedAt,
          error: (err as Error).message,
          stack: (err as Error).stack,
        });
        return reply.status(500).send(errorResponse("DB_ERROR", "Database error."));
      }
    }
  );
};
