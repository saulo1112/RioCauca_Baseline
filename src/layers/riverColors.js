/* riverColors.js — Paleta categórica por río + ícono de triángulo (SDF) para
 * diferenciar estaciones hidrométricas (▲) de estaciones de calidad (●), con
 * un color por río en ambos tipos, replicando la simbología típica de un
 * proyecto SIG (ver ArcGIS Pro): forma = tipo de estación, color = río.
 *
 * Paleta generada y validada con el método OKLab/CVD de la skill `dataviz`
 * (node scripts/validate_palette.js, --pairs all, --mode light):
 *   16 categorías simultáneas exceden lo que el color por sí solo puede
 *   codificar de forma segura para daltonismo — la propia guía documenta que,
 *   bajo la prueba estricta "todas las parejas" (la que aplica a un mapa,
 *   donde cualquier par de puntos puede quedar uno junto al otro), un set de
 *   8 matices ya solo garantiza distinción total en sus primeros 3 slots.
 *   Con 16 ríos reales que nombrar, la alternativa de "recortar a 3 y agrupar
 *   el resto en 'Otros'" no sirve aquí. Se optimizó (búsqueda voraz
 *   maximin + ajuste local, en OKLab, bajo simulación de protanopia/
 *   deuteranopia) para el mejor peor-caso alcanzable a 16 colores —
 *   ΔE peor pareja 6.6 (zona de aviso, no la meta de 8) — y por eso el color
 *   es un apoyo visual, NUNCA el único identificador: la etiqueta de texto
 *   (siempre visible junto al punto) y el nombre del río en el popup son la
 *   fuente de verdad. Ver docs/paleta_rios.md para la tabla completa y el
 *   reporte del validador.
 */

/* ── Normalización de nombres de río ─────────────────────────────────── */
/* Reconcilia variantes entre fuentes: "Rio Amaime" (calidad, con prefijo)
 * vs. "Amaime" (hidrométricas, sin prefijo) vs. "Rio Frayle"/"Rio Fraile"
 * (grafías distintas del mismo río). */
const ALIASES = {
  frayle: 'fraile',
};

export function normalizeRio(raw) {
  if (!raw) return '';
  let s = raw.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');   // quita tildes
  s = s.replace(/^rio\s+/, '');   // ya sin tildes en este punto: "río " -> "rio "
  return ALIASES[s] || s;
}

/* ── Paleta (16 ríos tributarios) ─────────────────────────────────────── */
export const RIVER_COLORS = {
  amaime:       '#2a78d6',
  bolo:         '#6ec52a',
  bugalagrande: '#576d07',
  desbaratado:  '#00c7f5',
  fraile:       '#009c90',
  guabas:       '#864886',
  guachal:      '#4bc39f',
  guadalajara:  '#00a0f9',
  'la paila':   '#009a3f',
  nima:         '#00b2c2',
  palo:         '#0091c6',
  parraga:      '#8d2ead',
  riofrio:      '#f24e73',
  risaralda:    '#b4065f',
  sabaletas:    '#3153d3',
  tulua:        '#55ab00',
};

export const DEFAULT_RIVER_COLOR = '#888888';

/* Nombre legible por clave normalizada, para la leyenda. */
export const RIVER_DISPLAY_NAMES = {
  amaime:       'Amaime',
  bolo:         'Bolo',
  bugalagrande: 'Bugalagrande',
  desbaratado:  'Desbaratado',
  fraile:       'Fraile',
  guabas:       'Guabas',
  guachal:      'Guachal',
  guadalajara:  'Guadalajara',
  'la paila':   'La Paila',
  nima:         'Nima',
  palo:         'Palo',
  parraga:      'Parraga',
  riofrio:      'Riofrío',
  risaralda:    'Risaralda',
  sabaletas:    'Sabaletas',
  tulua:        'Tuluá',
};

/* Rellena un contenedor con un swatch + nombre por cada río de la paleta.
 * Se usa para la leyenda del panel lateral (ver index.html #legend-rios). */
export function populateRiverLegend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Object.entries(RIVER_COLORS).map(([key, color]) => `
    <div class="legend-rio-item">
      <div class="legend-rio-swatch" style="background:${color}"></div>
      <span>${RIVER_DISPLAY_NAMES[key] || key}</span>
    </div>
  `).join('');
}

/* Expresión MapLibre `match` que colorea por río a partir de una propiedad
 * ya normalizada (ver rio_color_key, agregado al cargar cada capa). */
export function riverColorMatchExpr(field) {
  const expr = ['match', ['get', field]];
  for (const [key, color] of Object.entries(RIVER_COLORS)) {
    expr.push(key, color);
  }
  expr.push(DEFAULT_RIVER_COLOR);
  return expr;
}

/* ── Ícono de triángulo (estaciones hidrométricas) ──────────────────────
 * Un solo bitmap blanco registrado como SDF: MapLibre lo tiñe en tiempo de
 * render vía icon-color, igual que circle-color en las capas de círculo.
 * Se usa dos veces por capa (halo blanco más grande + relleno coloreado más
 * chico) para imitar el circle-stroke blanco de las estaciones de calidad. */
export const TRIANGLE_ICON_ID = 'triangle-marker-sdf';

export function ensureTriangleIcon(map) {
  if (map.hasImage(TRIANGLE_ICON_ID)) return;

  const SIZE = 64;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(SIZE * 0.5, SIZE * 0.08);
  ctx.lineTo(SIZE * 0.94, SIZE * 0.92);
  ctx.lineTo(SIZE * 0.06, SIZE * 0.92);
  ctx.closePath();
  ctx.fill();

  const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
  map.addImage(TRIANGLE_ICON_ID, imgData, { sdf: true });
}
