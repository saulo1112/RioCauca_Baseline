/* build_buffer_tramos.mjs — Buffer de la zona de estudio (700 m), partido
 * por subtramo, para exportar a ArcGIS Pro (p. ej. para determinar el
 * número de curva por subtramo cruzando con grupo hidrológico de suelo y
 * uso del suelo).
 *
 *     cd tools/tramos && node build_buffer_tramos.mjs
 *
 * Reutiliza segmentarRio() — la misma geometría de tramos que ya usan el
 * análisis de caña y la priorización N/P, así que los polígonos son
 * IDÉNTICOS a los de esas capas (mismos límites, por construcción). Las
 * propiedades son las de docs/tramos_cana_tributarios.csv (ya publicado),
 * unidas por (rio, tramo) — no se recalcula ni se inventa ningún valor.
 *
 * Produce:
 *     data/cartografia/Buffer_Zona_Estudio_por_Tramo.geojson
 *         — 46 polígonos (uno por subtramo), WGS84 (EPSG:4326).
 *
 * El .shp para ArcGIS Pro se genera aparte con
 * tools/tramos/geojson_a_shapefile.py (geopandas ya soporta nombres de
 * campo de hasta 10 caracteres para el .dbf).
 */

import * as turf from '@turf/turf';
import fs from 'node:fs';
import path from 'node:path';

globalThis.turf = turf;

import {
  ROOT, leer, areaHa, normalizeRiver,
  cargarContexto, clavesDeRios, segmentarRio,
} from './segmentacion.mjs';

const CSV_PATH = 'docs/tramos_cana_tributarios.csv';
const OUT_PATH = 'data/cartografia/Buffer_Zona_Estudio_por_Tramo.geojson';

/* ── Parser CSV mínimo (sin comillas embebidas en este archivo) ──────── */
function parseCsv(text) {
  const [header, ...lines] = text.trim().split('\n');
  const cols = header.split(',');
  return lines
    /* El CSV termina con líneas de metadata ("# generado…", "# total…") —
     * una fila de datos real siempre trae "tramo" (columna 1) numérico. */
    .filter(line => /^\d+$/.test(line.split(',')[1] ?? ''))
    .map(line => {
      const vals = line.split(',');
      const row = {};
      cols.forEach((c, i) => { row[c] = vals[i]; });
      return row;
    });
}

const fmt = (v, d = 2) => Number(v).toFixed(d);

/* ── Cargar atributos ya publicados ───────────────────────────────────── */

const csvRaw = fs.readFileSync(path.join(ROOT, CSV_PATH), 'utf8');
const filas = parseCsv(csvRaw);

const porRioTramo = new Map();
for (const f of filas) {
  porRioTramo.set(`${normalizeRiver(f.rio)}#${f.tramo}`, f);
}
console.log(`${filas.length} filas leídas de ${CSV_PATH}`);

/* ── Segmentar cada río y unir con la tabla ───────────────────────────── */

const ctx = cargarContexto();
const claves = clavesDeRios(ctx);

const features = [];
const usados = new Set();
const errores = [];

