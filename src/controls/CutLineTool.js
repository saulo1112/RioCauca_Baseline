/* CutLineTool.js — Herramienta de corte de tramos y cálculo de caña.
 *
 * Permite dibujar líneas de corte perpendiculares al cauce sobre el buffer de
 * 700 m de un río tributario, partirlo en tramos y calcular las hectáreas de
 * caña de azúcar dentro de cada tramo.
 *
 * Todo el cálculo ocurre en el navegador (el visor es un sitio estático sin
 * backend), con Turf.js sobre los GeoJSON en WGS84 ya cargados por geojson.js.
 *
 * Ver src/tramos/geometry.js para la geometría y src/tramos/stations.js para
 * el etiquetado de tramos.
 */

/* global turf */

import {
  ensureHectareasLoaded, getBufferData, getHectareasData,
  getTributariosData, getRioCaucaData, getEstacionesTribData,
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

/* Archivo de cortes versionado en el repo. Si existe, se carga al arrancar
 * para que los resultados publicados sean reproducibles. */
const CORTES_PATH = 'data/cortes_tramos.geojson';

/* Paleta de los tramos, de aguas arriba a aguas abajo. */
const TRAMO_COLORS = ['#FFB300', '#26C6DA', '#AB47BC', '#66BB6A', '#EF5350', '#5C6BC0'];

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

/* ── Estado del módulo ───────────────────────────────────────────────── */
let _map = null;
let _panel = null;
let _open = false;

let _river = 'Rio Bolo';
let _cutsByRiver = {};        // { claveNormalizada: [Feature<LineString>, …] }
let _ctxCache = {};           // { claveNormalizada: contexto del río }
let _results = null;          // último cálculo, para exportar

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
  _loadSavedCuts();
}

export function open() {
  if (!_panel) return;
  if (!turfReady()) {
    _setStatus('Turf.js no se cargó. Revisa la conexión y recarga la página.', true);
  }
  _open = true;
  _panel.classList.add('visible');
  _populateRivers();
  _refresh();
}

export function close() {
  _stopDrawing();
  _open = false;
  _panel?.classList.remove('visible');
  _setSourceData('tramos-frag', EMPTY_FC);
  _setSourceData('tramos-cortes', EMPTY_FC);
}

export function toggle() { _open ? close() : open(); }

/* ── Capas del mapa ──────────────────────────────────────────────────── */

