/* InfoPanel.js — Popup de atributos al hacer click en capas GeoJSON */

import { CLICKABLE_LAYERS, getHectareasTotalHa } from '../layers/geojson.js';
import { getRiverColor }                         from '../layers/registry.js';
import { getStationRecords, getAvailableParams, buildStationCSV }
  from '../data/waterQuality.js';

/* Formatea un número con separador de miles y decimales fijos (formato en-US).
 * Ejemplo: fmt(3475.8612, 2) → "3,475.86" */
function fmt(value, decimals = 2) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function setupInfoPanel(map) {
  /* Cursor pointer sobre capas interactivas */
  CLICKABLE_LAYERS.forEach(id => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '';          });
  });

  /* Click: detectar la capa con mayor prioridad bajo el puntero */
  map.on('click', e => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: CLICKABLE_LAYERS.filter(id => map.getLayer(id)),
    });

    if (hits.length === 0) {
      hidePanel();
      return;
    }

    const { layer: { id: layerId }, properties: props } = hits[0];
    showPanel(buildInfo(layerId, props ?? {}));
  });

  document.getElementById('info-close')?.addEventListener('click', hidePanel);
}

/* ── Construcción del contenido del panel ──────────────────────────── */

function buildInfo(layerId, p) {
  console.log('[InfoPanel] layerId:', layerId, '| props:', p);
  switch (layerId) {

    case 'rio-cauca-line':
      return {
        title: 'Río Cauca',
        color: '#004DA8',
        rows: [
          ['Cuenca',  p.NOM_CUENCA ?? '—'],
          ['Fuente',  p.FUENTE     ?? '—'],
        ],
      };

    case 'tributarios-line': {
      const nombre = p.NOM1_DRENA ?? '—';
      return {
        title: nombre,
        color: getRiverColor(nombre),
        rows: [
          ['Cuenca',   p.NOM_CUENCA  ?? '—'],
          ['Longitud', p.LONGITUD_KM != null ? `${p.LONGITUD_KM} km` : '—'],
          ['Fuente',   p.FUENTE_DATO ?? '—'],
        ],
      };
    }

    case 'buffer-fill': {
      const nombre   = p.NOM1_DRENA ?? '—';
      const longitud = p.LONGITUD_AJUSTADA_KM ?? p.LONGITUD_KM;
      return {
        title: `Zona de estudio — ${nombre}`,
        color: 'rgba(0, 130, 255, 0.9)',
        rows: [
          ['Tributario', nombre],
          ['Cuenca',     p.NOM_CUENCA  ?? '—'],
          ['Buffer',     p.BUFF_DIST != null ? `${p.BUFF_DIST} m` : '700 m'],
          ['Long. río',  longitud != null ? `${fmt(longitud, 2)} km` : '—'],
          ['Fuente',     p.FUENTE_DATO ?? '—'],
        ],
      };
    }

    case 'estaciones-cauca-circle':
      return {
        title: p.DESCRIPCION ?? '—',
        color: '#FF6B35',
        station: p.DESCRIPCION ?? null,
        rows: [
          ['Río',              p.CORRIENTE_PROY ?? '—'],
          ['Municipio',        p.MUNICIPIO      ?? '—'],
          ['Zona de muestreo', p.ZONA_MUESTREO  ?? '—'],
          ['Fuente',           p.FUENTE         ?? '—'],
          ['Latitud',          p.LATITUD  != null ? String(p.LATITUD)  : '—'],
          ['Longitud',         p.LONGITUD != null ? String(p.LONGITUD) : '—'],
        ],
      };

    case 'hectareas-fill': {
      const rio   = p.RIO ?? '—';
      const area  = p.SUM_AREA_HA != null ? Number(p.SUM_AREA_HA) : null;
      const total = getHectareasTotalHa();
      const pct   = (area != null && total > 0) ? (area / total) * 100 : null;

      return {
        title: rio,
        color: '#c9907e',
        rows: [
          ['Área de caña de azúcar',       area != null ? `${fmt(area)} ha` : '—'],
          ['Participación en el corredor',  pct  != null ? `${fmt(pct)} %`  : '—'],
        ],
      };
    }

    default:
      return {
        title: layerId,
        color: '#aaa',
        rows:  Object.entries(p).slice(0, 6).map(([k, v]) => [k, v ?? '—']),
      };
  }
}

/* ── Render ─────────────────────────────────────────────────────────── */

/* Token de panel: invalida renders asíncronos obsoletos (si el usuario
 * hace click en otra estación antes de que el CSV termine de procesarse). */
let _panelToken = 0;

function showPanel({ title, color, rows, station }) {
  const panel = document.getElementById('info-panel');
  if (!panel) return;
  const token = ++_panelToken;

  panel.querySelector('#info-title').textContent  = title;
  panel.querySelector('#info-title').style.color  = color;
  panel.querySelector('#info-body').innerHTML = rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');

  const extra = document.getElementById('info-extra');
  if (extra) extra.innerHTML = '';
  panel.classList.add('visible');

  if (station) renderHistorico(station, token);
}

function hidePanel() {
  _panelToken++;   // invalida cualquier render pendiente
  document.getElementById('info-panel')?.classList.remove('visible');
}

/* ── Sección B: resumen histórico de calidad del agua ──────────────── */

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function renderHistorico(descripcion, token) {
  const extra = document.getElementById('info-extra');
  if (!extra) return;

  extra.innerHTML =
    '<hr class="info-sep">' +
    '<div class="info-hist-title">Datos históricos de calidad del agua</div>' +
    '<div class="info-hist-body">Cargando datos…</div>';

  const [recs, params] = await Promise.all([
    getStationRecords(descripcion),
    getAvailableParams(descripcion),
  ]);
  if (token !== _panelToken) return;   // panel cambió: descartar

  const body = extra.querySelector('.info-hist-body');
  if (!body) return;

  if (!recs.length) { body.textContent = 'Sin datos disponibles'; return; }

  const years = recs.map(r => r.año).filter(y => y != null);
  const yMin = Math.min(...years);
  const yMax = Math.max(...years);

  /* Valor más reciente no-null de los parámetros prioritarios */
  const PRIORITY_PARAMS = [
    'DEMANDA BIOQUIMICA DE OXIGENO (mg O2/l)',
    'OXIGENO DISUELTO (mg O2/l)',
    'NITROGENO TOTAL (mg N/l)',
    'FOSFORO TOTAL (mg P/l)',
    'SOLIDOS TOTALES (mg SST/l)',
  ];
  const displayParams = PRIORITY_PARAMS.filter(p => params.includes(p));
  const lines = displayParams.map(p => {
    for (let i = recs.length - 1; i >= 0; i--) {
      if (recs[i][p] != null) return `${p}: ${recs[i][p]} (${recs[i].año})`;
    }
    return null;
  }).filter(Boolean);

  body.innerHTML =
    `<div class="info-hist-summary">${recs.length} registros · ${yMin}–${yMax}</div>` +
    `<div class="info-hist-params">${
      lines.map(l => `<div>${escapeHtml(l)}</div>`).join('')
    }</div>` +
    '<button class="info-hist-dl" type="button">⬇ Descargar datos CSV</button>';

  body.querySelector('.info-hist-dl')
    ?.addEventListener('click', () => downloadStationCSV(descripcion));
}

async function downloadStationCSV(descripcion) {
  const csv  = await buildStationCSV(descripcion);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const safe = descripcion.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const a = document.createElement('a');
  a.href = url;
  a.download = `calidad_agua_${safe}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
