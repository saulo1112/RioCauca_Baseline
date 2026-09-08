/* PriorizacionToggle.js — Botón que muestra/oculta la capa de priorización
 * de subtramos por carga difusa de N y P (colgado del hover de "Zona de
 * Estudio" en el panel de capas, ver index.html).
 *
 * Al activarla, oculta temporalmente "Zona de Estudio" y "Caña de Azúcar"
 * — ambas cubren la misma franja de 700 m con su propio tinte, y verlas
 * junto a la escala de color satura el mapa y desdibuja las categorías — y
 * las restaura a como estaban al desactivarla. Reutiliza los checkboxes
 * existentes (dispara 'change' para que LayerPanel.js aplique la
 * visibilidad), no duplica esa lógica.
 */

import { PRIORIZACION_LAYERS } from '../layers/geojson.js';
import { populatePriorizacionLegend } from '../layers/priorizacionColors.js';

const COEXISTING_CHECKBOXES = ['lyr-buffer', 'lyr-hectareas'];

let _active = false;
let _previousChecked = {};

export function init(map) {
  const btn = document.getElementById('btn-priorizacion');
  if (!btn) return;

  populatePriorizacionLegend('legend-priorizacion-rios');
  btn.addEventListener('click', () => setActive(map, !_active));
}

export function setActive(map, next) {
  _active = next;
  const vis = _active ? 'visible' : 'none';
  PRIORIZACION_LAYERS.forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  });

  document.getElementById('btn-priorizacion')?.classList.toggle('active', _active);
  document.getElementById('legend-priorizacion')?.classList.toggle('visible', _active);

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
