/* waterQuality.js — Carga y agrupación de datos históricos de calidad del agua
 * del Río Cauca (CSV CVC) por estación, para el panel de información.
 *
 * El CSV viene con campos entre comillas dobles y nombres de estación en
 * mayúsculas; se normaliza el espaciado y se mapea al nombre DESCRIPCION del
 * GeoJSON de estaciones mediante NAME_MAP. La carga es memoizada: una sola
 * lectura del archivo por sesión, compartida por todos los accesores.
 */

const CSV_PATH = 'data/databases/Calidad_del_agua_del_Rio_Cauca_20260604.csv';

const FECHA_COL = 'FECHA DE MUESTREO';
const EST_COL   = 'ESTACIONES';

/* Nombre de estación en el CSV (mayúsculas) → DESCRIPCION del GeoJSON */
const NAME_MAP = {
  'ANTES SUAREZ':          'Antes Suárez',
  'ANTES RIO OVEJAS':      'Antes Ovejas',
  'ANTES RIO TIMBA':       'Buenos Aires - Cauca',
  'PASO DE LA BALSA':      'Paso de La Balsa',
  'PUENTE HORMIGUERO':     'Hormiguero',
  'PASO DE LA BOLSA':      'Paso de La Bolsa',
  'ANTES INTERCEPTOR SUR': 'La Primavera',
  'ANTES INTERCEPTOR':     'La Primavera',
  'JUANCHITO':             'Juanchito',
  'PASO DEL COMERCIO':     'Paso del Comercio',
  'PUERTO ISAACS':         'Yumbo',
  'PASO DE LA TORRE':      'Paso La Torre',
  'VIJES':                 'Vijes',
  'YOTOCO':                'Yotoco',
  'MEDIACANOA':            'Mediacanoa',
  'RIOFRIO':               'Riofrio',
  'PUENTE GUAYABAL':       'Puente Guayabal',
  'LA VICTORIA':           'La Victoria',
  'ANACARO':               'Anacaro',
  'PUENTE LA VIRGINIA':    'La Virginia - Risaralda',
};

const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/* Estado de módulo (memoización) */
let _loadPromise   = null;
let _dataMap       = null;   // Map<descripcion, registro[]>
let _headers       = [];     // headers originales del CSV
let _paramHeaders  = [];     // headers sin FECHA ni ESTACIONES

/* ── Parser CSV (maneja comillas dobles y comas internas) ──────────── */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      /* ignorar */
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ── Helpers de limpieza y normalización ───────────────────────────── */

/* Trata como null las celdas vacías, censuradas o con valor de detección. */
function cleanValue(v) {
  if (v == null) return null;
  const t = v.trim();
  if (t === '' || t === 'N.D.' || t === 'N.D' || t === '*') return null;
  if (t.startsWith('<') || t.startsWith('>')) return null;
  return t;
}

/* Colapsa espacios múltiples y unifica a mayúsculas para el join. */
function normStation(s) {
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
}

/* "1998 Dec 19 12:00:00 AM" → { fecha: Date, año: 1998 } */
function parseFecha(s) {
  const parts = (s || '').trim().split(/\s+/);
  const year  = parseInt(parts[0], 10);
  const mon   = MONTHS[parts[1]] ?? 0;
  const day   = parseInt(parts[2], 10) || 1;
  if (Number.isNaN(year)) return { fecha: new Date(0), año: null };
  return { fecha: new Date(year, mon, day), año: year };
}

/* Escapa una celda para el CSV de descarga (comillas + doblado). */
function csvCell(v) {
  return `"${(v == null ? '' : String(v)).replace(/"/g, '""')}"`;
}

/* ── Carga + agrupación (memoizada) ────────────────────────────────── */
async function _doLoad() {
  const resp = await fetch(`${CSV_PATH}?v=1.3`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();

  const rows = parseCSV(text);
  if (rows.length < 2) { _dataMap = new Map(); return _dataMap; }

  _headers = rows[0];
  const idxFecha = _headers.indexOf(FECHA_COL);
  const idxEst   = _headers.indexOf(EST_COL);
  _paramHeaders  = _headers.filter(h => h !== FECHA_COL && h !== EST_COL);

  const dataRows = rows.slice(1).filter(
    r => r.length === _headers.length && r[idxEst] && r[idxEst].trim()
  );

  const records = [];
  for (const r of dataRows) {
    const key = NAME_MAP[normStation(r[idxEst])];
    if (!key) continue;   // estación no mapeada → ignorar

    const { fecha, año } = parseFecha(r[idxFecha]);
    const rec = { fecha, año, _estacion: r[idxEst], _raw: r, _desc: key };
    _headers.forEach((h, i) => {
      if (h === FECHA_COL || h === EST_COL) return;
      rec[h] = cleanValue(r[i]);
    });
    records.push(rec);
  }

  records.sort((a, b) => a.fecha - b.fecha);

  const map = new Map();
  for (const rec of records) {
    if (!map.has(rec._desc)) map.set(rec._desc, []);
    map.get(rec._desc).push(rec);
  }

  _dataMap = map;
  console.log('[waterQuality] CSV cargado:', records.length, 'registros |',
    map.size, 'estaciones mapeadas');
  return map;
}

/* ── API pública ───────────────────────────────────────────────────── */

/* Carga el CSV una sola vez; llamadas posteriores reutilizan la promesa. */
export function loadWaterQualityData() {
  if (!_loadPromise) _loadPromise = _doLoad();
  return _loadPromise;
}

/* Registros de una estación, ordenados por fecha ascendente. */
export async function getStationRecords(descripcion) {
  const map = await loadWaterQualityData();
  return map.get(descripcion) ?? [];
}

/* Nombres de columna con al menos un valor no-null para esa estación. */
export async function getAvailableParams(descripcion) {
  await loadWaterQualityData();
  const recs = _dataMap.get(descripcion) ?? [];
  return _paramHeaders.filter(h => recs.some(r => r[h] != null));
}

/* CSV (string) listo para descargar: headers originales + registros de la
 * estación, ordenados por fecha, con el nombre original en ESTACIONES. */
export async function buildStationCSV(descripcion) {
  await loadWaterQualityData();
  const recs = _dataMap.get(descripcion) ?? [];
  const lines = [_headers.map(csvCell).join(',')];
  for (const r of recs) lines.push(r._raw.map(csvCell).join(','));
  return lines.join('\r\n');
}