function _addLayers(map) {
  const add = (id, data) => {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data });
  };
  add('tramos-frag', EMPTY_FC);
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
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.55, 0.3],
      },
    }, before);
  }

  if (!map.getLayer('tramos-frag-outline')) {
    map.addLayer({
      id: 'tramos-frag-outline',
      type: 'line',
      source: 'tramos-frag',
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.5 },
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

    <div class="ct-row">
      <label class="ct-label" for="ct-station">Estación</label>
      <select id="ct-station" class="ct-select"></select>
    </div>

    <div class="ct-actions">
      <button id="ct-auto"  class="ct-btn ct-btn-primary" type="button">Corte en estación</button>
      <button id="ct-draw"  class="ct-btn" type="button">Dibujar corte</button>
      <button id="ct-clear" class="ct-btn ct-btn-danger" type="button">Borrar cortes</button>
    </div>

    <div id="ct-status" class="ct-status"></div>

    <table class="ct-table">
      <thead>
        <tr>
          <th>Tramo</th>
          <th class="ct-num">Buffer<br>(ha)</th>
          <th class="ct-num">Caña cruda<br>(ha)</th>
          <th class="ct-num">Caña norm.<br>(ha)</th>
          <th class="ct-num">% río</th>
        </tr>
      </thead>
      <tbody id="ct-body"></tbody>
      <tfoot id="ct-foot"></tfoot>
    </table>

    <div id="ct-qa" class="ct-qa"></div>

    <div class="ct-actions ct-actions-export">
      <button id="ct-csv"    class="ct-btn" type="button">⬇ CSV</button>
      <button id="ct-save"   class="ct-btn" type="button">⬇ Cortes</button>
      <button id="ct-load"   class="ct-btn" type="button">⬆ Cargar</button>
      <button id="ct-poly"   class="ct-btn" type="button">⬇ Polígonos</button>
      <input  id="ct-file" type="file" accept=".geojson,.json" hidden>
    </div>
  `;
  document.querySelector('.map-container')?.appendChild(_panel);

  _panel.querySelector('.ct-close').addEventListener('click', close);
  _panel.querySelector('#ct-river').addEventListener('change', e => {
    _river = e.target.value;
    _stopDrawing();
    _refresh();
  });
  _panel.querySelector('#ct-auto').addEventListener('click', _addAutoCut);
  _panel.querySelector('#ct-draw').addEventListener('click', _toggleDrawing);
  _panel.querySelector('#ct-clear').addEventListener('click', () => {
    _cutsByRiver[normalizeRiver(_river)] = [];
    _stopDrawing();
    _refresh();
  });
  _panel.querySelector('#ct-csv').addEventListener('click', _downloadCSV);
  _panel.querySelector('#ct-save').addEventListener('click', _downloadCuts);
  _panel.querySelector('#ct-poly').addEventListener('click', _downloadPolygons);
  _panel.querySelector('#ct-load').addEventListener('click',
    () => _panel.querySelector('#ct-file').click());
  _panel.querySelector('#ct-file').addEventListener('change', _importCuts);
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

async function _refresh() {
  if (!_open || !turfReady()) return;

  const ctx = await _riverContext();
  if (!ctx) { _renderEmpty(); return; }

  _populateStations(ctx.stations);

  const cuts = _cutsByRiver[normalizeRiver(_river)] ?? [];
  _setSourceData('tramos-cortes', { type: 'FeatureCollection', features: cuts });

  const t0 = performance.now();

  /* Área geodésica cruda de toda la caña del río; es el denominador del
   * factor de normalización y de la métrica de cierre. */
  const canaRawHa = ctx.canaParts.reduce((s, p) => s + p.areaHa, 0);
  const factor = ctx.oficialHa != null && canaRawHa > 0 ? ctx.oficialHa / canaRawHa : 1;

  const fragments = splitBufferByCuts(ctx.buffer, cuts, ctx.axis);
  const labeled = labelFragments(fragments, ctx.stations);

  const rows = labeled.map((frag, i) => {
    const { ha, nContained, nIntersect } = canaAreaInFragment(frag, ctx.canaParts);
    return {
      ...frag,
      color: TRAMO_COLORS[i % TRAMO_COLORS.length],
      bufferHa: areaHa(frag.polygon),
      canaRawHa: ha,
      canaNormHa: ha * factor,
      nContained, nIntersect,
    };
  });

  const sumRaw = rows.reduce((s, r) => s + r.canaRawHa, 0);
  const cierre = canaRawHa > 0 ? sumRaw / canaRawHa : 0;

  _results = {
    river: _river, rows, factor, cierre, canaRawHa,
    oficialHa: ctx.oficialHa, cuts,
    ms: performance.now() - t0,
  };

  _paintFragments(rows);
  _renderTable(_results);

  console.log(`[tramos] ${_river}: ${rows.length} tramos en ${_results.ms.toFixed(0)} ms`,
    `| cierre ${(cierre * 100).toFixed(3)} % | factor ${factor.toFixed(5)}`);
}

function _paintFragments(rows) {
  _setSourceData('tramos-frag', {
    type: 'FeatureCollection',
    features: rows.map(r => ({
      type: 'Feature',
      geometry: r.polygon.geometry,
      properties: {
        color: r.color,
        tramo: r.etiqueta,
        indice: r.indice,
        cana_ha: Number(r.canaNormHa.toFixed(2)),
      },
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
  _setSourceData('tramos-frag', EMPTY_FC);
}

function _renderTable(res) {
  const body = _panel.querySelector('#ct-body');
  const foot = _panel.querySelector('#ct-foot');
  const qa = _panel.querySelector('#ct-qa');

  body.innerHTML = res.rows.map(r => `
    <tr data-indice="${r.indice}" title="${escapeHtml(r.estacionArribaFull)} → ${
      escapeHtml(r.estacionAbajoFull)}">
      <td>
        <span class="ct-dot" style="background:${r.color}"></span>
        <span class="ct-tramo">${escapeHtml(r.etiqueta)}</span>
        <span class="ct-km">km ${r.kmInicio.toFixed(1)}–${r.kmFin.toFixed(1)}</span>
      </td>
      <td class="ct-num">${fmt(r.bufferHa)}</td>
      <td class="ct-num">${fmt(r.canaRawHa)}</td>
      <td class="ct-num ct-strong">${fmt(r.canaNormHa)}</td>
      <td class="ct-num">${res.oficialHa ? fmt(r.canaNormHa / res.oficialHa * 100, 1) : '—'}</td>
    </tr>
  `).join('');

  const sumBuffer = res.rows.reduce((s, r) => s + r.bufferHa, 0);
  const sumRaw = res.rows.reduce((s, r) => s + r.canaRawHa, 0);
  const sumNorm = res.rows.reduce((s, r) => s + r.canaNormHa, 0);

  foot.innerHTML = `
    <tr>
      <td><strong>Total</strong></td>
      <td class="ct-num">${fmt(sumBuffer)}</td>
      <td class="ct-num">${fmt(sumRaw)}</td>
      <td class="ct-num ct-strong">${fmt(sumNorm)}</td>
      <td class="ct-num">${res.oficialHa ? '100.0' : '—'}</td>
    </tr>
  `;

  const cierrePct = res.cierre * 100;
  const cierreOk = cierrePct > 99.9 && cierrePct < 100.1;

  qa.innerHTML = `
    <div>Oficial ArcGIS (<code>SUM_AREA_HA</code>): <strong>${
      res.oficialHa != null ? `${fmt(res.oficialHa)} ha` : '—'}</strong></div>
    <div>Geodésica turf del río completo: <strong>${fmt(res.canaRawHa)} ha</strong>
      · factor ${res.factor.toFixed(5)} (${fmt((res.factor - 1) * 100, 2)} %)</div>
    <div class="${cierreOk ? 'ct-ok' : 'ct-warn'}">Cierre geométrico: <strong>${
      cierrePct.toFixed(3)} %</strong> ${cierreOk ? '✓' : '⚠ revisar los cortes'}</div>
  `;

  /* Click en una fila → encuadrar ese tramo */
  body.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const row = res.rows.find(r => r.indice === Number(tr.dataset.indice));
      if (!row) return;
      const [w, s, e, n] = geojsonBbox(row.polygon);
      _map.fitBounds([[w, s], [e, n]], { padding: 60, duration: 800 });
    });
  });

  const nCuts = res.cuts.length;
  _setStatus(nCuts === 0
    ? 'Sin cortes: se muestra el buffer completo. Añade un corte para dividir en tramos.'
    : `${nCuts} corte${nCuts > 1 ? 's' : ''} · ${res.rows.length} tramos · ${
        res.ms.toFixed(0)} ms`);
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
  setInfoPanelEnabled(false);
  _map.getCanvas().style.cursor = 'crosshair';
  _panel.querySelector('#ct-draw').classList.add('ct-btn-active');
  _setStatus('Clic en un extremo, luego en el otro. Esc cancela.');

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
  setInfoPanelEnabled(true);
}

/* ── Persistencia y exportación ──────────────────────────────────────── */

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
    'rio', 'tramo', 'estacion_aguas_arriba', 'estacion_aguas_abajo',
    'km_inicio', 'km_fin', 'area_buffer_ha', 'cana_ha_cruda',
    'cana_ha_normalizada', 'pct_cana_del_rio', 'pct_cobertura_tramo',
  ];

  const lines = [header.join(',')];
  for (const row of r.rows) {
    lines.push([
      csvCell(r.river),
      csvCell(row.etiqueta),
      csvCell(row.estacionArribaFull),
      csvCell(row.estacionAbajoFull),
      row.kmInicio.toFixed(3),
      row.kmFin.toFixed(3),
      row.bufferHa.toFixed(2),
      row.canaRawHa.toFixed(2),
      row.canaNormHa.toFixed(2),
      r.oficialHa ? (row.canaNormHa / r.oficialHa * 100).toFixed(2) : '',
      row.bufferHa > 0 ? (row.canaNormHa / row.bufferHa * 100).toFixed(2) : '',
    ].join(','));
  }

  /* Metadatos de trazabilidad: sin esto las cifras no son auditables. */
  lines.push('');
  lines.push(`# rio,${csvCell(r.river)}`);
  lines.push(`# total_oficial_arcgis_ha,${r.oficialHa ?? ''}`);
  lines.push(`# total_geodesico_turf_ha,${r.canaRawHa.toFixed(2)}`);
  lines.push(`# factor_normalizacion,${r.factor.toFixed(6)}`);
  lines.push(`# cierre_geometrico_pct,${(r.cierre * 100).toFixed(4)}`);
  lines.push(`# generado,${new Date().toISOString()}`);

  _download(lines.join('\n'), `tramos_cana_${_safeName(r.river)}.csv`,
    'text/csv;charset=utf-8');
}

