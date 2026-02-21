import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const operacion = searchParams.get('operacion');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  
  // Validar parámetros
  if (!operacion || !['PICKING', 'CROSSDOCKING', 'EXTRACCION', 'REPOSICION', 'ALMACENAJE', 'RECEPCION'].includes(operacion.toUpperCase())) {
    return NextResponse.json(
      { 
        ok: false, 
        error: { code: "INVALID_OPERATION", message: "Operación no válida. Debe ser: PICKING, CROSSDOCKING, EXTRACCION, REPOSICION, ALMACENAJE o RECEPCION" }
      },
      { status: 400 }
    );
  }
  
  if (!fromDate || !toDate) {
    return NextResponse.json(
      { 
        ok: false, 
        error: { code: "INVALID_DATES", message: "Se requieren fechas fromDate y toDate" }
      },
      { status: 400 }
    );
  }
  
  try {
    // Construir URL del backend
    const params = new URLSearchParams();
    params.append('operacion', operacion);
    params.append('fromDate', fromDate);
    params.append('toDate', toDate);
    
    const backendUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/productividad?${params}`;
    
    console.log('Forwarding to backend:', backendUrl);
    
    const response = await fetch(backendUrl);
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Productivity API error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" }
      },
      { status: 500 }
    );
  }
}
