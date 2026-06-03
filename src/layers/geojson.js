/* geojson.js — Carga y registro de capas GeoJSON como layers visuales MapLibre.
 *
 * Orden de renderizado (de fondo a frente):
 *   1. buffer-fill / buffer-outline  — zona de estudio (polígonos, fondo)
 *   2. hectareas-fill               — caña de azúcar (lazy, zoom ≥ 10)
 *   3. rio-cauca-line               — Río Cauca (línea principal)
 *   4. tributarios-line             — tributarios
 *   5. *-label                      — etiquetas (siempre al frente)
 *
 * Hectareas_CZ.geojson (12 MB) se carga en segundo plano para no bloquear
 * el arranque. Su capa permanece oculta hasta que el usuario la activa.
 */

import { geojsonBbox, mergeBboxes } from '../utils/bounds.js';

/* ── Rutas GeoJSON ────────────────────────────────────────────────────── */
const PATHS = {
  'buffer-zona':  'data/cartografia/Buffer_Zona_de_Estudio.geojson',
  'hectareas-cz': 'data/cartografia/Hectareas_CZ.geojson',
  'rio-cauca':    'data/cartografia/Rio_cauca.geojson',
  'tributarios':  'data/cartografia/Tributarios_rios_cauca.geojson',
};

/* ── Grupos checkbox → capas (exportado para LayerPanel) ────────────── */
export const LAYER_GROUPS = {
  'lyr-rios':      ['rio-cauca-halo', 'rio-cauca-line', 'rio-cauca-label', 'tributarios-halo', 'tributarios-line', 'tributarios-label'],
  'lyr-buffer':    ['buffer-fill', 'buffer-outline'],
  'lyr-hectareas': ['hectareas-fill'],
};

/* ── Capas clickeables (exportado para InfoPanel) ───────────────────── */
export const CLICKABLE_LAYERS = [
  'buffer-fill',
  'hectareas-fill',
  'rio-cauca-line',
  'tributarios-line',
];

let _hectareasReady = false;

/* ── Carga principal ─────────────────────────────────────────────────── */
export async function loadGeoJSONLayers(map) {
  const bboxes = [];

  /* 1. Buffer zona de estudio */
  const bufferBbox = await _loadSource(map, 'buffer-zona');
  if (bufferBbox) bboxes.push(bufferBbox);
  _addBufferLayers(map);

  /* 2. Río Cauca — tolerance 0.05 elimina microvariaciones de vértices
   *    sin perder los meandros reales (tributarios mantienen tolerance: 0) */
  const rioBbox = await _loadSource(map, 'rio-cauca', { tolerance: 0.05 });
  if (rioBbox) bboxes.push(rioBbox);
  _addRioCaucaLayers(map);

  /* 3. Tributarios — fidelidad completa (se ven bien con tolerance: 0) */
  const tribBbox = await _loadSource(map, 'tributarios');
  if (tribBbox) bboxes.push(tribBbox);
  _addTributariosLayers(map);

  /* Auto-fit al corredor una vez cargadas las capas estructurales */
  if (bboxes.length > 0) {
    const [w, s, e, n] = mergeBboxes(bboxes);
    map.fitBounds([[w, s], [e, n]], {
      padding: { top: 40, bottom: 60, left: 290, right: 60 },
      duration: 1400,
      maxZoom: 11,
    });
  }

  /* 4. Hectareas CZ — carga diferida en segundo plano */
  _loadHectareasBackground(map);
}

/* ── Carga diferida de Hectareas_CZ ─────────────────────────────────── */
async function _loadHectareasBackground(map) {
  try {
    const resp = await fetch(PATHS['hectareas-cz']);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();

    if (!map.getSource('hectareas-cz')) {
      map.addSource('hectareas-cz', { type: 'geojson', data: geojson });
    }
    _addHectareasLayers(map);
    _hectareasReady = true;
    console.log('[geojson] Hectareas CZ lista:', geojson.features.length, 'entidades');
  } catch (err) {
    console.error('[geojson] Error cargando Hectareas CZ:', err);
  }
}

/* Llamado por LayerPanel cuando el usuario activa caña antes de que cargue */
export async function ensureHectareasLoaded(map) {
  if (_hectareasReady || map.getSource('hectareas-cz')) return;
  await _loadHectareasBackground(map);
}

/* ── Helper: fetch + addSource ───────────────────────────────────────── */
async function _loadSource(map, sourceId, sourceOpts = {}) {
  try {
    const resp = await fetch(PATHS[sourceId]);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        tolerance: 0,     // base: fidelidad completa por defecto
        ...sourceOpts,    // permite override por fuente (ej: tolerance: 0.05)
      });
    }
    return geojsonBbox(geojson);
  } catch (err) {
    console.error(`[geojson] Error cargando ${sourceId}:`, err);
    return null;
  }
}

