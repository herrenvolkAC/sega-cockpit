type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs: number;
};

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions
): Promise<Response> {
  const { timeoutMs, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}
