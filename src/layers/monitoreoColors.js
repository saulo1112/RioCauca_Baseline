/* monitoreoColors.js — Color por estado de la capa "Monitoreo de calidad de
 * agua" (Actividad 5).
 *
 * No es una paleta nueva: toma por referencia los escalones de la paleta de
 * priorización (priorizacionColors.js), con el mismo patrón ordinal de un solo
 * matiz. El orden es de pertinencia como punto de monitoreo del corredor:
 * Incluida (oscuro) > Pendiente > Excluida (claro). La exclusión previa lleva
 * el gris de "No aplica" porque, como aquella, queda fuera del método por
 * construcción y no es "menos que Excluida".
 *
 *   node scripts/validate_palette.js "#7d2317,#b8502f,#dc9f80" --mode light --ordinal
 *   → ALL CHECKS PASS (skill `dataviz`)
 */

import { PRIORIZACION_COLORS } from './priorizacionColors.js';

export const MONITOREO_COLORS = {
  'Incluida':         PRIORIZACION_COLORS['Muy alta'],
  'Pendiente':        PRIORIZACION_COLORS['Alta'],
  'Excluida':         PRIORIZACION_COLORS['Baja'],
  'Exclusión previa': PRIORIZACION_COLORS['No aplica'],
};

export const ORDEN_ESTADOS = ['Incluida', 'Pendiente', 'Excluida', 'Exclusión previa'];

export function monitoreoColorMatchExpr(field) {
  const expr = ['match', ['get', field]];
  for (const [key, color] of Object.entries(MONITOREO_COLORS)) expr.push(key, color);
  expr.push('#cccccc');
  return expr;
}

/* Rellena un contenedor con la leyenda (4 filas fijas, en orden). Los puntos
 * van redondos, como en el mapa; el estado se nombra siempre en texto. */
export function populateMonitoreoLegend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = ORDEN_ESTADOS.map(estado => `
    <div class="legend-rio-item">
      <div class="legend-rio-swatch" style="background:${MONITOREO_COLORS[estado]}"></div>
      <span>${estado}</span>
    </div>
  `).join('');
}
