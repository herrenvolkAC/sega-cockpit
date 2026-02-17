import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get('fechaInicio') as string | null;
    const fechaFin = searchParams.get('fechaFin') as string | null;
    
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Convert YYYY-MM-DD to YYYYMMDD for backend
    const convertToBackendFormat = (dateStr: string | null): string => {
      if (!dateStr) return '';
      return dateStr.replace(/-/g, ''); // Remove dashes: YYYY-MM-DD -> YYYYMMDD
    };
    
    const params = new URLSearchParams();
    if (fechaInicio) {
      params.append('fechaInicio', convertToBackendFormat(fechaInicio));
    }
    if (fechaFin) {
      params.append('fechaFin', convertToBackendFormat(fechaFin));
    }
    
    const response = await fetch(`${backendUrl}/fulfillment?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching for real-time data
    });

    if (!response.ok) {
      console.error('Backend response error:', response.status, response.statusText);
      return NextResponse.json(
        { error: "Failed to fetch fulfillment data" }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
