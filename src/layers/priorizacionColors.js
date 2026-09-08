/* priorizacionColors.js — Paleta ordinal para la priorización de subtramos
 * por carga difusa de N y P (Tabla 5.2, Informe 1).
 *
 * A diferencia de riverColors.js (categórico, sin relación de orden entre
 * ríos), "Muy alta > Alta > Media > Baja" SÍ tiene un orden — por eso aquí va
 * un solo matiz cada vez más oscuro (ordinal), no colores distintos entre sí
 * (categórico). Validado con el método de la skill `dataviz`:
 *
 *   node scripts/validate_palette.js "#dc9f80,#d47f52,#b8502f,#7d2317" \
 *     --mode light --ordinal
 *   → ALL CHECKS PASS (luminosidad monótona, saltos >= 0.06,
 *     extremo claro >= 2:1 de contraste, un solo matiz — spread 17°)
 *
 * "No aplica" (sin caña en la franja, 6 de 46 tramos) NO es "menos que Baja"
 * — es una categoría aparte que la propia metodología excluye por
 * construcción. Por eso lleva gris neutro, fuera del ramp, no un quinto
 * escalón más claro que Baja (eso sí implicaría "aún menor prioridad").
 */

export const PRIORIZACION_COLORS = {
  'Muy alta':  '#7d2317',
  'Alta':      '#b8502f',
  'Media':     '#d47f52',
  'Baja':      '#dc9f80',
  'No aplica': '#b9b9b9',
};

export const ORDEN_CATEGORIAS = ['Muy alta', 'Alta', 'Media', 'Baja', 'No aplica'];

export function priorizacionColorMatchExpr(field) {
  const expr = ['match', ['get', field]];
  for (const [key, color] of Object.entries(PRIORIZACION_COLORS)) expr.push(key, color);
  expr.push('#cccccc');
  return expr;
}

/* Rellena un contenedor con la leyenda ordinal (5 filas fijas, en orden). */
export function populatePriorizacionLegend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = ORDEN_CATEGORIAS.map(cat => `
    <div class="legend-rio-item">
      <div class="legend-rio-swatch" style="background:${PRIORIZACION_COLORS[cat]};border-radius:3px"></div>
      <span>${cat}</span>
    </div>
  `).join('');
}
