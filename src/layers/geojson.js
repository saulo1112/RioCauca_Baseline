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

/* Incrementar cuando se actualice cualquier archivo GeoJSON, para forzar
 * que el navegador descarte la caché y descargue la versión más reciente. */
const BUILD_VERSION = '1.7';

/* ── Rutas GeoJSON ────────────────────────────────────────────────────── */
const PATHS = {
  'buffer-zona':      'data/cartografia/Buffer_Zona_de_Estudio.geojson',
  'hectareas-cz':     'data/cartografia/Hectareas_CZ.geojson',
  'rio-cauca':        'data/cartografia/Rio_cauca.geojson',
  'tributarios':      'data/cartografia/Tributarios_rios_cauca.geojson',
  'estaciones-cauca': 'data/water%20quality/Estaciones_calidad_del_agua.geojson',
  'estaciones-trib':  'data/water%20quality/Estaciones_calidad_del_agua.geojson',
  'estaciones-hidro': 'data/hydrology/estaciones_hidro.json',
};

/* ── Grupos checkbox → capas (exportado para LayerPanel) ────────────── */
/* lyr-rios se gestiona con subcontroles en LayerPanel (geo + etiquetas) */
export const LAYER_GROUPS = {
  'lyr-buffer':           ['buffer-fill', 'buffer-outline'],
  'lyr-hectareas':        ['hectareas-fill'],
  'lyr-estaciones-cauca': ['estaciones-cauca-circle', 'estaciones-cauca-label'],
  'lyr-estaciones-trib':  ['estaciones-trib-circle',  'estaciones-trib-label'],
  'lyr-estaciones-hidro': ['estaciones-hidro-circle', 'estaciones-hidro-label'],
};

/* ── Capas clickeables (exportado para InfoPanel) ───────────────────── */
export const CLICKABLE_LAYERS = [
  'estaciones-cauca-circle',
  'estaciones-trib-circle',
  'estaciones-hidro-circle',
  'buffer-fill',
  'hectareas-fill',
  'rio-cauca-line',
  'tributarios-line',
];

let _hectareasReady  = false;
let _hectareasTotalHa = 0;   // suma de SUM_AREA_HA de todos los registros

/* Devuelve el total de hectáreas de caña una vez que el GeoJSON fue cargado.
 * Usado por InfoPanel para calcular la participación porcentual por río. */
export function getHectareasTotalHa() { return _hectareasTotalHa; }

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

  /* 4. Estaciones calidad del agua — Río Cauca */
  await _loadEstacionesCauca(map);

  /* 4b. Estaciones calidad del agua — Ríos tributarios */
  await _loadEstacionesTrib(map);

  /* 4c. Estaciones hidrométricas — Río Cauca */
  await _loadEstacionesHidro(map);

  console.log('[geojson] Capas en estilo:', map.getStyle().layers.map(l => l.id));

  /* 5. Hectareas CZ — carga diferida en segundo plano */
  _loadHectareasBackground(map);
}

