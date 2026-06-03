/* map.js — Mapa interactivo Leaflet
   Proyecto 890K | UAO × ASOCAÑA */

// ── Paleta de colores por río ──────────────────────────────────
const RIVER_COLORS = {
  'Rio Palo':         '#29b6f6',
  'Rio Desbaratado':  '#ab47bc',
  'Rio Fraile':       '#26a69a',
  'Rio Bolo':         '#ef5350',
  'Rio Amaime':       '#ff7043',
  'Rio Nima':         '#ffca28',
  'Rio Zabaletas':    '#66bb6a',
  'Rio Guabas':       '#26c6da',
  'Rio Guadalajara':  '#7e57c2',
  'Rio Riofrio':      '#ec407a',
  'Rio Tulua':        '#d4e157',
  'Rio Bugalagrande': '#ffa726',
  'Rio La Paila':     '#42a5f5',
  'Rio Risaralda':    '#a5d6a7',
  'Rio Guachal':      '#80cbc4',
  'Rio Palmira':      '#f48fb1',
  'Rio Parraga':      '#bcaaa4',
};

// ── Estado del módulo ──────────────────────────────────────────
let map;
let activeBasemap = null;
const leafletLayers = {};

// ── Renderer canvas compartido (mejor rendimiento en polígonos densos) ──
const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 3 });

// ── Definición de mapas base ───────────────────────────────────
const BASEMAPS = {
  dark: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }
  ),
  positron: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }
  ),
  imagery: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
      maxZoom: 19,
    }
  ),
};

// ── Inicialización del mapa ────────────────────────────────────
function initMap() {
  map = L.map('map', {
    center: [3.85, -76.10],
    zoom: 9,
    zoomControl: false,
    preferCanvas: true,
  });

  setBasemap('dark');
  L.control.zoom({ position: 'bottomright' }).addTo(map);
}

function setBasemap(key) {
  if (activeBasemap) map.removeLayer(activeBasemap);
  activeBasemap = BASEMAPS[key];
  activeBasemap.addTo(map);
  activeBasemap.bringToBack();

  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.base === key);
  });
}

// ── Helpers ────────────────────────────────────────────────────
function getRiverColor(name) {
  return RIVER_COLORS[name] || '#aaaaaa';
}

// ── Constructores de popups ────────────────────────────────────
function buildTributarioPopup(p, color) {
  return `
    <div class="popup-title" style="color:${color}">${p.NOM1_DRENA || '—'}</div>
    <div class="popup-row"><span class="popup-key">Cuenca:</span><span class="popup-val">${p.NOM_CUENCA || '—'}</span></div>
    <div class="popup-row"><span class="popup-key">Longitud:</span><span class="popup-val">${p.LONGITUD_KM != null ? p.LONGITUD_KM + ' km' : '—'}</span></div>
    <div class="popup-row"><span class="popup-key">Monitoreo:</span><span class="popup-val">${p.MONITOREO || '—'}</span></div>
    <div class="popup-row"><span class="popup-key">Fuente:</span><span class="popup-val">${p.FUENTE_DATO || '—'}</span></div>
  `;
}

function buildBufferRCPopup(p) {
  const areaHa = p.Shape_Area ? (p.Shape_Area / 10000).toFixed(0) : '—';
  return `
    <div class="popup-title" style="color:#1565c0">Buffer Río Cauca</div>
    <div class="popup-row"><span class="popup-key">Área aprox.:</span><span class="popup-val">${areaHa} ha</span></div>
  `;
}

function buildBufferZPPopup(p, color) {
  return `
    <div class="popup-title" style="color:${color}">Buffer — ${p.NOM1_DRENA || '—'}</div>
    <div class="popup-row"><span class="popup-key">Cuenca:</span><span class="popup-val">${p.NOM_CUENCA || '—'}</span></div>
    <div class="popup-row"><span class="popup-key">Distancia:</span><span class="popup-val">${p.BUFF_DIST != null ? p.BUFF_DIST + ' m' : '—'}</span></div>
    <div class="popup-row"><span class="popup-key">Long. río:</span><span class="popup-val">${p.LONGITUD_KM != null ? p.LONGITUD_KM + ' km' : '—'}</span></div>
  `;
}