for (const clave of claves) {
  const seg = segmentarRio(clave, ctx);
  if (!seg) continue;

  for (const t of seg.tramos) {
    const key = `${clave}#${t.indice}`;
    const fila = porRioTramo.get(key);
    if (!fila) {
      errores.push(`${seg.nombre} tramo ${t.indice}: sin fila en ${CSV_PATH}`);
      continue;
    }
    usados.add(key);

    const piezasTramo = seg.piezas.filter(p => p.tramo === t.indice - 1).map(p => p.poly);
    if (piezasTramo.length === 0) {
      errores.push(`${seg.nombre} tramo ${t.indice}: 0 fragmentos de buffer`);
      continue;
    }
    const combinado = turf.combine(turf.featureCollection(piezasTramo)).features[0];

    const areaCombinada = areaHa(combinado);
    if (Math.abs(areaCombinada - t.bufferHa) > Math.max(0.5, t.bufferHa * 0.01)) {
      errores.push(`${seg.nombre} tramo ${t.indice}: área combinada ${fmt(areaCombinada)} ha ` +
        `≠ buffer del tramo ${fmt(t.bufferHa)} ha`);
      continue;
    }

    /* Puerta: la caña debe coincidir con el CSV ya publicado (no se
     * recalcula nada aquí, solo se reutiliza). */
    if (Math.abs(t.bufferHa - Number(fila.area_buffer_ha)) > Math.max(0.5, t.bufferHa * 0.01)) {
      errores.push(`${seg.nombre} tramo ${t.indice}: buffer ${fmt(t.bufferHa)} ha ` +
        `≠ CSV (${fila.area_buffer_ha} ha)`);
      continue;
    }

    features.push({
      type: 'Feature',
      geometry: combinado.geometry,
      properties: {
        rio: seg.nombre,
        tramo: t.indice,
        est_arriba: fila.estacion_aguas_arriba,
        est_abajo:  fila.estacion_aguas_abajo,
        km_inicio: Number(t.kmInicio.toFixed(3)),
        km_fin:    Number(t.kmFin.toFixed(3)),
        longitud_km: Number(fila.longitud_km),
        buffer_ha: Number(fila.area_buffer_ha),
        cana_cruda_ha: Number(fila.cana_ha_cruda),
        cana_norm_ha:  Number(fila.cana_ha_normalizada),
        pct_cana_rio:  Number(fila.pct_cana_del_rio),
        pct_cobertura: Number(fila.pct_cobertura_tramo),
      },
    });
  }
}

for (const key of porRioTramo.keys()) {
  if (!usados.has(key)) errores.push(`fila de ${CSV_PATH} sin tramo correspondiente: ${key}`);
}

/* Río Cauca: a pedido, se incluye completo (sin cortar en subtramos) — su
 * eje no es una sola polilínea continua como los tributarios (viene
 * fragmentado en 43 tramos sueltos, sin campo de orden), así que dividirlo
 * requeriría reconstruirlo primero. El polígono se copia tal cual del
 * buffer original, sin tocar su geometría. */
const nTribFeatures = features.length;
const bufferZona = leer('data/cartografia/Buffer_Zona_de_Estudio.geojson');
const cauca = bufferZona.features.find(f => normalizeRiver(f.properties.NOM1_DRENA) === 'cauca');
if (!cauca) {
  errores.push('No se encontró el polígono de Río Cauca en Buffer_Zona_de_Estudio.geojson');
} else {
  features.push({
    type: 'Feature',
    geometry: cauca.geometry,
    properties: {
      rio: 'Rio Cauca',
      tramo: null,
      est_arriba: null,
      est_abajo:  null,
      km_inicio: null,
      km_fin:    null,
      longitud_km: null,
      buffer_ha: Number(areaHa(cauca).toFixed(2)),
      cana_cruda_ha: null,
      cana_norm_ha:  null,
      pct_cana_rio:  null,
      pct_cobertura: null,
    },
  });
}

console.log('\n── Puertas de verificación ─────────────────────────');
if (errores.length) {
  for (const e of errores) console.log(`  FALLA  ${e}`);
  console.log(`\n${errores.length} PROBLEMA(S). No se escribió la salida.`);
  process.exit(1);
}
console.log(`  OK  ${nTribFeatures} subtramos de tributarios, todos con geometría`);
console.log(`  OK  ${filas.length} filas del CSV, todas usadas`);
console.log(`  OK  área combinada = buffer del tramo (±1 %) en los ${nTribFeatures} subtramos`);
console.log(`  OK  buffer_ha coincide con ${CSV_PATH}`);
console.log(`  OK  Río Cauca incluido completo (sin subdividir), ${features.at(-1).properties.buffer_ha} ha`);

const geojson = { type: 'FeatureCollection', features };
fs.writeFileSync(path.join(ROOT, OUT_PATH), JSON.stringify(geojson));

console.log('\nTODAS LAS PRUEBAS PASARON');
console.log(`  ${OUT_PATH}  (${features.length} polígonos)`);

const porRio = new Map();
for (const f of features) porRio.set(f.properties.rio, (porRio.get(f.properties.rio) ?? 0) + 1);
for (const [rio, n] of [...porRio.entries()].sort()) console.log(`    ${rio.padEnd(18)} ${n} tramos`);
