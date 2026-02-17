import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sql from "mssql";
import { MemoryCache } from "../cache";
import { config, validateSector } from "../config";
import { query, isMissingViewError } from "../db";
import { DetailResponse, ErrorResponse } from "../types";

type DetailQuery = {
  sector?: string;
};

const cache = new MemoryCache<DetailResponse>(config.cacheTtlSeconds);

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

const buildMock = (sector: string): DetailResponse => ({
  sector,
  generatedAt: new Date().toISOString(),
  replicationLagMinutes: null,
  tables: [
    {
      key: "mock",
      title: "MOCK DATA",
      columns: ["info"],
      rows: [["vw_monitor_detail missing"]],
    },
  ],
});

export const detailRoute = async (app: FastifyInstance): Promise<void> => {
  app.get(
    "/detail",
    async (
      request: FastifyRequest<{ Querystring: DetailQuery }>,
      reply: FastifyReply
    ) => {
      const startedAt = Date.now();
      const sector = validateSector(request.query.sector);

      if (!sector) {
        const res = errorResponse("MISSING_SECTOR", "Query string 'sector' is required.");
        request.log.info({
          endpoint: "/detail",
          sector: request.query.sector ?? null,
          durationMs: Date.now() - startedAt,
          error: res.error.code,
        });
        return reply.status(400).send(res);
      }

      if (config.sectors && !config.sectors.includes(sector)) {
        const res = errorResponse("INVALID_SECTOR", "Sector is not in the allowed list.");
        request.log.info({
          endpoint: "/detail",
          sector,
          durationMs: Date.now() - startedAt,
          error: res.error.code,
        });
        return reply.status(400).send(res);
      }

      const cacheKey = `detail:${sector}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        request.log.info({
          endpoint: "/detail",
          sector,
          durationMs: Date.now() - startedAt,
          cache: "hit",
        });
        return cached;
      }

      try {
        const rows = await query<Record<string, unknown>>(
          "SELECT TOP (1) * FROM vw_monitor_detail WHERE sector = @sector",
          [{ name: "sector", type: sql.VarChar, value: sector }]
        );

        if (!rows[0]) {
          const res = errorResponse("NOT_FOUND", "No detail data for sector.");
          request.log.info({
            endpoint: "/detail",
            sector,
            durationMs: Date.now() - startedAt,
            error: res.error.code,
          });
          return reply.status(404).send(res);
        }

        const row = rows[0];
        const tables =
          parseJson<DetailResponse["tables"]>(row.tables ?? row.tables_json) ?? [];

        const response: DetailResponse = {
          sector,
          generatedAt: normalizeGeneratedAt(row),
          replicationLagMinutes: normalizeReplicationLag(row),
          tables,
        };

        cache.set(cacheKey, response);
        request.log.info({
          endpoint: "/detail",
          sector,
          durationMs: Date.now() - startedAt,
        });
        return response;
      } catch (err) {
        if (isMissingViewError(err, "vw_monitor_detail")) {
          const response = buildMock(sector);
          cache.set(cacheKey, response);
          request.log.warn({
            endpoint: "/detail",
            sector,
            durationMs: Date.now() - startedAt,
            error: "MOCK_DATA",
          });
          return response;
        }
        request.log.error({
          endpoint: "/detail",
          sector,
          durationMs: Date.now() - startedAt,
          error: (err as Error).message,
        });
        return reply.status(500).send(errorResponse("DB_ERROR", "Database error."));
      }
    }
  );
};
