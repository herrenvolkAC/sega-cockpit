import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const sku = searchParams.get('sku');

  try {
    // Construir URL del backend con parámetros
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const params = new URLSearchParams();
    
    if (sku && sku.trim()) {
      params.append('sku', sku.trim());
    }
    
    
    const response = await fetch(`${backendUrl}/stock?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          ok: false, 
          error: { 
            code: "BACKEND_ERROR", 
            message: `Error del backend: ${response.status}`,
            details: errorText 
          }
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      ok: true,
      data: data
    });

  } catch (error) {
    return NextResponse.json(
      { 
        ok: false, 
        error: { 
          code: "INTERNAL_ERROR", 
          message: "Error interno del servidor",
          details: error instanceof Error ? error.message : String(error)
        }
      },
      { status: 500 }
    );
  }
}
