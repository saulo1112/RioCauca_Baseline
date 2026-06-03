/* main.js — Visor MapLibre GL JS + GeoJSON
   Corredor Biológico Río Cauca | UAO × ASOCAÑA */

import { initMap, switchBasemap }  from './map/init.js';
import { loadGeoJSONLayers }       from './layers/geojson.js';
import { setupLayerPanel }         from './controls/LayerPanel.js';
import { setupTramoFilter }        from './controls/TramoFilter.js';
import { setupInfoPanel }          from './controls/InfoPanel.js';

/* ── Inicializar mapa ─────────────────────────────────────────────────── */
const map = initMap();

/* ── Selector de tramos (funciona antes de cargar capas) ────────────── */
setupTramoFilter(map);

/* ── Selector de mapa base ───────────────────────────────────────────── */
document.querySelectorAll('.basemap-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    switchBasemap(map, btn.dataset.basemap);
  });
});

/* ── Bootstrap principal ─────────────────────────────────────────────── */
map.on('load', async () => {

  /* Cargar y registrar todas las capas GeoJSON */
  await loadGeoJSONLayers(map);

  /* Controles interactivos */
  setupLayerPanel(map);
  setupInfoPanel(map);

  /* Limpiar indicador de carga */
  document.getElementById('map-loading')?.remove();
});
