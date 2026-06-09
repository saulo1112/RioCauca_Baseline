/* main.js — Visor MapLibre GL JS + GeoJSON
   Corredor Biológico Río Cauca | UAO × ASOCAÑA */

import { initMap, switchBasemap }  from './map/init.js';
import { loadGeoJSONLayers }       from './layers/geojson.js';
import { setupLayerPanel }         from './controls/LayerPanel.js';
import { setupTramoFilter }        from './controls/TramoFilter.js';
import { setupInfoPanel }          from './controls/InfoPanel.js';
import { loadWaterQualityData }    from './data/waterQuality.js';
import * as WaterQualityGallery    from './controls/WaterQualityGallery.js';

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

  /* Disparar la carga del CSV de calidad del agua en paralelo (no bloquea) */
  loadWaterQualityData();

  /* Cargar y registrar todas las capas GeoJSON */
  await loadGeoJSONLayers(map);

  /* Controles interactivos */
  setupLayerPanel(map);
  setupInfoPanel(map);
  WaterQualityGallery.init();

  document.getElementById('btn-galeria-calidad')
    ?.addEventListener('click', () => WaterQualityGallery.open());

  /* Limpiar indicador de carga inline */
  document.getElementById('map-loading')?.remove();

  /* Fade-out y eliminación del splash screen */
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }
});
