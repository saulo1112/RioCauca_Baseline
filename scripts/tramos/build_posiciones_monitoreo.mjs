/* build_posiciones_monitoreo.mjs — Posición sobre el eje de cada río de las
 * estaciones de calidad y de las estaciones hidrométricas.
 *
 *     cd scripts/tramos && node build_posiciones_monitoreo.mjs
 *
 * Insumo del ejercicio de traducción de carga a concentración (Actividad 5,
 * scripts/build_monitoreo_corredor.py): para convertir la carga de un
 * subtramo en concentración hace falta el caudal en su estación de calidad,
 * y las estaciones hidrométricas no coinciden con las de calidad. Proyectar
 * ambas sobre el MISMO eje, orientado aguas abajo con el mismo criterio de
 * la segmentación, permite elegir la hidrométrica más cercana y declarar si
 * queda aguas arriba o aguas abajo, y a cuántos km.
 *
 * Produce:
 *     data/fuentes/monitoreo_corredor/posiciones_estaciones.csv
 *         — rio, tipo (calidad | hidrometrica), nombre, km sobre el eje,
 *           distancia al eje, dentro de la zona cañera, lon, lat, y para las
 *           hidrométricas estado, años de datos y n de días.
 *
 * Cuando llegue el inventario de vertimientos (tasas retributivas), sus
 * puntos se proyectan con la misma función kmOn() para asignarlos a tramo.
 */

import * as turf from '@turf/turf';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

globalThis.turf = turf;

import { ROOT, leer, normalizeRiver } from './segmentacion.mjs';

const { orientAxisDownstream } =
  await import(pathToFileURL(path.join(ROOT, 'src/tramos/geometry.js')).href);

const OUT_PATH = 'data/fuentes/monitoreo_corredor/posiciones_estaciones.csv';

const trib   = leer('data/cartografia/Tributarios_rios_cauca.geojson');
const cauca  = leer('data/cartografia/Rio_cauca.geojson');
const buffer = leer('data/cartografia/Buffer_Zona_de_Estudio.geojson');
const est    = leer('data/calidad_agua/puntos_calidad_tributarios.geojson');
const hidro  = leer('data/hidrologia/estaciones_hidro_trib.json');

const buscar = (fc, clave) =>
  fc.features.find(f => normalizeRiver(f.properties.NOM1_DRENA) === clave);

const kmOn = (axis, pt) => turf.nearestPointOnLine(axis, pt, { units: 'kilometers' });

/* Campo CSV: comillas solo si hace falta. */
const csv = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const claves = [...new Set(buffer.features.map(f => normalizeRiver(f.properties.NOM1_DRENA)))]
  .filter(k => k !== 'cauca')
  .sort();

const filas = [];
for (const clave of claves) {
  const eje = buscar(trib, clave);
  const buf = buscar(buffer, clave);
  if (!eje || !buf) {
    console.log(`AVISO  ${clave}: sin eje o sin buffer, se omite`);
    continue;
  }
  const { axis } = orientAxisDownstream(eje, cauca);
  const rio = buf.properties.NOM1_DRENA;

  for (const f of est.features.filter(f => normalizeRiver(f.properties.Rio) === clave)) {
    const p = kmOn(axis, f);
    const [lon, lat] = f.geometry.coordinates;
    filas.push({
      rio, clave, tipo: 'calidad', nombre: f.properties.Punto_Monitoreo,
      km: p.properties.location, dist: p.properties.dist,
      enZona: turf.booleanPointInPolygon(f, buf), lon, lat,
      estado: '', anios: '', nDias: '',
    });
  }

  for (const h of hidro.filter(h => normalizeRiver(h.rio) === clave)) {
    const pt = turf.point([h.longitud, h.latitud]);
    const p = kmOn(axis, pt);
    filas.push({
      rio, clave, tipo: 'hidrometrica', nombre: h.nombre,
      km: p.properties.location, dist: p.properties.dist,
      enZona: turf.booleanPointInPolygon(pt, buf), lon: h.longitud, lat: h.latitud,
      estado: h.estado, anios: h['años_datos'], nDias: h.n_dias,
    });
  }
}

filas.sort((a, b) => a.clave.localeCompare(b.clave) || a.km - b.km);

const header = ['rio', 'clave_rio', 'tipo', 'nombre', 'km_eje', 'dist_eje_km',
  'en_zona_canera', 'lon', 'lat', 'estado', 'anios_datos', 'n_dias'];
const lineas = [header.join(',')];
for (const r of filas) {
  lineas.push([
    r.rio, r.clave, r.tipo, r.nombre, r.km.toFixed(3), r.dist.toFixed(3),
    r.enZona ? 'si' : 'no', r.lon.toFixed(6), r.lat.toFixed(6),
    r.estado, r.anios, r.nDias,
  ].map(csv).join(','));
}

const abs = path.join(ROOT, OUT_PATH);
fs.mkdirSync(path.dirname(abs), { recursive: true });
fs.writeFileSync(abs, lineas.join('\n') + '\n', 'utf8');

const nCal = filas.filter(r => r.tipo === 'calidad').length;
const nHid = filas.length - nCal;
console.log(`${nCal} estaciones de calidad y ${nHid} hidrométricas proyectadas → ${OUT_PATH}`);
