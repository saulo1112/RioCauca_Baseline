/* build_priorizacion_tramos.mjs — Geometría de la priorización por carga
 * difusa de N y P (Tabla 5.2 del Informe 1, "Diagnóstico de la calidad de
 * agua y estimación de la contribución de la contaminación difusa").
 *
 *     cd tools/tramos && node build_priorizacion_tramos.mjs
 *
 * La Tabla 5.2 clasifica los 46 subtramos de los 15 tributarios en 5
 * categorías (Muy alta/Alta/Media/Baja/No aplica) según su carga estimada de
 * N y P. Se verificó que esos 46 subtramos son EXACTAMENTE los mismos 46
 * tramos ya calculados para caña (mismas longitudes y áreas de caña, con
 * diferencias de redondeo <0,05 ha) — no hace falta volver a segmentar nada,
 * solo unir la tabla (data/databases/Priorizacion_NP_subtramos.csv) a la
 * geometría que ya produce segmentarRio() y colorear cada fragmento de
 * buffer según su categoría.
 *
 * Produce:
 *     data/cartografia/Priorizacion_NP_tramos.geojson
 *         — 46 polígonos (fragmento de buffer por tramo), con propiedades
 *           categoria, n_kg_ano, n_kg_d, p_kg_ano, p_kg_d, pct_del_rio,
 *           area_cana_ha, buffer_ha, km_inicio, km_fin, estación arriba/abajo.
 */

import * as turf from '@turf/turf';
import fs from 'node:fs';
import path from 'node:path';

globalThis.turf = turf;

import {
  ROOT, areaHa, normalizeRiver,
  cargarContexto, clavesDeRios, segmentarRio,
} from './segmentacion.mjs';

const CSV_PATH = 'data/databases/Priorizacion_NP_subtramos.csv';
const OUT_PATH = 'data/cartografia/Priorizacion_NP_tramos.geojson';

const CATEGORIAS = ['Muy alta', 'Alta', 'Media', 'Baja', 'No aplica'];

/* ── Utilidades ──────────────────────────────────────────────────────── */

function parseCsv(text) {
  const [header, ...lines] = text.trim().split('\n');
  const cols = header.split(',');
  return lines.map(line => {
    const vals = line.split(',');
    const row = {};
    cols.forEach((c, i) => { row[c] = vals[i]; });
    return row;
  });
}

const fmt = (v, d = 2) => Number(v).toFixed(d);

/* ── Cargar tabla de priorización ────────────────────────────────────── */

const csvRaw = fs.readFileSync(path.join(ROOT, CSV_PATH), 'utf8');
const filas = parseCsv(csvRaw);

const porRioTramo = new Map();
for (const f of filas) {
  const key = `${normalizeRiver(f.rio)}#${f.tramo}`;
  if (porRioTramo.has(key)) {
    console.log(`FALLA  fila duplicada para ${f.rio} tramo ${f.tramo}`);
    process.exit(1);
  }
  porRioTramo.set(key, f);
}
console.log(`${filas.length} filas leídas de ${CSV_PATH}`);

/* ── Segmentar cada río y unir con la tabla ──────────────────────────── */

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

    if (!CATEGORIAS.includes(fila.categoria)) {
      errores.push(`${seg.nombre} tramo ${t.indice}: categoría desconocida "${fila.categoria}"`);
      continue;
    }

    /* Fusionar los fragmentos de buffer que caen en este tramo (turf.combine
     * -> Multi(Polygon), robusto frente a turf.union en geometrías con
     * bordes casi coincidentes). */
    const piezasTramo = seg.piezas.filter(p => p.tramo === t.indice - 1).map(p => p.poly);
    if (piezasTramo.length === 0) {
      errores.push(`${seg.nombre} tramo ${t.indice}: 0 fragmentos de buffer`);
      continue;
    }
    const fc = turf.featureCollection(piezasTramo);
    const combinado = turf.combine(fc).features[0];

    /* Puerta: el área combinada debe coincidir con bufferHa ya contabilizada
     * por segmentarRio (mismo polígono, solo verifica que combine no perdió
     * geometría). */
    const areaCombinada = areaHa(combinado);
    if (Math.abs(areaCombinada - t.bufferHa) > Math.max(0.5, t.bufferHa * 0.01)) {
      errores.push(`${seg.nombre} tramo ${t.indice}: área combinada ${fmt(areaCombinada)} ha ` +
        `≠ buffer del tramo ${fmt(t.bufferHa)} ha`);
      continue;
    }

    features.push({
      type: 'Feature',
      geometry: combinado.geometry,
      properties: {
        rio: seg.nombre,
        tramo: t.indice,
        estacion_arriba: t.arriba ? t.arriba.corto : null,
        estacion_abajo:  t.abajo  ? t.abajo.corto  : null,
        km_inicio: Number(t.kmInicio.toFixed(3)),
        km_fin:    Number(t.kmFin.toFixed(3)),
        buffer_ha: Number(t.bufferHa.toFixed(2)),
        categoria: fila.categoria,
        n_kg_ano:  Number(fila.n_kg_ano),
        n_kg_d:    Number(fila.n_kg_d),
        p_kg_ano:  Number(fila.p_kg_ano),
        p_kg_d:    Number(fila.p_kg_d),
        pct_del_rio: Number(fila.pct_del_rio),
        area_cana_ha: Number(fila.area_cana_tabla_ha),
      },
    });
  }
}

/* Puerta: toda fila de la tabla debe haberse usado (ninguna quedó huérfana). */
for (const key of porRioTramo.keys()) {
  if (!usados.has(key)) errores.push(`fila de ${CSV_PATH} sin tramo correspondiente: ${key}`);
}

console.log('\n── Puertas de verificación ─────────────────────────');
if (errores.length) {
  for (const e of errores) console.log(`  FALLA  ${e}`);
  console.log(`\n${errores.length} PROBLEMA(S). No se escribió la salida.`);
  process.exit(1);
}
console.log(`  OK  ${features.length} tramos, todos con categoría y geometría`);
console.log(`  OK  ${filas.length} filas de la tabla, todas usadas`);
console.log(`  OK  área combinada = buffer del tramo (±1 %) en los ${features.length} tramos`);

const geojson = { type: 'FeatureCollection', features };
fs.writeFileSync(path.join(ROOT, OUT_PATH), JSON.stringify(geojson));

console.log('\nTODAS LAS PRUEBAS PASARON');
console.log(`  ${OUT_PATH}  (${features.length} polígonos)`);

const porCat = new Map();
for (const f of features) porCat.set(f.properties.categoria, (porCat.get(f.properties.categoria) ?? 0) + 1);
for (const c of CATEGORIAS) console.log(`    ${c.padEnd(10)} ${porCat.get(c) ?? 0}`);
