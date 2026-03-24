"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { clientName } from "@/lib/env";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type SlottingRow = {
  sku: string;
  articulo: string;
  tipologia_actual_observada: string;
  grupo_tipologia_actual: string;
  sugerencia: string;
  grupo_tipologia_objetivo: string | null;
  lineas_picking: number;
  unidades_pickeadas: number;
  avg_qty_por_linea: number;
  porc_lineas_unitarias: number;
  porc_lineas_multiplo_caja: number;
  porc_lineas_multiplo_pallet: number;
  lineas_por_1000_unidades: number;
  dias_con_actividad: number;
  ubicaciones_distintas: number;
  porc_unidades_desde_ubic_asignada: number;
  score_hacia_rack_pallet: number;
  score_hacia_balda: number;
  prioridad: number;
  lineas_potencialmente_evitables: number | null;
};

type SlottingData = {
  ok: boolean;
  kpis: {
    totalEvaluados: number;
    conSugerencia: number;
    rackToBalda: number;
    baldaToRack: number;
    aRevisar: number;
    lineasEvitables: number;
  };
  top10: Array<{
    sku: string;
    articulo: string;
    lineas_evitables: number;
    sugerencia: string;
    grupo_tipologia_objetivo: string | null;
  }>;
  detalle: SlottingRow[];
  metadata: {
    ventana_desde: string;
    ventana_hasta: string;
    loaded_at: string;
  } | null;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
type SortKey = keyof SlottingRow;
type SortDir = "asc" | "desc";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

const fmtDec = (n: number, decimals = 1) => n.toFixed(decimals);

const sugerenciaColor = (s: string) => {
  if (s.startsWith("SUGERIR: RACK/PALLET -> BALDA"))
    return { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", dot: "bg-orange-500" };
  if (s.startsWith("SUGERIR: BALDA -> RACK/PALLET"))
    return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", dot: "bg-blue-500" };
  if (s.startsWith("REVISAR"))
    return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", dot: "bg-yellow-500" };
  return { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" };
};

const exportCSV = (rows: SlottingRow[]) => {
  const headers = [
    "SKU", "Artículo", "Tipología Actual", "Grupo Actual", "Sugerencia",
    "Grupo Objetivo", "Líneas Picking", "Unidades Pickeadas", "Prom U/Línea",
    "% Líneas Unitarias", "% Múltiplo Caja", "% Múltiplo Pallet",
    "Líneas/1000u", "Días Activos", "Ubic. Distintas",
    "% Ubic Asignada", "Score→Rack", "Score→Balda", "Prioridad",
    "Líneas Evitables",
  ];
  const escape = (v: any) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.sku, r.articulo, r.tipologia_actual_observada, r.grupo_tipologia_actual,
        r.sugerencia, r.grupo_tipologia_objetivo ?? "",
        r.lineas_picking, r.unidades_pickeadas, r.avg_qty_por_linea,
        (r.porc_lineas_unitarias * 100).toFixed(1),
        (r.porc_lineas_multiplo_caja * 100).toFixed(1),
        (r.porc_lineas_multiplo_pallet * 100).toFixed(1),
        r.lineas_por_1000_unidades, r.dias_con_actividad, r.ubicaciones_distintas,
        (r.porc_unidades_desde_ubic_asignada * 100).toFixed(1),
        r.score_hacia_rack_pallet, r.score_hacia_balda, r.prioridad,
        r.lineas_potencialmente_evitables ?? "",
      ]
        .map(escape)
        .join(",")
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `slotting_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────
// Metodología (tab estático, sin datos)
// ─────────────────────────────────────────────
function MetodologiaTab() {
  return (
    <div className="max-w-4xl space-y-10 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

      {/* 1. Qué mide */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">¿Qué mide este tablero?</h2>
        <p>
          El tablero de <strong>Optimización de Slotting</strong> detecta productos cuyo <em>tipo de ubicación de almacenamiento</em> no
          coincide con la forma en que realmente se los pickea. El objetivo es identificar oportunidades para mover productos
          entre tipologías (BALDA ↔ RACK/PALLET) de manera que se reduzca el número de líneas de picking necesarias para
          satisfacer la misma demanda.
        </p>
        <p className="mt-2">
          Un producto mal posicionado genera más trabajo: un SKU de alta rotación en múltiplos de caja almacenado en balda
          obliga a pickear varias veces lo que podría salir en un solo movimiento desde rack. A la inversa, un SKU unitario
          en rack obliga al operario a moverse a una posición de gran altura o profundidad para buscar pocas unidades.
        </p>
      </section>

      {/* 2. Tipología */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Paso 1 — Determinar la tipología actual</h2>
        <p>
          Para cada SKU se analizan todos los picks del período. La tipología actual se determina por <strong>volumen dominante</strong>:
          el tipo de ubicación desde donde se pickeó la mayor cantidad de unidades gana como "tipología real" del producto.
          Esto refleja la realidad operativa, independientemente de lo que diga el maestro de ubicaciones.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-semibold">Tipo de ubicación</th>
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-semibold">Grupo asignado</th>
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-semibold">¿Se evalúa re-slotting?</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Estantes%, Estantería%, Camara Carn. Estante", "BALDA", "Sí"],
                ["Rack %, Racks %, Salon Rack %", "RACK/PALLET", "Sí"],
                ["Mesa %", "MESA", "No (área especial)"],
                ["Camara %", "CÁMARA", "No (área especial)"],
                ["Serv.%", "SERVICIO", "No (área especial)"],
                ["Salon %", "SALÓN", "No (área especial)"],
              ].map(([tipo, grupo, evalua], i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-gray-50 dark:bg-gray-800"}>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 font-mono text-xs">{tipo}</td>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 font-semibold">{grupo}</td>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2">{evalua}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Solo los productos en BALDA o RACK/PALLET son candidatos a sugerencia. Las áreas especiales (cámara, salón, servicio)
          tienen condiciones operativas propias que no permiten comparación directa.
        </p>
      </section>

      {/* 3. Métricas operativas */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Paso 2 — Calcular métricas operativas por SKU</h2>
        <p>Para cada producto se calculan las siguientes métricas sobre el período analizado:</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-semibold">Métrica</th>
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-semibold">Cómo se calcula</th>
                <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-semibold">Qué indica</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["% Líneas Unitarias", "Líneas donde qty = 1 / total líneas", "Alto → picking muy fraccionado → candidato a BALDA"],
                ["% Múltiplo de Caja", "Líneas donde qty es múltiplo exacto de la caja del SKU / total", "Alto → se mueve en cajas completas → candidato a RACK"],
                ["% Múltiplo de Pallet", "Líneas donde qty es múltiplo exacto del pallet del SKU / total", "Alto → se mueve en pallets → candidato fuerte a RACK"],
                ["Líneas / 1000 unidades", "Total líneas × 1000 / total unidades", "Mide fragmentación: más alto = más líneas por volumen movido"],
                ["Promedio unidades / línea", "Total unidades / total líneas", "Bajo → unitario; alto → masivo"],
                ["Días con actividad", "Días únicos con picks en el período", "Evita sugerencias basadas en picos de un solo día"],
                ["% desde ubicación asignada", "Unidades desde ubicación del maestro / total unidades", "Calidad del dato: si es bajo, el maestro no representa la realidad"],
              ].map(([metrica, calculo, indica], i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-gray-50 dark:bg-gray-800"}>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 font-semibold">{metrica}</td>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 font-mono text-xs">{calculo}</td>
                  <td className="border border-gray-200 dark:border-gray-600 px-3 py-2">{indica}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Scores */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Paso 3 — Calcular los scores</h2>
        <p>
          Se calculan dos scores simultáneos para cada SKU. Cada score acumula evidencias a favor o en contra de cada tipología,
          usando los pesos definidos a continuación:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Score RACK */}
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 font-semibold text-blue-800 dark:text-blue-200">
              Score hacia RACK/PALLET
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-left">Factor</th>
                  <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-right">Peso</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">% múltiplo de pallet</td><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-right font-mono text-green-700 dark:text-green-400">+100</td></tr>
                <tr className="bg-gray-50 dark:bg-gray-800"><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">% múltiplo de caja</td><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-right font-mono text-green-700 dark:text-green-400">+60</td></tr>
                <tr><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">% líneas unitarias</td><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-right font-mono text-red-600 dark:text-red-400">-80</td></tr>
                <tr className="bg-gray-50 dark:bg-gray-800"><td className="px-3 py-1.5">líneas / 1000 unidades</td><td className="px-3 py-1.5 text-right font-mono text-red-600 dark:text-red-400">-0.6</td></tr>
              </tbody>
            </table>
          </div>

          {/* Score BALDA */}
          <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
            <div className="bg-orange-50 dark:bg-orange-900/30 px-4 py-2 font-semibold text-orange-800 dark:text-orange-200">
              Score hacia BALDA
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-left">Factor</th>
                  <th className="border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-right">Peso</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">% líneas unitarias</td><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-right font-mono text-green-700 dark:text-green-400">+100</td></tr>
                <tr className="bg-gray-50 dark:bg-gray-800"><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">líneas / 1000 unidades</td><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-right font-mono text-green-700 dark:text-green-400">+0.6</td></tr>
                <tr><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">% múltiplo de caja</td><td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-right font-mono text-red-600 dark:text-red-400">-60</td></tr>
                <tr className="bg-gray-50 dark:bg-gray-800"><td className="px-3 py-1.5">% múltiplo de pallet</td><td className="px-3 py-1.5 text-right font-mono text-red-600 dark:text-red-400">-100</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs">
          <strong>Umbral de sugerencia:</strong> se emite una sugerencia cuando el score hacia la tipología opuesta supera <strong>20 puntos</strong>.
          Por ejemplo, un producto en BALDA con Score-RACK ≥ 20 recibe la sugerencia "BALDA → RACK/PALLET".
        </div>
      </section>

      {/* 5. Ejemplos */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Ejemplos teóricos</h2>

        {/* Ejemplo 1 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-6">
          <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-orange-800 dark:text-orange-300">Ejemplo A — Producto en RACK que debería ir a BALDA</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs"><strong>Situación:</strong> "Aceite de oliva 500ml" está en una posición de rack (nivel alto). Se pickea 200 veces en el mes, casi siempre 1 o 2 unidades por línea. La caja trae 12 unidades y nunca se pickea en múltiplo de 12.</p>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-left">Dato</th>
                    <th className="border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Tipología actual", "RACK/PALLET"],
                    ["Líneas totales", "200"],
                    ["Unidades totales", "320"],
                    ["% líneas unitarias", "75% (150/200 líneas de 1 unidad)"],
                    ["% múltiplo caja (12u)", "0% (nunca se pickea en múltiplos de 12)"],
                    ["% múltiplo pallet", "0%"],
                    ["Líneas / 1000 unidades", "625 (200 líneas × 1000 / 320 unidades)"],
                  ].map(([d, v], i) => (
                    <tr key={i} className={i % 2 === 0 ? "" : "bg-gray-50 dark:bg-gray-800"}>
                      <td className="border border-gray-200 dark:border-gray-600 px-3 py-1.5">{d}</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-right font-mono">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-xs space-y-1">
              <p><strong>Score RACK:</strong> (100 × 0) + (60 × 0) − (80 × 0.75) − (0.6 × 625) = 0 + 0 − 60 − 375 = <strong className="text-red-600 dark:text-red-400">−435</strong></p>
              <p><strong>Score BALDA:</strong> (100 × 0.75) + (0.6 × 625) − (60 × 0) − (100 × 0) = 75 + 375 = <strong className="text-green-700 dark:text-green-400">+450</strong></p>
              <p className="mt-2 font-semibold text-orange-700 dark:text-orange-300">→ Score BALDA (450) ≥ 20: sugerencia emitida — RACK/PALLET → BALDA ✓</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Interpretación:</strong> el aceite se pickea de a 1-2 unidades constantemente. Ubicarlo en balda permite al operario acceder directamente sin mover estibas ni usar escalera. La operación gana agilidad y el rack se libera para un producto de volumen.
            </p>
          </div>
        </div>

        {/* Ejemplo 2 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-blue-800 dark:text-blue-300">Ejemplo B — Producto en BALDA que debería ir a RACK</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs"><strong>Situación:</strong> "Detergente 5L" está en estantería de balda. Se pickea 80 veces en el mes. La caja trae 6 unidades y el 70% de las veces se pickea exactamente en múltiplos de 6 (una caja entera o más). El pallet trae 60 unidades y el 15% de las líneas es un pallet completo.</p>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-left">Dato</th>
                    <th className="border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Tipología actual", "BALDA"],
                    ["Líneas totales", "80"],
                    ["Unidades totales", "3.200"],
                    ["% líneas unitarias", "2% (casi nunca 1 unidad)"],
                    ["% múltiplo caja (6u)", "70%"],
                    ["% múltiplo pallet (60u)", "15%"],
                    ["Líneas / 1000 unidades", "25 (80 × 1000 / 3200)"],
                  ].map(([d, v], i) => (
                    <tr key={i} className={i % 2 === 0 ? "" : "bg-gray-50 dark:bg-gray-800"}>
                      <td className="border border-gray-200 dark:border-gray-600 px-3 py-1.5">{d}</td>
                      <td className="border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-right font-mono">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-xs space-y-1">
              <p><strong>Score RACK:</strong> (100 × 0.15) + (60 × 0.70) − (80 × 0.02) − (0.6 × 25) = 15 + 42 − 1.6 − 15 = <strong className="text-green-700 dark:text-green-400">+40.4</strong></p>
              <p><strong>Score BALDA:</strong> (100 × 0.02) + (0.6 × 25) − (60 × 0.70) − (100 × 0.15) = 2 + 15 − 42 − 15 = <strong className="text-red-600 dark:text-red-400">−40</strong></p>
              <p className="mt-2 font-semibold text-blue-700 dark:text-blue-300">→ Score RACK (40.4) ≥ 20: sugerencia emitida — BALDA → RACK/PALLET ✓</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Interpretación:</strong> el detergente sale mayormente en cajas o pallets completos. En rack se puede reponer y pickear con autoelevador o transpaleta, reduciendo el tiempo por línea. En balda obliga a manipulación individual de cajas pesadas.
            </p>
          </div>
        </div>

        {/* Ejemplo 3 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-gray-700 dark:text-gray-300">Ejemplo C — Producto sin sugerencia (OK)</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs"><strong>Situación:</strong> "Yogur bebible 200ml" en balda. Se pickea 150 veces, siempre de a 1-3 unidades, casi nunca en múltiplos de caja. El score hacia RACK es bajo.</p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-xs space-y-1">
              <p><strong>Score RACK:</strong> (100 × 0) + (60 × 0.05) − (80 × 0.80) − (0.6 × 450) = 0 + 3 − 64 − 270 = <strong>−331</strong></p>
              <p><strong>Score BALDA:</strong> (100 × 0.80) + (0.6 × 450) − (60 × 0.05) − (100 × 0) = 80 + 270 − 3 = <strong>+347</strong></p>
              <p className="mt-2 font-semibold text-gray-600 dark:text-gray-400">→ Ya está en BALDA y el Score BALDA es dominante: resultado "OK / SIN CAMBIO SUGERIDO" ✓</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Líneas evitables */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Paso 4 — Estimar las líneas evitables</h2>
        <p>
          Para cuantificar el beneficio potencial de un cambio, se compara la <strong>fragmentación actual</strong> del SKU
          (medida en líneas/1000 unidades) contra el <strong>benchmark de la tipología objetivo</strong>: la mediana de
          líneas/1000 unidades de todos los productos que ya están en esa tipología.
        </p>
        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-mono space-y-2">
          <p>Líneas evitables = (L/1000u actual − mediana L/1000u del objetivo) × (unidades pickeadas / 1000)</p>
          <p className="text-gray-500">— Solo se calcula si L/1000u actual &gt; mediana objetivo (hay margen de mejora)</p>
          <p className="text-gray-500">— Si el producto ya es más eficiente que la mediana, el valor es 0</p>
        </div>
        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-xs">
          <p className="font-semibold mb-2">Continuando el Ejemplo A (Aceite de oliva — RACK → BALDA):</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>L/1000u actual: 625</li>
            <li>Mediana de L/1000u de todos los productos en BALDA: supongamos 180</li>
            <li>Unidades pickeadas en el período: 320</li>
            <li className="font-semibold text-green-700 dark:text-green-400">Líneas evitables = (625 − 180) × (320 / 1000) = 445 × 0.32 = <strong>142 líneas</strong></li>
          </ul>
          <p className="mt-2 text-gray-500">
            Esto significa que si el aceite se comportara como un producto típico de balda, se generarían 142 líneas menos de picking
            en el mismo período, con el mismo volumen vendido.
          </p>
        </div>
      </section>

      {/* 7. Cuándo NO actuar */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Cuándo NO actuar sobre una sugerencia</h2>
        <div className="space-y-3">
          <div className="flex gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <span className="text-yellow-600 text-lg">⚠</span>
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-xs mb-1">REVISAR ASIGNACIONES — El maestro no representa la realidad</p>
              <p className="text-xs">Si menos del 50% de las unidades se pickearon desde la ubicación asignada en el maestro, el análisis parte de datos sucios. Antes de mover el producto, hay que corregir las asignaciones en el WMS y esperar un nuevo período de análisis.</p>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="text-gray-500 text-lg">📦</span>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-xs mb-1">Pocos días de actividad</p>
              <p className="text-xs">Un SKU con solo 2-3 días activos puede tener un comportamiento puntual (liquidación, promoción). Considerar si el período analizado es representativo de la operación normal antes de mover el producto.</p>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="text-gray-500 text-lg">🔢</span>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-xs mb-1">Sin datos de pack (caja/pallet = NULL)</p>
              <p className="text-xs">Si el maestro de artículos no tiene definidas las unidades por caja o por pallet, los % de múltiplos no son confiables. El score puede ser correcto por otras señales (% unitario, L/1000u), pero conviene validar el maestro antes de actuar.</p>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="text-gray-500 text-lg">🏗</span>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-xs mb-1">Restricciones físicas del depósito</p>
              <p className="text-xs">El algoritmo no conoce la disponibilidad real de posiciones en cada tipología. Un producto puede tener sugerencia válida pero no haber espacio en balda o el rack puede estar a máxima capacidad. La sugerencia es una señal de oportunidad; la decisión final incorpora la realidad física del layout.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Filtros de calidad */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Filtros de calidad aplicados</h2>
        <ul className="space-y-2 list-disc list-inside text-sm">
          <li><strong>Mínimo 10 líneas de picking</strong> en el período: evita sugerencias con evidencia insuficiente.</li>
          <li><strong>Solo tipologías BALDA o RACK/PALLET</strong>: las áreas especiales quedan fuera del análisis de re-slotting.</li>
          <li><strong>Umbral de score ≥ 20</strong>: filtra productos con señal débil o ambigua.</li>
          <li><strong>≥ 50% desde ubicación asignada</strong>: garantiza que el dato refleje el slot real y no picks dispersos por excepciones operativas.</li>
        </ul>
      </section>

      {/* 9. Frecuencia */}
      <section className="pb-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Frecuencia de actualización</h2>
        <p>
          El análisis se recalcula <strong>una vez por día</strong> mediante el stored procedure <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">bi.usp_build_slotting_sugerencias</code>.
          El tablero muestra siempre la última foto disponible. La fecha y ventana de análisis aparecen debajo del título del tablero.
        </p>
        <p className="mt-2">
          Se recomienda ejecutar el SP sobre una <strong>ventana móvil de 30 días</strong> para capturar el comportamiento reciente sin
          distorsiones de estacionalidad. Ventanas más cortas (7 días) son útiles post-reubicación para validar el impacto,
          pero pueden no ser representativas de la operación habitual.
        </p>
      </section>

    </div>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function SlottingPage() {
  const [data, setData] = useState<SlottingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"analisis" | "metodologia">("analisis");
  const [search, setSearch] = useState("");
  const [filterSugerencia, setFilterSugerencia] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lineas_potencialmente_evitables");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/slotting");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Error desconocido");
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Tabla filtrada y ordenada ──
  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.detalle;

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.sku.toLowerCase().includes(q) ||
          (r.articulo ?? "").toLowerCase().includes(q)
      );
    }

    if (filterSugerencia !== "all") {
      if (filterSugerencia === "sugerir") {
        rows = rows.filter((r) => r.sugerencia.startsWith("SUGERIR:"));
      } else if (filterSugerencia === "revisar") {
        rows = rows.filter((r) => r.sugerencia.startsWith("REVISAR"));
      } else if (filterSugerencia === "ok") {
        rows = rows.filter((r) => r.sugerencia.startsWith("OK"));
      }
    }

    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, search, filterSugerencia, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (col !== sortKey) return <span className="ml-1 text-gray-300 dark:text-gray-600">↕</span>;
    return <span className="ml-1 text-blue-500">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const Th = ({
    col,
    children,
    className = "",
  }: {
    col: SortKey;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap ${className}`}
      onClick={() => handleSort(col)}
    >
      {children}
      <SortIcon col={col} />
    </th>
  );

  // ── Chart data ──
  const chartData = useMemo(() => {
    if (!data?.top10) return [];
    return data.top10.map((r) => ({
      ...r,
      label:
        (r.articulo ?? r.sku).length > 22
          ? (r.articulo ?? r.sku).slice(0, 20) + "…"
          : (r.articulo ?? r.sku),
      color: r.sugerencia.startsWith("SUGERIR: RACK/PALLET")
        ? "#f97316"  // orange
        : "#3b82f6", // blue
    }));
  }, [data]);

  // ─────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200 font-medium">Error al cargar datos: {error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data || data.detalle.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg">Sin datos disponibles.</p>
        <p className="text-sm mt-2">Ejecutá el SP <code>bi.usp_build_slotting_sugerencias</code> para generar el análisis.</p>
      </div>
    );
  }

  const { kpis, metadata } = data;

  const ventanaStr = metadata
    ? `${new Date(metadata.ventana_desde).toLocaleDateString("es-AR")} – ${new Date(metadata.ventana_hasta).toLocaleDateString("es-AR")}`
    : "";
  const loadedStr = metadata
    ? new Date(metadata.loaded_at).toLocaleString("es-AR")
    : "";

  // ─────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────
  return (
    <main className="p-6">
      {/* ── Header ── */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Optimización de Slotting — {clientName}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Detección de productos con tipo de almacenamiento subóptimo (BALDA vs RACK/PALLET)
        </p>
        {metadata && (
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Ventana de análisis: <strong>{ventanaStr}</strong></span>
            <span>Último cálculo: <strong>{loadedStr}</strong></span>
          </div>
        )}
      </header>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-8 border-b border-gray-200 dark:border-gray-700">
        {(["analisis", "metodologia"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
            }`}
          >
            {tab === "analisis" ? "Análisis" : "Metodología"}
          </button>
        ))}
      </div>

      {activeTab === "metodologia" && <MetodologiaTab />}

      {activeTab === "analisis" && <>
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="Total de SKUs analizados que cumplen el mínimo de 10 líneas de picking y pertenecen a tipología BALDA o RACK/PALLET." />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">SKUs Evaluados</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(kpis.totalEvaluados)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="SKUs donde el score indica que el tipo de almacenamiento actual no es el más eficiente para su comportamiento de picking." />
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Con Sugerencia</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{fmt(kpis.conSugerencia)}</p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="SKUs almacenados en RACK/PALLET pero con comportamiento de picking fragmentado (unitario o en pequeñas cantidades). Candidatos a mover a BALDA." />
          </div>
          <p className="text-xs text-orange-700 dark:text-orange-300 mb-1">RACK → BALDA</p>
          <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">{fmt(kpis.rackToBalda)}</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="SKUs almacenados en BALDA pero con picking mayormente en múltiplos de caja o pallet. Candidatos a consolidar en RACK/PALLET para reducir movimientos." />
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">BALDA → RACK</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{fmt(kpis.baldaToRack)}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-5 relative">
          <div className="absolute top-2 right-2">
            <InfoTooltip content="Estimación de líneas de picking que podrían eliminarse si todos los SKUs con sugerencia adoptaran la tipología objetivo. Calculado comparando la fragmentación actual vs. la mediana de la tipología destino." />
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mb-1">Líneas Evitables</p>
          <p className="text-2xl font-bold text-green-800 dark:text-green-200">{fmt(kpis.lineasEvitables)}</p>
        </div>
      </div>

      {/* ── Gráfico Top 10 ── */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Top 10 SKUs por Líneas Evitables
            </h2>
            <InfoTooltip
              position="right"
              content="Los 10 SKUs con mayor potencial de reducción de líneas de picking. Atacarlos primero maximiza el impacto operativo del re-slotting."
            />
          </div>
          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block bg-orange-500" /> RACK → BALDA
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block bg-blue-500" /> BALDA → RACK
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={(v) => fmt(Number(v))}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={180}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-semibold text-gray-100 mb-1">{d.articulo}</p>
                        <p className="text-xs text-gray-400 mb-2">SKU: {d.sku}</p>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-400">Líneas evitables:</span>
                            <span className="font-medium text-green-400">{fmt(d.lineas_evitables)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-400">Sugerencia:</span>
                            <span className="font-medium text-gray-200">{d.grupo_tipologia_objetivo}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="lineas_evitables" radius={[0, 3, 3, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Grilla Detalle ── */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {/* Controles */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Detalle por SKU
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({filteredRows.length} de {data.detalle.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Buscar SKU o artículo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            <select
              value={filterSugerencia}
              onChange={(e) => setFilterSugerencia(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las sugerencias</option>
              <option value="sugerir">Solo sugerencias activas</option>
              <option value="revisar">Solo a revisar</option>
              <option value="ok">Solo OK</option>
            </select>
            <button
              onClick={() => exportCSV(filteredRows)}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium flex items-center gap-1"
            >
              ↓ Exportar CSV
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                <Th col="sku">SKU</Th>
                <Th col="articulo" className="min-w-[180px]">Artículo</Th>
                <Th col="tipologia_actual_observada">Tipología</Th>
                <Th col="sugerencia">Sugerencia</Th>
                <Th col="lineas_picking">Líneas</Th>
                <Th col="unidades_pickeadas">Unidades</Th>
                <Th col="avg_qty_por_linea">U/Línea</Th>
                <Th col="porc_lineas_unitarias">
                  <span className="flex items-center gap-1">
                    % Unit
                    <InfoTooltip content="% líneas donde se pickeó exactamente 1 unidad. Alto → candidato a BALDA." position="right" />
                  </span>
                </Th>
                <Th col="porc_lineas_multiplo_caja">
                  <span className="flex items-center gap-1">
                    % Caja
                    <InfoTooltip content="% líneas donde la cantidad es múltiplo exacto de caja. Alto → candidato a RACK." position="right" />
                  </span>
                </Th>
                <Th col="lineas_por_1000_unidades">
                  <span className="flex items-center gap-1">
                    L/1000u
                    <InfoTooltip content="Líneas de picking por cada 1000 unidades. Mayor fragmentación = más líneas. Balda fragmentada tiene valores altos." position="right" />
                  </span>
                </Th>
                <Th col="lineas_potencialmente_evitables">Líneas Evitables</Th>
                <Th col="prioridad">Prioridad</Th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const colors = sugerenciaColor(row.sugerencia);
                return (
                  <tr
                    key={row.sku}
                    className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                      i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/50"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {row.sku}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-[220px]">
                      <span title={row.articulo}>
                        {row.articulo?.length > 30
                          ? row.articulo.slice(0, 28) + "…"
                          : row.articulo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {row.tipologia_actual_observada}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {row.sugerencia.replace("SUGERIR: ", "").replace("OK / SIN CAMBIO SUGERIDO", "OK")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmt(row.lineas_picking)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmt(row.unidades_pickeadas)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmtDec(row.avg_qty_por_linea)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmtPct(row.porc_lineas_unitarias)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmtPct(row.porc_lineas_multiplo_caja)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                      {fmtDec(row.lineas_por_1000_unidades)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {row.lineas_potencialmente_evitables !== null ? (
                        <span className="text-green-700 dark:text-green-400">
                          {fmt(row.lineas_potencialmente_evitables)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-400">
                      {fmtDec(row.prioridad)}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="px-3 py-8 text-center text-gray-400 dark:text-gray-500"
                  >
                    Sin resultados para los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </main>
  );
}
