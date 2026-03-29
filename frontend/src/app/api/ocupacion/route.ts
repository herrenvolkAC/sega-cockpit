import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const fechaInicio = searchParams.get("fechaInicio");
  const fechaFin    = searchParams.get("fechaFin");
  const sector      = searchParams.get("sector");
  const seccion     = searchParams.get("seccion");

  if (!fechaInicio || !fechaFin) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_DATES", message: "Se requieren fechaInicio y fechaFin" },
      },
      { status: 400 }
    );
  }

  try {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";
    const params = new URLSearchParams();
    params.append("fechaInicio", fechaInicio);
    params.append("fechaFin",    fechaFin);
    if (sector?.trim())  params.append("sector",  sector.trim());
    if (seccion?.trim()) params.append("seccion", seccion.trim());

    const response = await fetch(`${backendUrl}/ocupacion?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BACKEND_ERROR",
            message: `Error del backend: ${response.status}`,
            details: errorText,
          },
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Error interno del servidor",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
