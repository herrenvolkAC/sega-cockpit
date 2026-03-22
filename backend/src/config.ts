import dotenv from "dotenv";

dotenv.config();

const parseIntOr = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseSectors = (value: string | undefined): string[] | null => {
  if (!value) return null;
  const sectors = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sectors.length > 0 ? sectors : null;
};

const REQUIRED_ENV_VARS = ["MSSQL_CONNECTION_STRING"] as const;

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(
      `Missing required environment variable: ${key}. Check your .env file.`
    );
  }
}

export const config = {
  port: parseIntOr(process.env.PORT, 3001),
  mssqlConnectionString: process.env.MSSQL_CONNECTION_STRING as string,
  dbRequestTimeoutMs: parseIntOr(process.env.DB_REQUEST_TIMEOUT_MS, 5000),
  cacheTtlSeconds: parseIntOr(process.env.CACHE_TTL_SECONDS, 60),
  sectors: parseSectors(process.env.SECTORS),
  timezone: process.env.TIMEZONE ?? "America/Argentina/Buenos_Aires",
};

export const validateSector = (sector: string | undefined): string | null => {
  if (!sector || sector.trim().length === 0) return null;
  return sector.trim();
};
