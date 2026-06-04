/* LayerPanel.js — Controla la visibilidad de capas GeoJSON desde checkboxes */

import { LAYER_GROUPS, ensureHectareasLoaded } from '../layers/geojson.js';

const RIOS_GEO    = ['rio-cauca-halo', 'rio-cauca-line', 'tributarios-halo', 'tributarios-line'];
const RIOS_LABELS = ['tributarios-label'];

export function setupLayerPanel(map) {

  /* ── Ríos: control maestro + subcontroles de geometría y etiquetas ── */
  const riosChk   = document.getElementById('lyr-rios');
  const geoChk    = document.getElementById('lyr-rios-geo');
  const labelsChk = document.getElementById('lyr-rios-labels');

  function _setVis(ids, on) {
    ids.forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    });
  }

  function _applyRios() {
    const master = riosChk?.checked ?? true;
    _setVis(RIOS_GEO,    master && (geoChk?.checked    ?? true));
    _setVis(RIOS_LABELS, master && (labelsChk?.checked ?? true));
  }

  riosChk?.addEventListener('change',   _applyRios);
  geoChk?.addEventListener('change',    _applyRios);
  labelsChk?.addEventListener('change', _applyRios);

  /* ── Resto de capas (buffer, hectáreas) — bucle genérico ── */
  for (const [checkboxId, layerIds] of Object.entries(LAYER_GROUPS)) {
    const chk = document.getElementById(checkboxId);
    if (!chk || chk.disabled) continue;

    /* Estado inicial del checkbox: leer visibilidad de la primera capa del grupo */
    const firstId = layerIds[0];
    if (map.getLayer(firstId)) {
      chk.checked = map.getLayoutProperty(firstId, 'visibility') !== 'none';
    }

    chk.addEventListener('change', async () => {
      const vis = chk.checked ? 'visible' : 'none';

      if (checkboxId === 'lyr-hectareas' && chk.checked) {
        await ensureHectareasLoaded(map);
      }

      layerIds.forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
      });
    });
  }
}
