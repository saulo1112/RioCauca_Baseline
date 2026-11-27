/* CutLineTool.js — Herramienta de tramos y caña de azúcar.
 *
 * Muestra, para cada tributario, el buffer de 700 m partido en los tramos del
 * Informe Fase 1 (Tabla 4.21) y las hectáreas de caña de cada tramo. Los
 * tramos se pueden editar (corte en una estación o dibujado a mano) y volver
 * en cualquier momento a los del informe.
 *
 * Todo el cálculo ocurre en el navegador (el visor es un sitio estático sin
 * backend), con Turf.js sobre los GeoJSON en WGS84 ya cargados por geojson.js.
 *
 * Ver src/tramos/geometry.js para la geometría y src/tramos/stations.js para
 * el etiquetado de tramos.
 */

/* global turf */

import {
  ensureHectareasLoaded, getBufferData, getHectareasData, getPriorizacionData,
  getTributariosData, getRioCaucaData, getEstacionesTribData, BUILD_VERSION,
} from '../layers/geojson.js';
import { setInfoPanelEnabled } from './InfoPanel.js';
import { fmt, escapeHtml, csvCell } from '../utils/format.js';
import { geojsonBbox } from '../utils/bounds.js';
import {
  turfReady, areaHa, prepareCana, canaAreaInFragment, splitBufferByCuts,
  orientAxisDownstream, validateCut, perpendicularAt,
} from '../tramos/geometry.js';
import {
  normalizeRiver, findByRiver, stationsAlongAxis, labelFragments,
} from '../tramos/stations.js';

/* Cortes del informe, versionados en el repo. Se cargan al arrancar y son el
 * estado inicial de cada río; el botón «Tramos del informe» vuelve a ellos. */
const CORTES_PATH = 'data/cartografia/cortes_tramos.geojson';

/* Paleta de los tramos, de aguas arriba a aguas abajo. */
const TRAMO_COLORS = ['#FFB300', '#26C6DA', '#AB47BC', '#66BB6A', '#EF5350', '#5C6BC0'];

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

/* ── Estado del módulo ───────────────────────────────────────────────── */
let _map = null;
let _panel = null;
let _open = false;

let _river = 'Rio Bolo';
let _cutsByRiver = {};        // { claveNormalizada: [Feature<LineString>, …] } — estado actual
let _officialByRiver = {};    // mismos cortes, tal como vienen del informe
let _ctxCache = {};           // { claveNormalizada: contexto del río }
let _results = null;          // último cálculo, para exportar
let _hoverId = null;          // tramo resaltado en el mapa

/* Estado del dibujo a mano */
let _drawing = false;
let _firstPoint = null;
let _onClick = null;
let _onMove = null;
let _onKey = null;

/* ── API pública ─────────────────────────────────────────────────────── */

export function init(map) {
  _map = map;
  _addLayers(map);
  _buildPanel();
  _bindMapEvents(map);
  _loadSavedCuts();
}

export function open() {
  if (!_panel) return;
  if (!turfReady()) {
    _setStatus('Turf.js no se cargó. Revisa la conexión y recarga la página.', true);
  }
  _open = true;
  _panel.classList.add('visible');
  /* Con la herramienta abierta, el clic sobre el mapa selecciona tramos en
   * vez de abrir la ficha de la capa que esté debajo. */
  setInfoPanelEnabled(false);
  _populateRivers();
  _refresh({ fit: true });
}

export function close() {
  _stopDrawing();
  _open = false;
  _panel?.classList.remove('visible');
  _setHover(null);
  _setSourceData('tramos-frag', EMPTY_FC);
  _setSourceData('tramos-label', EMPTY_FC);
  _setSourceData('tramos-cortes', EMPTY_FC);
  setInfoPanelEnabled(true);
}

export function toggle() { _open ? close() : open(); }

/* ── Capas del mapa ──────────────────────────────────────────────────── */