/* ── Definición de capas ─────────────────────────────────────────────── */

function _addBufferLayers(map) {
  if (!map.getLayer('buffer-fill')) {
    map.addLayer({
      id:     'buffer-fill',
      type:   'fill',
      source: 'buffer-zona',
      paint: {
        'fill-color':   'rgba(0, 100, 255, 0.28)',
        'fill-opacity':  1,
      },
    });
  }

  if (!map.getLayer('buffer-outline')) {
    map.addLayer({
      id:     'buffer-outline',
      type:   'line',
      source: 'buffer-zona',
      paint: {
        'line-color':   '#6E6E6E',
        'line-width':   1,
        'line-opacity': 0.85,
      },
    });
  }
}

function _addHectareasLayers(map) {
  if (map.getLayer('hectareas-fill')) return;

  /* Insertar debajo del halo del Río Cauca para respetar el z-order:
   *   buffer → hectareas → rio-cauca-halo → rio-cauca-line → tributarios */
  const before = map.getLayer('rio-cauca-halo') ? 'rio-cauca-halo'
               : map.getLayer('rio-cauca-line') ? 'rio-cauca-line'
               : undefined;

  map.addLayer(
    {
      id:     'hectareas-fill',
      type:   'fill',
      source: 'hectareas-cz',
      layout: { visibility: 'none' },
      paint: {
        'fill-color':   '#FBC4BB',
        'fill-opacity': 0.7,
      },
    },
    before,
  );
}

function _addRioCaucaLayers(map) {
  /* Halo — se añade PRIMERO para quedar debajo de la línea principal */
  if (!map.getLayer('rio-cauca-halo')) {
    map.addLayer({
      id:     'rio-cauca-halo',
      type:   'line',
      source: 'rio-cauca',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color':   '#7EB3FF',
        'line-opacity': 0.35,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          7, 2.0,
          12, 3.5,
          16, 5.0,
        ],
      },
    });
  }

  /* Línea principal — encima del halo */
  if (!map.getLayer('rio-cauca-line')) {
    map.addLayer({
      id:     'rio-cauca-line',
      type:   'line',
      source: 'rio-cauca',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#004DA8',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          7, 1.0,
          12, 1.8,
          16, 2.5,
        ],
        'line-blur': 0.35,
      },
    });
  }

  if (!map.getLayer('rio-cauca-label')) {
    map.addLayer({
      id:      'rio-cauca-label',
      type:    'symbol',
      source:  'rio-cauca',
      minzoom: 9,
      layout: {
        'symbol-placement': 'line',
        'text-field':       ['get', 'NOM1_DRENAJE'],
        'text-size':        12,
        'text-font':        ['Open Sans Regular'],
        'symbol-spacing':   600,
        'text-optional':    true,
        'text-max-angle':   30,
      },
      paint: {
        'text-color':       '#7EB3FF',
        'text-halo-color':  '#0f1419',
        'text-halo-width':  1.5,
      },
    });
  }
}

function _addTributariosLayers(map) {
  /* Halo — se añade PRIMERO para quedar debajo de la línea principal */
  if (!map.getLayer('tributarios-halo')) {
    map.addLayer({
      id:     'tributarios-halo',
      type:   'line',
      source: 'tributarios',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color':   '#7DD5FF',
        'line-opacity': 0.30,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          7, 1.8,
          12, 3.0,
          16, 4.5,
        ],
      },
    });
  }

  /* Línea principal — encima del halo */
  if (!map.getLayer('tributarios-line')) {
    map.addLayer({
      id:     'tributarios-line',
      type:   'line',
      source: 'tributarios',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#0A93FC',
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          7, 0.8,
          12, 1.5,
          16, 3,
        ],
        'line-blur': 0.35,
      },
    });
  }

  if (!map.getLayer('tributarios-label')) {
    map.addLayer({
      id:      'tributarios-label',
      type:    'symbol',
      source:  'tributarios',
      minzoom: 9,
      layout: {
        'symbol-placement': 'line',
        'text-field':       ['get', 'NOM1_DRENA'],
        'text-size':        10,
        'text-font':        ['Open Sans Regular'],
        'symbol-spacing':   400,
        'text-optional':    true,
        'text-max-angle':   30,
      },
      paint: {
        'text-color':       '#B8DEFF',
        'text-halo-color':  '#0f1419',
        'text-halo-width':  1.5,
      },
    });
  }
}