function buildCZCaucaPopup(p) {
  return `
    <div class="popup-title" style="color:#a5d6a7">Corredor Río Cauca</div>
    <div class="popup-row"><span class="popup-key">Cobertura:</span><span class="popup-val">Caña de azúcar</span></div>
    <div class="popup-row"><span class="popup-key">Área:</span><span class="popup-val">${p.AREA_HA != null ? p.AREA_HA.toFixed(2) + ' ha' : '—'}</span></div>
    <div class="popup-row"><span class="popup-key">Año estudio:</span><span class="popup-val">${p.ANNO_ESTUD || '—'}</span></div>
    <div class="popup-row"><span class="popup-key">Fuente:</span><span class="popup-val">${p.INSUMO || '—'}</span></div>
  `;
}

function buildCZTributariosPopup(p, color) {
  return `
    <div class="popup-title" style="color:${color}">Corredor — ${p.RIO || '—'}</div>
    <div class="popup-row"><span class="popup-key">Cobertura:</span><span class="popup-val">${p.DESCRIPCIO || 'Caña de azúcar'}</span></div>
    <div class="popup-row"><span class="popup-key">Área:</span><span class="popup-val">${p.AREA_HA != null ? p.AREA_HA.toFixed(2) + ' ha' : '—'}</span></div>
    <div class="popup-row"><span class="popup-key">Código:</span><span class="popup-val">${p.CODIGO || '—'}</span></div>
    <div class="popup-row"><span class="popup-key">Uso:</span><span class="popup-val">${p.USO || '—'}</span></div>
  `;
}

// ── Constructores de capas ─────────────────────────────────────

