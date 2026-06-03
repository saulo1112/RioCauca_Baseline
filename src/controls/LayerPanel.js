/* LayerPanel.js — Controla la visibilidad de capas GeoJSON desde checkboxes */

import { LAYER_GROUPS, ensureHectareasLoaded } from '../layers/geojson.js';

export function setupLayerPanel(map) {
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

      /* Caña de azúcar: asegurar que el GeoJSON esté cargado antes de mostrar */
      if (checkboxId === 'lyr-hectareas' && chk.checked) {
        await ensureHectareasLoaded(map);
      }

      layerIds.forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
      });
    });
  }
}
