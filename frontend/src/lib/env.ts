const toNumber = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  refreshSeconds: toNumber(process.env.NEXT_PUBLIC_REFRESH_SECONDS, 30),
  lagWarnMinutes: toNumber(process.env.NEXT_PUBLIC_LAG_WARN_MINUTES, 5),
  fetchTimeoutMs: toNumber(process.env.NEXT_PUBLIC_FETCH_TIMEOUT_MS, 4000),
};

export const getBackendBaseUrl = (): string => {
  const v = process.env.BACKEND_BASE_URL;
  if (!v) {
    throw new Error("BACKEND_BASE_URL is required (server-only)");
  }
  return v;
};
