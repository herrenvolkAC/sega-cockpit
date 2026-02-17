import { NextResponse } from "next/server";
import type { DetailResponse } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { env, getBackendBaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

const getSector = (req: Request): string | null => {
  const { searchParams } = new URL(req.url);
  const sector = (searchParams.get("sector") ?? "").trim();
  return sector.length > 0 ? sector : null;
};

export async function GET(req: Request) {
  const sector = getSector(req);
  if (!sector) {
    return NextResponse.json({ error: "Missing or invalid 'sector'" }, { status: 400 });
  }

  try {
    const baseUrl = getBackendBaseUrl();
    const url = `${baseUrl}/detail?sector=${encodeURIComponent(sector)}`;

    const res = await fetchWithTimeout(url, {
      timeoutMs: env.fetchTimeoutMs,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream error", upstreamStatus: res.status },
        { status: 502 }
      );
    }

    const data = (await res.json()) as DetailResponse;
    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Upstream timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