function _addLayers(map) {
  const add = (id, data) => {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data });
  };
  add('tramos-frag', EMPTY_FC);
  add('tramos-label', EMPTY_FC);
  add('tramos-cortes', EMPTY_FC);
  add('tramos-draft', EMPTY_FC);

  /* Los tramos se insertan bajo la línea del río para no taparla. */
  const before = map.getLayer('rio-cauca-halo') ? 'rio-cauca-halo' : undefined;

  if (!map.getLayer('tramos-frag-fill')) {
    map.addLayer({
      id: 'tramos-frag-fill',
      type: 'fill',
      source: 'tramos-frag',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.6, 0.3],
      },
    }, before);
  }

  if (!map.getLayer('tramos-frag-outline')) {
    map.addLayer({
      id: 'tramos-frag-outline',
      type: 'line',
      source: 'tramos-frag',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 3, 1.5],
      },
    }, before);
  }

  if (!map.getLayer('tramos-cortes-line')) {
    map.addLayer({
      id: 'tramos-cortes-line',
      type: 'line',
      source: 'tramos-cortes',
      paint: { 'line-color': '#FF1744', 'line-width': 3 },
    });
  }

  /* Número de tramo sobre cada fragmento, igual al de la tabla del panel. */
  if (!map.getLayer('tramos-label-text')) {
    map.addLayer({
      id: 'tramos-label-text',
      type: 'symbol',
      source: 'tramos-label',
      layout: {
        'text-field': ['get', 'texto'],
        'text-size': 13,
        'text-font': ['Open Sans Regular'],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#111',
        'text-halo-color': ['get', 'color'],
        'text-halo-width': 3,
      },
    });
  }

  if (!map.getLayer('tramos-draft-line')) {
    map.addLayer({
      id: 'tramos-draft-line',
      type: 'line',
      source: 'tramos-draft',
      paint: { 'line-color': '#FF1744', 'line-width': 2, 'line-dasharray': [2, 2] },
    });
  }
}

function _setSourceData(id, data) {
  _map?.getSource(id)?.setData(data);
}

/* Pasar el cursor sobre un tramo del mapa lo resalta también en la tabla, y
 * un clic lo selecciona. */