/* ── Carga diferida de Hectareas_CZ ─────────────────────────────────── */
async function _loadHectareasBackground(map) {
  try {
    const resp = await fetch(`${PATHS['hectareas-cz']}?v=${BUILD_VERSION}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();

    /* Calcular el total del corredor para porcentajes en el popup */
    _hectareasTotalHa = geojson.features.reduce(
      (sum, f) => sum + (f.properties?.SUM_AREA_HA ?? 0), 0,
    );

    if (!map.getSource('hectareas-cz')) {
      map.addSource('hectareas-cz', { type: 'geojson', data: geojson });
    }
    _addHectareasLayers(map);
    _hectareasReady = true;
    console.log('[geojson] Hectareas CZ lista:', geojson.features.length,
      'entidades | total corredor:', _hectareasTotalHa.toFixed(2), 'ha');
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
    const resp = await fetch(`${PATHS[sourceId]}?v=${BUILD_VERSION}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();

    if (sourceId === 'tributarios') {
      console.log('[geojson] tributario ejemplo:', geojson.features[0].properties);
    }

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

/* ── Estaciones calidad del agua (Río Cauca) ─────────────────────────── */

async function _loadEstacionesCauca(map) {
  try {
    const resp = await fetch(`${PATHS['estaciones-cauca']}?v=${BUILD_VERSION}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();

    const features = geojson.features.filter(
      f => f.properties?.CORRIENTE_PROY === 'Rio Cauca'
    );
    const data = { type: 'FeatureCollection', features };

    if (!map.getSource('estaciones-cauca')) {
      map.addSource('estaciones-cauca', { type: 'geojson', data });
    }

    if (!map.getLayer('estaciones-cauca-circle')) {
      map.addLayer({
        id:     'estaciones-cauca-circle',
        type:   'circle',
        source: 'estaciones-cauca',
        paint: {
          'circle-radius':       6,
          'circle-color':        '#FF6B35',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity':      0.9,
        },
      });
    }

    if (!map.getLayer('estaciones-cauca-label')) {
      map.addLayer({
        id:      'estaciones-cauca-label',
        type:    'symbol',
        source:  'estaciones-cauca',
        minzoom: 10,
        layout: {
          'text-field':  ['get', 'DESCRIPCION'],
          'text-size':   11,
          'text-font':   ['Open Sans Regular'],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: {
          'text-color':      '#FF6B35',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2,
        },
      });
    }

    console.log('[geojson] Estaciones Río Cauca:', features.length, 'puntos');
  } catch (err) {
    console.error('[geojson] Error cargando estaciones:', err);
  }
}

/* ── Estaciones calidad del agua (Ríos tributarios) ──────────────────── */

async function _loadEstacionesTrib(map) {
  try {
    const resp = await fetch(`${PATHS['estaciones-trib']}?v=${BUILD_VERSION}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();

    const features = geojson.features.filter(
      f => f.properties?.CORRIENTE_PROY !== 'Rio Cauca'
    );
    const data = { type: 'FeatureCollection', features };

    if (!map.getSource('estaciones-trib')) {
      map.addSource('estaciones-trib', { type: 'geojson', data });
    }

    if (!map.getLayer('estaciones-trib-circle')) {
      map.addLayer({
        id:     'estaciones-trib-circle',
        type:   'circle',
        source: 'estaciones-trib',
        paint: {
          'circle-radius':       6,
          'circle-color':        '#00BFA5',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity':      0.9,
        },
      });
    }

    if (!map.getLayer('estaciones-trib-label')) {
      map.addLayer({
        id:      'estaciones-trib-label',
        type:    'symbol',
        source:  'estaciones-trib',
        minzoom: 11,
        layout: {
          'text-field': [
            'case',
            ['all', ['has', 'DESCRIPCION'], ['!=', ['get', 'DESCRIPCION'], '<Null>']],
            ['get', 'DESCRIPCION'],
            ['get', 'MUNICIPIO'],
          ],
          'text-size':   10,
          'text-font':   ['Open Sans Regular'],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: {
          'text-color':      '#007A6E',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2,
        },
      });
    }

    console.log('[geojson] Estaciones tributarios:', features.length, 'puntos');
  } catch (err) {
    console.error('[geojson] Error cargando estaciones tributarios:', err);
  }
}

/* ── Estaciones hidrométricas (Río Cauca) ────────────────────────────── */

async function _loadEstacionesHidro(map) {
  try {
    const resp = await fetch(`${PATHS['estaciones-hidro']}?v=${BUILD_VERSION}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const items = await resp.json();

    /* Array de objetos → FeatureCollection de puntos */
    const features = items
      .filter(o => o.longitud != null && o.latitud != null)
      .map(o => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [o.longitud, o.latitud] },
        properties: o,
      }));
    const data = { type: 'FeatureCollection', features };

    if (!map.getSource('estaciones-hidro')) {
      map.addSource('estaciones-hidro', { type: 'geojson', data });
    }

    if (!map.getLayer('estaciones-hidro-circle')) {
      map.addLayer({
        id:     'estaciones-hidro-circle',
        type:   'circle',
        source: 'estaciones-hidro',
        paint: {
          'circle-radius':       7,
          'circle-color':        '#003F88',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          /* Suspendida → 0.4 · Activa (u otro) → 1.0 */
          'circle-opacity': [
            'case', ['==', ['get', 'estado'], 'Suspendida'], 0.4, 1.0,
          ],
          'circle-stroke-opacity': [
            'case', ['==', ['get', 'estado'], 'Suspendida'], 0.4, 1.0,
          ],
        },
      });
    }

    if (!map.getLayer('estaciones-hidro-label')) {
      map.addLayer({
        id:      'estaciones-hidro-label',
        type:    'symbol',
        source:  'estaciones-hidro',
        minzoom: 10,
        layout: {
          'text-field':  ['get', 'nombre_display'],
          'text-size':   11,
          'text-font':   ['Open Sans Regular'],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: {
          'text-color':      '#003F88',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2,
        },
      });
    }

    console.log('[geojson] Estaciones hidrométricas:', features.length, 'puntos');
  } catch (err) {
    console.error('[geojson] Error cargando estaciones hidrométricas:', err);
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
      paint: {
        'fill-color':   '#FBC4BB',
        'fill-opacity': 0.7,
      },
    },
    before,
  );

  /* Capa de highlight — encima de hectareas-fill, debajo de los ríos.
   * Filtro inicial vacío: no muestra nada hasta que se hace clic. */
  if (!map.getLayer('cana-highlight')) {
    map.addLayer(
      {
        id:     'cana-highlight',
        type:   'fill',
        source: 'hectareas-cz',
        filter: ['==', ['get', 'RIO'], ''],
        paint: {
          'fill-color':   '#00ddff',
          'fill-opacity': 0,
        },
      },
      before,
    );
  }
}

/* ── Highlight parpadeante de caña por río (efecto tipo ArcGIS) ──────── */
let _flashTimers = [];

export function flashCana(map, rioNombre) {
  if (!map.getLayer('cana-highlight') || !rioNombre) return;

  /* Cancelar cualquier parpadeo en curso para no encadenar estados */
  _flashTimers.forEach(clearTimeout);
  _flashTimers = [];

  map.setFilter('cana-highlight', ['==', ['get', 'RIO'], rioNombre]);

  const flashes  = [0.6, 0, 0.6, 0, 0.6, 0];
  const duracion = 200;   // ms por estado

  flashes.forEach((opacidad, i) => {
    const t = setTimeout(() => {
      if (!map.getLayer('cana-highlight')) return;
      map.setPaintProperty('cana-highlight', 'fill-opacity', opacidad);

      if (i === flashes.length - 1) {
        const tEnd = setTimeout(() => {
          if (!map.getLayer('cana-highlight')) return;
          map.setPaintProperty('cana-highlight', 'fill-opacity', 0);
          map.setFilter('cana-highlight', ['==', ['get', 'RIO'], '']);
        }, duracion);
        _flashTimers.push(tEnd);
      }
    }, i * duracion);
    _flashTimers.push(t);
  });
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

  try {
    if (!map.getLayer('tributarios-label')) {
      map.addLayer({
        id:     'tributarios-label',
        type:   'symbol',
        source: 'tributarios',
        layout: {
          'symbol-placement':      'point',
          'text-field':            ['get', 'NOM1_DRENA'],
          'text-size':             12,
          'text-font':             ['Open Sans Regular'],
          'text-allow-overlap':    true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color':      '#0077FF',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 3,
          'text-halo-blur':  1,
        },
      });
    }
  } catch (err) {
    console.warn('[geojson] tributarios-label no disponible:', err);
  }
}
