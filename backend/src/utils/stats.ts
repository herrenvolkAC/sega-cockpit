/**
 * Utilidades estadísticas reutilizables para cálculos de benchmark
 */

export interface BenchmarkStats {
  promedio: number;
  mediana: number;
  p25: number;
  p75: number;
  p10: number;
  p90: number;
  stddev: number;
  cv: number;
}

/**
 * Calcula el promedio (media aritmética) de un array de números
 */
export function mean(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return null;
  
  const sum = validValues.reduce((acc, val) => acc + val, 0);
  return sum / validValues.length;
}

/**
 * Calcula la desviación estándar de un array de números
 */
export function standardDeviation(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return null;
  
  const avg = mean(validValues);
  if (avg === null) return null;
  
  const squareDiffs = validValues.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = mean(squareDiffs) || 0;
  
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calcula el coeficiente de variación (CV = stddev / mean)
 */
export function coefficientOfVariation(values: number[]): number | null {
  const avg = mean(values);
  const stddev = standardDeviation(values);
  
  if (avg === null || stddev === null || avg === 0) return null;
  
  return (stddev / avg) * 100;
}

/**
 * Calcula el percentil especificado de un array de números
 * Usando el método lineal de interpolación (como Excel/Python numpy)
 */
export function percentile(values: number[], p: number): number | null {
  if (!values || values.length === 0) return null;
  
  const validValues = values
    .filter(v => v !== null && v !== undefined && !isNaN(v))
    .sort((a, b) => a - b);
  
  if (validValues.length === 0) return null;
  
  if (p <= 0) return validValues[0];
  if (p >= 100) return validValues[validValues.length - 1];
  
  const index = (p / 100) * (validValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (lower === upper) {
    return validValues[lower];
  }
  
  const weight = index - lower;
  return validValues[lower] * (1 - weight) + validValues[upper] * weight;
}

/**
 * Calcula estadísticas completas de benchmark para un array de valores
 */
export function calculateBenchmark(values: number[]): BenchmarkStats | null {
  if (!values || values.length === 0) return null;
  
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return null;
  
  const avg = mean(validValues) || 0;
  const stddev = standardDeviation(validValues) || 0;
  
  return {
    promedio: avg,
    mediana: percentile(validValues, 50) || 0,
    p25: percentile(validValues, 25) || 0,
    p75: percentile(validValues, 75) || 0,
    p10: percentile(validValues, 10) || 0,
    p90: percentile(validValues, 90) || 0,
    stddev: stddev,
    cv: avg > 0 ? (stddev / avg) * 100 : 0
  };
}

/**
 * Calcula el percentil de un valor dentro de un array de referencia
 */
export function calculateValuePercentile(value: number, referenceValues: number[]): number | null {
  if (!referenceValues || referenceValues.length === 0) return null;
  
  const validValues = referenceValues
    .filter(v => v !== null && v !== undefined && !isNaN(v))
    .sort((a, b) => a - b);
  
  if (validValues.length === 0) return null;
  
  if (value <= validValues[0]) return 0;
  if (value >= validValues[validValues.length - 1]) return 100;
  
  let count = 0;
  for (const val of validValues) {
    if (val < value) count++;
    else break;
  }
  
  return (count / validValues.length) * 100;
}

/**
 * Clasifica un percentil en grupos
 */
export function classifyPercentile(percentile: number): string {
  if (percentile >= 80) return "Top 20%";
  if (percentile >= 60) return "Rango Medio Alto";
  if (percentile >= 40) return "Rango Medio";
  if (percentile >= 20) return "Rango Medio Bajo";
  return "Bottom 20%";
}

/**
 * Clasifica estabilidad según coeficiente de variación
 */
export function classifyStability(cv: number): string {
  if (cv < 15) return "Estabilidad Alta";
  if (cv < 30) return "Estabilidad Media";
  return "Estabilidad Baja";
}