function _bindMapEvents(map) {
  map.on('mousemove', 'tramos-frag-fill', e => {
    if (!_open || _drawing) return;
    map.getCanvas().style.cursor = 'pointer';
    _setHover(e.features?.[0]?.id ?? null);
  });
  map.on('mouseleave', 'tramos-frag-fill', () => {
    if (!_open || _drawing) return;
    map.getCanvas().style.cursor = '';
    _setHover(null);
  });
  map.on('click', 'tramos-frag-fill', e => {
    if (!_open || _drawing) return;
    const id = e.features?.[0]?.id;
    _panel.querySelector(`tr[data-indice="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    _setHover(id ?? null);
  });
}

function _setHover(id) {
  if (_hoverId != null && _map.getSource('tramos-frag')) {
    _map.setFeatureState({ source: 'tramos-frag', id: _hoverId }, { hover: false });
  }
  _hoverId = id;
  if (id != null) _map.setFeatureState({ source: 'tramos-frag', id }, { hover: true });
  _panel?.querySelectorAll('#ct-body tr').forEach(tr =>
    tr.classList.toggle('ct-row-hover', Number(tr.dataset.indice) === id));
}

/* ── Panel de la herramienta ─────────────────────────────────────────── */

function _buildPanel() {
  _panel = document.createElement('div');
  _panel.className = 'ct-panel';
  _panel.innerHTML = `
    <button class="ct-close" type="button" title="Cerrar">✕</button>
    <div class="ct-title">Tramos y caña de azúcar</div>

    <div class="ct-row">
      <label class="ct-label" for="ct-river">Río</label>
      <select id="ct-river" class="ct-select"></select>
    </div>

    <div id="ct-source" class="ct-source"></div>

    <table class="ct-table">
      <thead>
        <tr>
          <th>Tramo</th>
          <th class="ct-num">Buffer<br>(ha)</th>
          <th class="ct-num">Caña<br>(ha)</th>
          <th class="ct-num ct-col-pct">% de la caña<br>del río</th>
        </tr>
      </thead>
      <tbody id="ct-body"></tbody>
      <tfoot id="ct-foot"></tfoot>
    </table>

    <div id="ct-qa" class="ct-qa"></div>

    <details class="ct-edit">
      <summary>Editar tramos</summary>
      <div class="ct-row">
        <label class="ct-label" for="ct-station">Estación</label>
        <select id="ct-station" class="ct-select"></select>
      </div>
      <div class="ct-actions">
        <button id="ct-auto"  class="ct-btn ct-btn-primary" type="button">Cortar en la estación</button>
        <button id="ct-draw"  class="ct-btn" type="button">Dibujar corte</button>
        <button id="ct-clear" class="ct-btn ct-btn-danger" type="button">Borrar cortes</button>
      </div>
    </details>

    <div id="ct-status" class="ct-status"></div>

    <div class="ct-actions ct-actions-export">
      <button id="ct-csv"  class="ct-btn" type="button">⬇ Descargar CSV</button>
      <button id="ct-save" class="ct-btn" type="button">⬇ Descargar cortes (GeoJSON)</button>
    </div>
  `;
  document.querySelector('.map-container')?.appendChild(_panel);

  _panel.querySelector('.ct-close').addEventListener('click', close);
  _panel.querySelector('#ct-river').addEventListener('change', e => {
    _river = e.target.value;
    _stopDrawing();
    _refresh({ fit: true });
  });
  _panel.querySelector('#ct-auto').addEventListener('click', _addAutoCut);
  _panel.querySelector('#ct-draw').addEventListener('click', _toggleDrawing);
  _panel.querySelector('#ct-clear').addEventListener('click', () => {
    _cutsByRiver[normalizeRiver(_river)] = [];
    _stopDrawing();
    _refresh();
  });
  _panel.querySelector('#ct-source').addEventListener('click', e => {
    if (e.target.closest('#ct-restore')) _restoreOfficial();
  });
  _panel.querySelector('#ct-csv').addEventListener('click', _downloadCSV);
  _panel.querySelector('#ct-save').addEventListener('click', _downloadCuts);
}

function _setStatus(msg, isError = false) {
  const el = _panel?.querySelector('#ct-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('ct-status-error', isError);
}

/* Ríos que tienen a la vez buffer, eje tributario y caña asignada.
 * El Río Cauca queda fuera: su eje son 43 LineStrings sueltas, no una sola,
 * así que no se puede ordenar tramos a lo largo de él. */
function _availableRivers() {
  const buffers = getBufferData();
  const trib = getTributariosData();
  const cana = getHectareasData();
  if (!buffers || !trib) return [];

  const tribKeys = new Set(trib.features.map(f => normalizeRiver(f.properties?.NOM1_DRENA)));
  const canaKeys = cana
    ? new Set(cana.features.map(f => normalizeRiver(f.properties?.RIO)))
    : null;

  return buffers.features
    .map(f => f.properties?.NOM1_DRENA)
    .filter(Boolean)
    .filter(name => {
      const k = normalizeRiver(name);
      return tribKeys.has(k) && (!canaKeys || canaKeys.has(k));
    })
    .sort((a, b) => a.localeCompare(b, 'es'));
}

function _populateRivers() {
  const sel = _panel?.querySelector('#ct-river');
  if (!sel) return;
  const rivers = _availableRivers();
  if (!rivers.length) return;

  if (!rivers.some(r => normalizeRiver(r) === normalizeRiver(_river))) {
    _river = rivers[0];
  }
  sel.innerHTML = rivers
    .map(r => `<option value="${escapeHtml(r)}"${
      normalizeRiver(r) === normalizeRiver(_river) ? ' selected' : ''}>${escapeHtml(r)}</option>`)
    .join('');
}

/* ── Contexto de cálculo de un río ───────────────────────────────────── */

/* Reúne buffer, eje orientado aguas abajo, caña y estaciones. Devuelve null
 * con un mensaje en el panel si falta alguna pieza.
 *
 * Se cachea por río: orientar el eje cuesta ~1,2 s (compara sus dos extremos
 * contra las 43 líneas del Río Cauca) y no cambia nunca, mientras que esta
 * función se invoca varias veces por cada corte añadido. */
async function _riverContext() {
  const key = normalizeRiver(_river);
  if (_ctxCache[key]) return _ctxCache[key];

  const buffer = findByRiver(getBufferData(), 'NOM1_DRENA', _river);
  if (!buffer) { _setStatus(`Sin polígono de buffer para ${_river}.`, true); return null; }

  const axisRaw = findByRiver(getTributariosData(), 'NOM1_DRENA', _river);
  if (!axisRaw) { _setStatus(`Sin eje de cauce para ${_river}.`, true); return null; }

  await ensureHectareasLoaded(_map);
  const cana = findByRiver(getHectareasData(), 'RIO', _river);
  if (!cana) { _setStatus(`Sin capa de caña para ${_river}.`, true); return null; }

  const rioCauca = getRioCaucaData();
  const { axis, reversed } = rioCauca
    ? orientAxisDownstream(axisRaw, rioCauca)
    : { axis: axisRaw, reversed: false };
  console.log(`[tramos] ${_river}: eje ${reversed ? 'invertido' : 'ya'} en sentido de flujo`,
    `(${turf.length(axis, { units: 'kilometers' }).toFixed(1)} km)`);

  _ctxCache[key] = {
    buffer, axis, cana,
    canaParts: prepareCana(cana),
    oficialHa: cana.properties?.SUM_AREA_HA ?? null,
    stations: stationsAlongAxis(getEstacionesTribData(), axis, _river),
  };
  return _ctxCache[key];
}

/* ── Recalcular y repintar ───────────────────────────────────────────── */

async function _refresh({ fit = false } = {}) {
  if (!_open || !turfReady()) return;

  const ctx = await _riverContext();
  if (!ctx) { _renderEmpty(); return; }

  _populateStations(ctx.stations);

  const key = normalizeRiver(_river);
  const cuts = _cutsByRiver[key] ?? [];
  _setSourceData('tramos-cortes', { type: 'FeatureCollection', features: cuts });

  const t0 = performance.now();

  /* Con los cortes del informe se muestran los tramos y las cifras de la
   * Tabla 4.21 tal cual; recalcularlos aquí daría diferencias de décimas de
   * hectárea, porque el navegador parte el buffer con otro método que el
   * pipeline (scripts/tramos/segmentacion.mjs). */
  const informe = _isOfficial(key) ? _officialRows(_river) : null;

  let rows, factor = 1, cierre = 1, canaRawHa = null;
  if (informe) {
    rows = informe;
  } else {
    /* Área geodésica cruda de toda la caña del río; es el denominador del
     * factor de normalización y de la métrica de cierre. */
    canaRawHa = ctx.canaParts.reduce((s, p) => s + p.areaHa, 0);
    factor = ctx.oficialHa != null && canaRawHa > 0 ? ctx.oficialHa / canaRawHa : 1;

    const fragments = splitBufferByCuts(ctx.buffer, cuts, ctx.axis);
    const labeled = labelFragments(fragments, ctx.stations);

    rows = labeled.map((frag, i) => {
      const { ha, nContained, nIntersect } = canaAreaInFragment(frag, ctx.canaParts);
      return {
        ...frag,
        color: TRAMO_COLORS[i % TRAMO_COLORS.length],
        bufferHa: areaHa(frag.polygon),
        canaRawHa: ha,
        canaNormHa: ha * factor,
        pctRio: ctx.oficialHa ? ha * factor / ctx.oficialHa * 100 : null,
        nContained, nIntersect,
      };
    });

    const sumRaw = rows.reduce((s, r) => s + r.canaRawHa, 0);
    cierre = canaRawHa > 0 ? sumRaw / canaRawHa : 0;
  }

  _results = {
    river: _river, rows, factor, cierre, canaRawHa, informe: !!informe,
    oficialHa: ctx.oficialHa, cuts,
    ms: performance.now() - t0,
  };

  _hoverId = null;
  _paintFragments(rows);
  _renderTable(_results);
  _renderSource();

  if (fit) {
    const [w, s, e, n] = geojsonBbox(ctx.buffer);
    const panelW = _panel.offsetWidth || 430;
    _map.fitBounds([[w, s], [e, n]], {
      padding: { top: 40, bottom: 40, left: 40, right: panelW + 40 },
      duration: 900,
    });
  }

  console.log(`[tramos] ${_river}: ${rows.length} tramos en ${_results.ms.toFixed(0)} ms`,
    `| cierre ${(cierre * 100).toFixed(3)} % | factor ${factor.toFixed(5)}`);
}

function _paintFragments(rows) {
  _setSourceData('tramos-frag', {
    type: 'FeatureCollection',
    features: rows.map(r => ({
      type: 'Feature',
      id: r.indice,   // necesario para el resaltado con feature-state
      geometry: r.polygon.geometry,
      properties: {
        color: r.color,
        tramo: r.etiqueta,
        indice: r.indice,
        cana_ha: Number(r.canaNormHa.toFixed(2)),
      },
    })),
  });
  _setSourceData('tramos-label', {
    type: 'FeatureCollection',
    features: rows.map(r => ({
      ...turf.pointOnFeature(r.polygon),
      properties: { texto: String(r.indice), color: r.color },
    })),
  });
}

function _populateStations(stations) {
  const sel = _panel?.querySelector('#ct-station');
  if (!sel) return;

  /* Solo las intermedias: los extremos ya son el límite natural del buffer. */
  const intermedias = stations.slice(1, -1);
  const prev = sel.value;

  sel.innerHTML = intermedias.length
    ? intermedias.map((s, i) =>
        `<option value="${i}">${escapeHtml(s.corto)} · km ${s.km.toFixed(1)}</option>`).join('')
    : '<option value="">— sin estaciones intermedias —</option>';

  sel.disabled = intermedias.length === 0;
  if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
  sel._stations = intermedias;
}

function _renderEmpty() {
  _panel.querySelector('#ct-body').innerHTML = '';
  _panel.querySelector('#ct-foot').innerHTML = '';
  _panel.querySelector('#ct-qa').innerHTML = '';
  _panel.querySelector('#ct-source').innerHTML = '';
  _setSourceData('tramos-frag', EMPTY_FC);
  _setSourceData('tramos-label', EMPTY_FC);
}

/* Tramos del informe de un río, con sus polígonos y cifras publicadas
 * (data/cartografia/Priorizacion_NP_tramos.geojson, que reproduce la
 * Tabla 4.21). null si el río no figura. */
function _officialRows(river) {
  const key = normalizeRiver(river);
  const feats = (getPriorizacionData()?.features ?? [])
    .filter(f => normalizeRiver(f.properties?.rio) === key)
    .sort((a, b) => a.properties.tramo - b.properties.tramo);
  if (!feats.length) return null;

  return feats.map((f, i) => {
    const p = f.properties;
    return {
      polygon: f,
      indice: i + 1,
      color: TRAMO_COLORS[i % TRAMO_COLORS.length],
      kmInicio: p.km_inicio,
      kmFin: p.km_fin,
      bufferHa: p.buffer_ha,
      canaRawHa: null,
      canaNormHa: p.area_cana_ha,
      pctRio: p.pct_del_rio,
      estacionArribaFull: p.estacion_arriba,
      estacionAbajoFull: p.estacion_abajo,
      etiqueta: `${p.estacion_arriba} → ${p.estacion_abajo}`,
    };
  });
}

/* ¿Los cortes actuales del río son exactamente los del informe? */
function _isOfficial(key) {
  const a = _cutsByRiver[key] ?? [];
  const b = _officialByRiver[key] ?? [];
  if (a.length !== b.length) return false;
  return a.every((f, i) =>
    JSON.stringify(f.geometry?.coordinates) === JSON.stringify(b[i].geometry?.coordinates));
}

function _renderSource() {
  const el = _panel.querySelector('#ct-source');
  const key = normalizeRiver(_river);
  if (!(key in _officialByRiver)) { el.innerHTML = ''; return; }

  el.innerHTML = _isOfficial(key)
    ? `<span class="ct-badge ct-badge-ok">✓ Tramos oficiales</span>
       <span class="ct-source-note">Cortes en las estaciones de calidad del agua</span>`
    : `<span class="ct-badge ct-badge-edit">Tramos editados</span>
       <button id="ct-restore" class="ct-link" type="button">↺ Volver a los tramos oficiales</button>`;
}

function _restoreOfficial() {
  const key = normalizeRiver(_river);
  _cutsByRiver[key] = structuredClone(_officialByRiver[key] ?? []);
  _stopDrawing();
  _setStatus('');
  _refresh();
}

function _renderTable(res) {
  const body = _panel.querySelector('#ct-body');
  const foot = _panel.querySelector('#ct-foot');
  const qa = _panel.querySelector('#ct-qa');

  body.innerHTML = res.rows.map(r => {
    const pct = r.pctRio;
    return `
    <tr data-indice="${r.indice}" title="${escapeHtml(r.estacionArribaFull)} → ${
      escapeHtml(r.estacionAbajoFull)}">
      <td>
        <span class="ct-dot" style="background:${r.color}">${r.indice}</span>
        <span class="ct-tramo">${escapeHtml(r.etiqueta)}</span>
        <span class="ct-km">km ${r.kmInicio.toFixed(1)}–${r.kmFin.toFixed(1)}</span>
      </td>
      <td class="ct-num">${fmt(r.bufferHa, 1)}</td>
      <td class="ct-num ct-strong">${fmt(r.canaNormHa, 1)}</td>
      <td class="ct-num ct-col-pct">
        ${pct != null ? `<span class="ct-bar"><span style="width:${Math.min(pct, 100).toFixed(1)}%;background:${r.color}"></span></span>${fmt(pct, 1)}` : '—'}
      </td>
    </tr>`;
  }).join('');

  const sumBuffer = res.rows.reduce((s, r) => s + r.bufferHa, 0);
  const sumNorm = res.rows.reduce((s, r) => s + r.canaNormHa, 0);

  foot.innerHTML = `
    <tr>
      <td><strong>Total del río</strong></td>
      <td class="ct-num">${fmt(sumBuffer, 1)}</td>
      <td class="ct-num ct-strong">${fmt(sumNorm, 1)}</td>
      <td class="ct-num ct-col-pct">${res.oficialHa ? '100.0' : '—'}</td>
    </tr>
  `;

  const cierrePct = res.cierre * 100;
  const cierreOk = cierrePct > 99.9 && cierrePct < 100.1;
  qa.innerHTML = res.informe
    ? ''
    : cierreOk
      ? `<span class="ct-ok">✓</span> Calculado en el visor: la suma de los tramos reproduce el ${fmt(cierrePct, 1)} % de la caña del río.`
      : `<span class="ct-warn">⚠</span> La suma de los tramos cubre el ${fmt(cierrePct, 1)} % de la caña del río: revisa los cortes.`;

  /* Fila ↔ mapa: pasar el cursor resalta el tramo; clic lo encuadra. */
  body.querySelectorAll('tr').forEach(tr => {
    const id = Number(tr.dataset.indice);
    tr.addEventListener('mouseenter', () => _setHover(id));
    tr.addEventListener('mouseleave', () => _setHover(null));
    tr.addEventListener('click', () => {
      const row = res.rows.find(r => r.indice === id);
      if (!row) return;
      const [w, s, e, n] = geojsonBbox(row.polygon);
      _map.fitBounds([[w, s], [e, n]], {
        padding: { top: 60, bottom: 60, left: 60, right: (_panel.offsetWidth || 430) + 60 },
        duration: 800,
      });
    });
  });

  if (res.cuts.length > 0) {
    _setStatus('');
  } else if (_isOfficial(normalizeRiver(res.river))) {
    _setStatus('Este río se analiza como un solo tramo.');
  } else {
    _setStatus('Sin cortes: el río se muestra como un solo tramo.');
  }
}

/* ── Añadir cortes ───────────────────────────────────────────────────── */

async function _addCut(line) {
  const ctx = await _riverContext();
  if (!ctx) return;

  const check = validateCut(line, ctx.buffer);
  if (!check.ok) { _setStatus(check.message, true); return; }

  const key = normalizeRiver(_river);
  if (!_cutsByRiver[key]) _cutsByRiver[key] = [];

  line.properties = { ...(line.properties ?? {}), rio: _river };
  _cutsByRiver[key].push(line);
  _setStatus('');
  await _refresh();

  /* _refresh sobrescribe el estado, así que la advertencia va después. */
  if (check.warning) _setStatus(check.message, true);
}

async function _addAutoCut() {
  const sel = _panel.querySelector('#ct-station');
  const stations = sel?._stations ?? [];
  const station = stations[Number(sel.value)];
  if (!station) { _setStatus('No hay estaciones intermedias en este río.', true); return; }

  const ctx = await _riverContext();
  if (!ctx) return;

  /* 2 km cubren de sobra los 1,4 km de ancho del buffer. */
  const line = perpendicularAt(ctx.axis, station.feature, 2);
  line.properties = { estacion: station.nombre, tipo: 'auto' };
  _addCut(line);
}

/* ── Dibujo a mano (2 clics) ─────────────────────────────────────────── */

function _toggleDrawing() {
  _drawing ? _stopDrawing() : _startDrawing();
}

function _startDrawing() {
  if (!_map) return;
  _drawing = true;
  _firstPoint = null;
  _map.getCanvas().style.cursor = 'crosshair';
  _panel.querySelector('#ct-draw').classList.add('ct-btn-active');
  _setStatus('Clic en un extremo del corte y luego en el otro. Esc cancela.');

  _onClick = e => {
    const pt = [e.lngLat.lng, e.lngLat.lat];
    if (!_firstPoint) {
      _firstPoint = pt;
      return;
    }
    const line = turf.lineString([_firstPoint, pt]);
    _stopDrawing();
    _addCut(line);
  };

  _onMove = e => {
    if (!_firstPoint) return;
    _setSourceData('tramos-draft', turf.lineString(
      [_firstPoint, [e.lngLat.lng, e.lngLat.lat]]));
  };

  _onKey = e => { if (e.key === 'Escape') _stopDrawing(); };

  _map.on('click', _onClick);
  _map.on('mousemove', _onMove);
  document.addEventListener('keydown', _onKey);
}

function _stopDrawing() {
  if (!_drawing) return;
  _drawing = false;
  _firstPoint = null;

  if (_onClick) _map.off('click', _onClick);
  if (_onMove) _map.off('mousemove', _onMove);
  if (_onKey) document.removeEventListener('keydown', _onKey);
  _onClick = _onMove = _onKey = null;

  _setSourceData('tramos-draft', EMPTY_FC);
  _map.getCanvas().style.cursor = '';
  _panel?.querySelector('#ct-draw')?.classList.remove('ct-btn-active');
  _setStatus('');
}

/* ── Exportación ─────────────────────────────────────────────────────── */

function _download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function _safeName(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
}

function _downloadCSV() {
  if (!_results?.rows.length) { _setStatus('Nada que exportar todavía.', true); return; }
  const r = _results;

  const header = [
    'rio', 'tramo', 'n', 'estacion_aguas_arriba', 'estacion_aguas_abajo',
    'km_inicio', 'km_fin', 'area_buffer_ha', 'cana_ha',
    'pct_cana_del_rio', 'pct_cobertura_tramo',
  ];

  const lines = [header.join(',')];
  for (const row of r.rows) {
    lines.push([
      csvCell(r.river),
      csvCell(row.etiqueta),
      row.indice,
      csvCell(row.estacionArribaFull),
      csvCell(row.estacionAbajoFull),
      row.kmInicio.toFixed(3),
      row.kmFin.toFixed(3),
      row.bufferHa.toFixed(2),
      row.canaNormHa.toFixed(r.informe ? 1 : 2),
      row.pctRio != null ? row.pctRio.toFixed(r.informe ? 1 : 2) : '',
      row.bufferHa > 0 ? (row.canaNormHa / row.bufferHa * 100).toFixed(2) : '',
    ].join(','));
  }

  /* Metadatos de trazabilidad: sin esto las cifras no son auditables. */
  lines.push('');
  lines.push(`# rio,${csvCell(r.river)}`);
  if (r.informe) {
    lines.push('# origen,tramos oficiales del proyecto');
  } else {
    lines.push('# origen,tramos editados en el visor - caña calculada en el navegador');
    lines.push(`# total_oficial_arcgis_ha,${r.oficialHa ?? ''}`);
    lines.push(`# total_geodesico_turf_ha,${r.canaRawHa.toFixed(2)}`);
    lines.push(`# factor_normalizacion,${r.factor.toFixed(6)}`);
    lines.push(`# cierre_geometrico_pct,${(r.cierre * 100).toFixed(4)}`);
  }
  lines.push(`# generado,${new Date().toISOString()}`);

  _download(lines.join('\n'), `tramos_cana_${_safeName(r.river)}.csv`,
    'text/csv;charset=utf-8');
}

/* Exporta los cortes de todos los ríos, en el mismo formato del archivo
 * versionado, para poder abrirlos en ArcGIS o compartirlos. */
function _downloadCuts() {
  const features = Object.values(_cutsByRiver).flat();
  if (!features.length) { _setStatus('No hay cortes que descargar.', true); return; }

  _download(JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    'cortes_tramos.geojson', 'application/geo+json');
  const nRios = Object.values(_cutsByRiver).filter(c => c.length).length;
  _setStatus(`Se descargaron ${features.length} cortes de ${nRios} ríos (cortes_tramos.geojson).`);
}

/* Carga de los cortes del informe. El `?v=` es obligatorio, igual que en el
 * resto de capas: este archivo cambia cada vez que se recalculan los tramos,
 * y sin sello de versión el navegador sirve la copia anterior. */
async function _loadSavedCuts() {
  try {
    const resp = await fetch(`${CORTES_PATH}?v=${BUILD_VERSION}`);
    if (!resp.ok) return;
    const fc = await resp.json();
    const byRiver = {};
    for (const f of fc.features ?? []) {
      if (f.geometry?.type !== 'LineString') continue;
      const key = normalizeRiver(f.properties?.rio);
      if (key) (byRiver[key] ??= []).push(f);
    }
    /* Los ríos sin estaciones intermedias (Guabas, Guachal, Nima) también
     * tienen tramos «del informe»: uno solo, sin cortes. */
    for (const name of (getBufferData()?.features ?? []).map(f => f.properties?.NOM1_DRENA)) {
      const key = normalizeRiver(name);
      if (key && key !== 'cauca') byRiver[key] ??= [];
    }
    _officialByRiver = structuredClone(byRiver);
    _cutsByRiver = byRiver;
    console.log(`[tramos] ${Object.values(byRiver).flat().length} cortes cargados de ${CORTES_PATH}`);
    if (_open) _refresh();
  } catch (err) {
    console.error('[tramos] No se pudieron cargar los cortes del informe:', err);
  }
}
