/**
 * Devuelve la fecha tal como viene de la base de datos (sin conversión de zona horaria)
 */
export function normalizeDatabaseDate(dateValue: any): string {
  if (!dateValue) {
    return new Date().toISOString();
  }
  
  // Devolver la fecha tal como viene, el frontend se encargará de la conversión
  return new Date(dateValue).toISOString();
}