function buildTributariosLayer(data) {
  return L.geoJSON(data, {
    renderer: canvasRenderer,
    smoothFactor: 1.5,
    style: (feature) => ({
      color:   getRiverColor(feature.properties.NOM1_DRENA),
      weight:  2.5,
      opacity: 0.9,
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const color = getRiverColor(p.NOM1_DRENA);
      layer.bindPopup(buildTributarioPopup(p, color), { maxWidth: 260 });
      layer.on('mouseover', () => layer.setStyle({ weight: 5, opacity: 1.0 }));
      layer.on('mouseout',  () => leafletLayers.tributarios.resetStyle(layer));
      layer.on('click',     () => showFeatureInfo('tributario', p, color));
    },
  });
}

function buildBufferRCLayer(data) {
  return L.geoJSON(data, {
    renderer: canvasRenderer,
    smoothFactor: 2,
    style: () => ({
      color:       '#1565c0',
      weight:      1.5,
      opacity:     0.8,
      fillColor:   '#1565c0',
      fillOpacity: 0.06,
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buildBufferRCPopup(feature.properties), { maxWidth: 260 });
    },
  });
}

function buildBufferZPLayer(data) {
  return L.geoJSON(data, {
    renderer: canvasRenderer,
    smoothFactor: 2,
    style: (feature) => {
      const color = getRiverColor(feature.properties.NOM1_DRENA);
      return {
        color,
        weight:      1,
        opacity:     0.75,
        fillColor:   color,
        fillOpacity: 0.14,
      };
    },
    onEachFeature: (feature, layer) => {
      const p     = feature.properties;
      const color = getRiverColor(p.NOM1_DRENA);
      layer.bindPopup(buildBufferZPPopup(p, color), { maxWidth: 260 });
      layer.on('click', () => showFeatureInfo('bufferZP', p, color));
    },
  });
}

/* Capas de cobertura de gran tamaño: canvas + smoothFactor agresivo.
   Sin hover effect para evitar recalculos masivos de estilo. */
function buildCZCaucaLayer(data) {
  return L.geoJSON(data, {
    renderer: canvasRenderer,
    smoothFactor: 3,
    style: () => ({
      color:       '#5a9e6f',
      weight:      0.5,
      opacity:     0.7,
      fillColor:   '#a5d6a7',
      fillOpacity: 0.45,
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buildCZCaucaPopup(feature.properties), { maxWidth: 260 });
    },
  });
}

function buildCZTributariosLayer(data) {
  return L.geoJSON(data, {
    renderer: canvasRenderer,
    smoothFactor: 3,
    style: (feature) => {
      const color = getRiverColor(feature.properties.RIO);
      return {
        color:       color,
        weight:      0.5,
        opacity:     0.7,
        fillColor:   color,
        fillOpacity: 0.35,
      };
    },
    onEachFeature: (feature, layer) => {
      const p     = feature.properties;
      const color = getRiverColor(p.RIO);
      layer.bindPopup(buildCZTributariosPopup(p, color), { maxWidth: 260 });
    },
  });
}

// ── Adición de capas al mapa ───────────────────────────────────

/* Orden de apilamiento: CZ primero (fondo), tributarios encima */
const LAYER_Z_ORDER = ['czCauca', 'czTributarios', 'bufferRC', 'bufferZP', 'tributarios'];

function addBaseLayers() {
  const d = AppData.capas;

  if (d.bufferRC)    leafletLayers.bufferRC    = buildBufferRCLayer(d.bufferRC);
  if (d.bufferZP)    leafletLayers.bufferZP    = buildBufferZPLayer(d.bufferZP);
  if (d.tributarios) {
    leafletLayers.tributarios = buildTributariosLayer(d.tributarios);
    buildLegend();
  }

  // Añadir al mapa según estado inicial de checkboxes
  ['bufferRC', 'bufferZP', 'tributarios'].forEach(key => {
    const chk = document.getElementById(`lyr-${key}`);
    if (leafletLayers[key] && chk && chk.checked) {
      leafletLayers[key].addTo(map);
    }
  });

  wireCheckboxes();
}

function addCZLayers() {
  const d = AppData.capas;

  if (d.czCauca)       leafletLayers.czCauca       = buildCZCaucaLayer(d.czCauca);
  if (d.czTributarios) leafletLayers.czTributarios  = buildCZTributariosLayer(d.czTributarios);

  ['czCauca', 'czTributarios'].forEach(key => {
    const chk = document.getElementById(`lyr-${key}`);
    if (leafletLayers[key] && chk && chk.checked) {
      leafletLayers[key].addTo(map);
      // Forzar al fondo para que no tape capas lineales
      leafletLayers[key].bringToBack();
    }
  });

  buildLegend();
}

function wireCheckboxes() {
  document.querySelectorAll('[id^="lyr-"]').forEach(chk => {
    if (chk.disabled) return;
    chk.addEventListener('change', () => {
      const key = chk.id.replace('lyr-', '');
      toggleLayer(key, chk.checked);
    });
  });
}

// ── Control de visibilidad ─────────────────────────────────────
function toggleLayer(key, visible) {
  const layer = leafletLayers[key];
  if (!layer) return;
  if (visible) {
    if (!map.hasLayer(layer)) {
      map.addLayer(layer);
      // Capas de cobertura siempre al fondo
      if (key === 'czCauca' || key === 'czTributarios') layer.bringToBack();
    }
  } else {
    if (map.hasLayer(layer)) map.removeLayer(layer);
  }
}

// ── Leyenda dinámica ───────────────────────────────────────────
function buildLegend() {
  const container = document.getElementById('legend');
  if (!container) return;

  let html = '';

  // Entradas por río tributario (si ya están cargados)
  if (AppData.capas.tributarios) {
    const names = [
      ...new Set(
        AppData.capas.tributarios.features.map(f => f.properties.NOM1_DRENA)
      ),
    ].filter(Boolean);

    names.forEach(name => {
      const c = getRiverColor(name);
      html += `<div class="legend-item">
        <div class="legend-line" style="background:${c}"></div>
        <span>${name}</span>
      </div>`;
    });
    html += `<div style="margin:6px 0 2px; border-top:1px solid var(--border-light)"></div>`;
  }

  // Zonas de cobertura
  html += `<div class="legend-item">
    <div class="legend-line" style="background:#a5d6a7; height:10px; border-radius:2px; opacity:0.75"></div>
    <span style="color:var(--text-muted)">Corredor R. Cauca (caña)</span>
  </div>`;
  html += `<div class="legend-item">
    <div class="legend-line" style="background:linear-gradient(90deg,#29b6f6,#ef5350); height:10px; border-radius:2px; opacity:0.65"></div>
    <span style="color:var(--text-muted)">Corredor Tributarios (caña)</span>
  </div>`;
  html += `<div style="margin:6px 0 2px; border-top:1px solid var(--border-light)"></div>`;
  html += `<div class="legend-item">
    <div class="legend-line" style="background:#1565c0"></div>
    <span style="color:var(--text-muted)">Buffer Río Cauca</span>
  </div>`;
  html += `<div class="legend-item">
    <div class="legend-line" style="background:linear-gradient(90deg,#26a69a,#66bb6a)"></div>
    <span style="color:var(--text-muted)">Buffer Zonas Protección</span>
  </div>`;

  container.innerHTML = html;
}

// ── Panel de información del elemento seleccionado ────────────
function showFeatureInfo(type, props, color) {
  const section = document.getElementById('feature-info-section');
  const content = document.getElementById('feature-info-content');
  if (!section || !content) return;

  let html = '';

  if (type === 'tributario') {
    html = `<div class="fi-title" style="color:${color}">🌊 ${props.NOM1_DRENA}</div>
      <table class="fi-table">
        <tr><td>Cuenca</td><td>${props.NOM_CUENCA || '—'}</td></tr>
        <tr><td>Longitud</td><td>${props.LONGITUD_KM != null ? props.LONGITUD_KM + ' km' : '—'}</td></tr>
        <tr><td>Monitoreo</td><td>${props.MONITOREO || '—'}</td></tr>
        <tr><td>Fuente</td><td>${props.FUENTE_DATO || '—'}</td></tr>
      </table>`;
  } else if (type === 'bufferZP') {
    html = `<div class="fi-title" style="color:${color}">📐 ${props.NOM1_DRENA}</div>
      <table class="fi-table">
        <tr><td>Cuenca</td><td>${props.NOM_CUENCA || '—'}</td></tr>
        <tr><td>Buffer</td><td>${props.BUFF_DIST != null ? props.BUFF_DIST + ' m' : '—'}</td></tr>
        <tr><td>Long. río</td><td>${props.LONGITUD_KM != null ? props.LONGITUD_KM + ' km' : '—'}</td></tr>
      </table>`;
  }

  content.innerHTML = `
    <button class="fi-close" onclick="document.getElementById('feature-info-section').style.display='none'">✕</button>
    ${html}
  `;
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* Stub de compatibilidad: tramo buttons en sidebar llaman a esta función.
   Sin capa de tramos Cauca activa, solo recentra el mapa. */
function filterByTramo(tramoId) {
  const centers = {
    '1': { latlng: [3.25, -76.40], zoom: 10 },
    '2': { latlng: [3.70, -76.20], zoom: 10 },
    '3': { latlng: [4.35, -75.80], zoom: 10 },
  };
  if (tramoId === 'all') {
    map.setView([3.85, -76.10], 9);
  } else if (centers[tramoId]) {
    map.setView(centers[tramoId].latlng, centers[tramoId].zoom);
  }
}

// ── Bootstrap ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initMap();

  // Cargar datos base (ligeros + CSVs)
  await loadAllData();
  addBaseLayers();
  initCharts(AppData);
  buildCargaTable();

  // Botones de mapa base
  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => setBasemap(btn.dataset.base));
  });

  // Cuando terminen de cargar las capas de cobertura (asíncrono)
  document.addEventListener('largeCapasLoaded', addCZLayers);

  // Disparar carga de capas grandes en segundo plano
  loadLargeCapas();
});
