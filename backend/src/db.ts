import sql from "mssql";
import { config } from "./config";

let pool: sql.ConnectionPool | null = null;

const getPool = async (): Promise<sql.ConnectionPool> => {
  if (pool) return pool;
  if (!config.mssqlConnectionString) {
    throw new Error("MSSQL_CONNECTION_STRING is required");
  }
  pool = await sql.connect(config.mssqlConnectionString);
  return pool;
};

export const query = async <T>(
  text: string,
  params: { name: string; type: any; value: string }[]
): Promise<T[]> => {
  const connection = await getPool();
  const request = connection.request();
  for (const param of params) {
    request.input(param.name, param.type, param.value);
  }
  const result = await request.query<T>(text);
  return result.recordset ?? [];
};

export const isMissingViewError = (err: unknown, viewName: string): boolean => {
  if (!err || typeof err !== "object") return false;
  const message = (err as { message?: string }).message ?? "";
  return message.toLowerCase().includes(`invalid object name '${viewName.toLowerCase()}'`);
};
