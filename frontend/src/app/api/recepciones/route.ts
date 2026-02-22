import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const fechaInicio = searchParams.get('fechaInicio');
  const fechaFin = searchParams.get('fechaFin');
  const proveedor = searchParams.get('proveedor');
  const sku = searchParams.get('sku');
  
  // Validar parámetros requeridos
  if (!fechaInicio || !fechaFin) {
    return NextResponse.json(
      { 
        ok: false, 
        error: { code: "INVALID_DATES", message: "Se requieren fechas fechaInicio y fechaFin" }
      },
      { status: 400 }
    );
  }

  try {
    // Construir URL del backend con parámetros
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const params = new URLSearchParams();
    
    params.append('fechaInicio', fechaInicio);
    params.append('fechaFin', fechaFin);
    
    if (proveedor && proveedor.trim()) {
      params.append('proveedor', proveedor.trim());
    }
    
    if (sku && sku.trim()) {
      params.append('sku', sku.trim());
    }
    
    console.log('Calling backend:', `${backendUrl}/recepciones?${params}`);
    
    const response = await fetch(`${backendUrl}/recepciones?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', response.status, errorText);
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
    console.log('Backend response:', data);
    
    return NextResponse.json({
      ok: true,
      data: data
    });

  } catch (error) {
    console.error('Error in recepciones API:', error);
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
