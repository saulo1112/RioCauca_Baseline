/* registry.js — Constantes compartidas del sistema de capas.
 *
 * Paleta de colores por nombre de río, usada en popups e InfoPanel.
 */

export const RIVER_COLORS = {
  'Rio Palo':         '#29b6f6',
  'Rio Desbaratado':  '#ab47bc',
  'Rio Fraile':       '#26a69a',
  'Rio Bolo':         '#ef5350',
  'Rio Amaime':       '#ff7043',
  'Rio Nima':         '#ffca28',
  'Rio Zabaletas':    '#66bb6a',
  'Rio Guabas':       '#26c6da',
  'Rio Guadalajara':  '#7e57c2',
  'Rio Riofrio':      '#ec407a',
  'Rio Tulua':        '#d4e157',
  'Rio Bugalagrande': '#ffa726',
  'Rio La Paila':     '#42a5f5',
  'Rio Risaralda':    '#a5d6a7',
  'Rio Guachal':      '#80cbc4',
  'Rio Palmira':      '#f48fb1',
  'Rio Parraga':      '#bcaaa4',
};

export function getRiverColor(name) {
  return RIVER_COLORS[name] ?? '#aaaaaa';
}
