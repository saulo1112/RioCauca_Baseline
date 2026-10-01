/* MonitoreoToggle.js — Botón "Monitoreo de calidad de agua" (hover de "Zona
 * de Estudio", debajo de "Ver priorización por carga").
 *
 * Mismo patrón que PriorizacionToggle.js:
 *   - Oculta temporalmente "Estaciones de calidad del agua": los puntos de
 *     monitoreo son esas mismas estaciones (las de cierre de cada subtramo) y
 *     superpuestas competirían con el color por estado. Al desactivar se
 *     restaura el estado previo del checkbox.
 *   - Es excluyente con la priorización: ambas capas usan los mismos escalones
 *     de color con significados distintos (categoría de carga vs. estado), así
 *     que verlas juntas confundiría la lectura. Se resuelve desde aquí, sin
 *     tocar PriorizacionToggle.js.
 *
 * La ficha interactiva se abre al hacer clic en un punto (InfoPanel.js →
 * MonitoreoFicha.js).
 */

import { MONITOREO_LAYERS } from '../layers/geojson.js';
import { populateMonitoreoLegend } from '../layers/monitoreoColors.js';
import * as PriorizacionToggle from './PriorizacionToggle.js';

const COEXISTING_CHECKBOXES = ['lyr-estaciones-calidad'];

let _active = false;
let _previousChecked = {};

export function init(map) {
  const btn = document.getElementById('btn-monitoreo');
  if (!btn) return;

  populateMonitoreoLegend('legend-monitoreo-estados');
  btn.addEventListener('click', () => setActive(map, !_active));

  /* Activar la priorización apaga el monitoreo (el listener propio de
   * PriorizacionToggle ya se ejecutó: este solo cierra el monitoreo). */
  document.getElementById('btn-priorizacion')?.addEventListener('click', () => {
    if (_active) setActive(map, false);
  });
}

export function isActive() { return _active; }

export function setActive(map, next) {
  if (next === _active) return;
  _active = next;

  if (_active) PriorizacionToggle.setActive(map, false);

  const vis = _active ? 'visible' : 'none';
  MONITOREO_LAYERS.forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  });

  document.getElementById('btn-monitoreo')?.classList.toggle('active', _active);
  document.getElementById('btn-monitoreo')?.setAttribute('aria-pressed', String(_active));
  document.getElementById('legend-monitoreo')?.classList.toggle('visible', _active);

  for (const id of COEXISTING_CHECKBOXES) {
    const chk = document.getElementById(id);
    if (!chk) continue;
    if (_active) {
      _previousChecked[id] = chk.checked;
      if (chk.checked) { chk.checked = false; chk.dispatchEvent(new Event('change')); }
    } else if (id in _previousChecked) {
      if (_previousChecked[id] && !chk.checked) { chk.checked = true; chk.dispatchEvent(new Event('change')); }
      delete _previousChecked[id];
    }
  }
}