/* Exporta los cortes de TODOS los ríos, para commitear un único archivo. */
function _downloadCuts() {
  const features = Object.values(_cutsByRiver).flat();
  if (!features.length) { _setStatus('No hay cortes que guardar.', true); return; }

  _download(JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    'cortes_tramos.geojson', 'application/geo+json');
  _setStatus(`${features.length} cortes exportados. Commitea el archivo en ${CORTES_PATH}.`);
}

/* Exporta los polígonos de tramo, para volver a validarlos en ArcGIS Pro. */
function _downloadPolygons() {
  if (!_results?.rows.length) { _setStatus('Nada que exportar todavía.', true); return; }
  const r = _results;

  const features = r.rows.map(row => ({
    type: 'Feature',
    geometry: row.polygon.geometry,
    properties: {
      rio: r.river,
      tramo: row.etiqueta,
      indice: row.indice,
      km_inicio: Number(row.kmInicio.toFixed(3)),
      km_fin: Number(row.kmFin.toFixed(3)),
      area_buffer_ha: Number(row.bufferHa.toFixed(2)),
      cana_ha_cruda: Number(row.canaRawHa.toFixed(2)),
      cana_ha_normalizada: Number(row.canaNormHa.toFixed(2)),
    },
  }));

  _download(JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    `tramos_generados_${_safeName(r.river)}.geojson`, 'application/geo+json');
}

function _ingestCuts(fc) {
  const byRiver = {};
  let n = 0;
  for (const f of fc.features ?? []) {
    if (f.geometry?.type !== 'LineString') continue;
    const key = normalizeRiver(f.properties?.rio);
    if (!key) continue;
    (byRiver[key] ??= []).push(f);
    n++;
  }
  _cutsByRiver = byRiver;
  return n;
}

async function _importCuts(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const n = _ingestCuts(JSON.parse(await file.text()));
    _setStatus(`${n} cortes cargados desde ${file.name}.`);
    _refresh();
  } catch (err) {
    _setStatus(`No se pudo leer el archivo: ${err.message}`, true);
  } finally {
    e.target.value = '';   // permite recargar el mismo archivo
  }
}

/* Carga silenciosa del archivo versionado. Un 404 es normal mientras no se
 * haya commiteado ningún corte. */
async function _loadSavedCuts() {
  try {
    const resp = await fetch(CORTES_PATH);
    if (!resp.ok) return;
    const n = _ingestCuts(await resp.json());
    console.log(`[tramos] ${n} cortes cargados de ${CORTES_PATH}`);
    if (_open) _refresh();
  } catch {
    /* sin archivo de cortes — se dibujan a mano */
  }
}
