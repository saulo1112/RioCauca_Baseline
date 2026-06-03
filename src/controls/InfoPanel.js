/* InfoPanel.js — Popup de atributos al hacer click en capas GeoJSON */

import { CLICKABLE_LAYERS, getHectareasTotalHa } from '../layers/geojson.js';
import { getRiverColor }                         from '../layers/registry.js';

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
      const nombre = p.NOM1_DRENA ?? '—';
      return {
        title: `Zona de estudio — ${nombre}`,
        color: 'rgba(0, 130, 255, 0.9)',
        rows: [
          ['Tributario', nombre],
          ['Cuenca',     p.NOM_CUENCA  ?? '—'],
          ['Buffer',     p.BUFF_DIST != null ? `${p.BUFF_DIST} m` : '700 m'],
          ['Long. río',  p.LONGITUD_KM != null ? `${fmt(p.LONGITUD_KM, 2)} km` : '—'],
          ['Fuente',     p.FUENTE_DATO ?? '—'],
        ],
      };
    }

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

function showPanel({ title, color, rows }) {
  const panel = document.getElementById('info-panel');
  if (!panel) return;
  panel.querySelector('#info-title').textContent  = title;
  panel.querySelector('#info-title').style.color  = color;
  panel.querySelector('#info-body').innerHTML = rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');
  panel.classList.add('visible');
}

function hidePanel() {
  document.getElementById('info-panel')?.classList.remove('visible');
}
