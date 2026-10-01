/* monitoreo.js — Constantes del panel "Monitoreo de calidad de agua".
 *
 * GENERADO por scripts/build_monitoreo_corredor.py; no editar a mano. Son las
 * mismas cifras de la hoja Parámetros de docs/monitoreo_corredor.xlsx, de modo
 * que el geovisor y el Excel no pueden quedar con valores distintos.
 *
 *   FE_N = 184 kg N/ha/año × 0.0520 (Informe Fase 1, Tablas 4.6 y 4.7)
 *   FE_P = 46 kg P2O5/ha/año × 0.436 × 0.0686 (Tablas 4.6 y 4.8)
 */

export const FE_N = 9.568;  // kg N/ha/año
export const FE_P = 1.3758416;  // kg P/ha/año
export const DIAS_ANO = 365;
export const CONV_Q = 86.4;  // C (mg/L) = carga (kg/d) / (Q (m³/s) × 86,4)

/* Rango de remoción validado por el proyecto: escenario 2, corredor establecido. */
export const REMOCION_MAX_VALIDADA = 0.4;

/* Escenarios del Excel (remoción = 1 − factor de retención). */
export const ESCENARIOS = [
  { remocion: 0.0, etiqueta: 'Base' },
  { remocion: 0.2, etiqueta: 'Esc. 1' },
  { remocion: 0.4, etiqueta: 'Esc. 2' },
];

/* Condición hidrológica → propiedad del GeoJSON con el caudal de referencia. */
export const CONDICIONES = [
  { id: 'Promedio',   prop: 'q_promedio_m3s' },
  { id: 'Verano',     prop: 'q_verano_m3s' },
  { id: 'Transición', prop: 'q_transicion_m3s' },
  { id: 'Invierno',   prop: 'q_invierno_m3s' },
];
