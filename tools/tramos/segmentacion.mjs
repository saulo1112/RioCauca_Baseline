/* segmentacion.mjs — Partición del buffer de 700 m en tramos entre estaciones.
 *
 * Módulo compartido por build_tramos_cana.mjs y build_uso_suelo_tramos.mjs, de
 * modo que los tramos de ambos análisis sean idénticos POR CONSTRUCCIÓN y no
 * por coincidencia. Cualquier ajuste al criterio de corte se propaga a los dos.
 *
 * Devuelve los trozos de buffer ya asignados a su tramo; cada script decide
 * después qué capa intersecta contra ellos (caña, uso del suelo, …).
 *
 * ── Por qué NO se usan los semiplanos del visor ──────────────────────────
 * buildHalfPlane() prolonga la línea de corte decenas de km para que se
 * comporte como una recta infinita. En ríos meandriformes esa recta vuelve a
 * entrar al buffer y el área se cuenta dos veces: el Palo llegó a cerrar en
 * 112,38 %.
 *
 * Aquí se corta con la perpendicular LOCAL, materializada como una ranura
 * delgada que se resta del polígono, y cada trozo se asigna al tramo por su
 * posición sobre el eje del río. Al usar el sistema de coordenadas del propio
 * cauce, el método es inmune a los meandros.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);

const { orientAxisDownstream, perpendicularAt, areaHa } =
  await imp('src/tramos/geometry.js');
const { normalizeRiver, shortStationName } = await imp('src/tramos/stations.js');

export { normalizeRiver, shortStationName, areaHa };

/* ── Parámetros ──────────────────────────────────────────────────────── */

/* Escalera de reintentos: [base del rumbo, longitud de la línea] en km.
 *
 * La base del rumbo es la que más pesa. Los ejes traen un vértice cada 13–24 m,
 * así que una base corta mide el zigzag de digitalización en vez de la
 * dirección del cauce y la perpendicular sale girada.
 *
 * La longitud se mantiene corta al principio para no alcanzar meandros vecinos. */
const BASE_INICIAL = Number(process.env.TRAMOS_BASE_INICIAL ?? 0.25);

const ESCALERA = [
  [BASE_INICIAL, 4], [BASE_INICIAL, 8],
  [0.5, 4],  [0.5, 8],
  [1.0, 4],  [1.0, 8],
  [2.0, 8],  [2.0, 16],
].filter(([b], i) => i < 2 || b > BASE_INICIAL);

/* Cortes ya versionados. Los de Bolo y Fraile se trazaron con el criterio
 * anterior y sus cifras están publicadas, así que se PRESERVAN tal cual en vez
 * de regenerarlos: cambiar su orientación movía Fraile T1 de 78,56 a 92,77 ha.
 * Los ríos que no figuren en el archivo se calculan automáticamente. */
export const CORTES_PATH = 'data/cortes_tramos.geojson';

/* Holgura al clasificar un trozo como "aguas arriba" o "aguas abajo" del corte.
 * Debe superar el medio ancho del corredor (700 m), porque un trozo pegado al
 * corte siempre tiene vértices que proyectan al otro lado. */
const TOL_LADO_KM = 0.9;

/* Grosor de la ranura. Debe bastar para separar topológicamente sin comerse
 * área apreciable: 0,5 m × 1,4 km de corredor ≈ 0,07 ha por corte. */
const SLIVER_KM = 0.0005;

/* Dos estaciones a menos de esta distancia sobre el eje son el mismo punto
 * físico registrado dos veces (Guabas km 13,91; Tuluá km 67,68). */
const DEDUPE_KM = 0.15;

/* Cuántos vértices de cada trozo se proyectan sobre el eje. Proyectar los
 * ~10.000 de cada polígono contra un eje de miles de puntos costaba ~80 s por
 * río, y la mediana no mejora con más muestra. */
const MUESTRA_VERTICES = 200;

/* Estaciones mal clasificadas: figuran bajo un río al que no pertenecen. */
const EXCLUIR = [
  { patron: /^r[ií]o cauca\b/i, motivo: 'estación del Río Cauca clasificada bajo otro río' },
];

/* ── Utilidades ──────────────────────────────────────────────────────── */

export const leer = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const fmt = (v, d = 2) => Number(v).toFixed(d);

export function safeIntersect(a, b) {
  try { return turf.intersect(turf.featureCollection([a, b])); } catch { return null; }
}

function safeDifference(a, b) {
  try { return turf.difference(turf.featureCollection([a, b])); } catch { return null; }
}

/* Posición en km del punto sobre el eje. */
const kmOn = (axis, pt) =>
  turf.nearestPointOnLine(axis, pt, { units: 'kilometers' }).properties.location;

/* Rango [min, max] y mediana de km sobre el eje de un polígono, por muestreo. */
function rangoKm(axis, poly) {
  const coords = turf.coordAll(poly);
  const paso = Math.max(1, Math.ceil(coords.length / MUESTRA_VERTICES));
  const kms = [];
  for (let c = 0; c < coords.length; c += paso) kms.push(kmOn(axis, turf.point(coords[c])));
  kms.sort((a, b) => a - b);
  return { lo: kms[0], hi: kms.at(-1), mediana: kms[Math.floor(kms.length / 2)] };
}

/* ── Corte secuencial verificado ─────────────────────────────────────── */

/* Parte `pieces` con la perpendicular al eje en `station`.
 *
 * Se corta SOLO el trozo que contiene el punto de corte. Unir todas las ranuras
 * en una máscara única y hacer una sola resta NO funciona: en Riofrío degrada el
 * corte de km 33,2 y dos tramos se fusionan sin dar ningún error.
 *
 * No basta con exigir que salgan ≥2 trozos: un corte mal orientado recorta un
 * lóbulo lateral y deja el trozo principal abarcando ambos lados. Por eso se
 * exige que TODO trozo resultante quede de un solo lado del corte. */
function splitPieces(pieces, axis, station, lineaFija = null) {
  const snap = turf.nearestPointOnLine(axis, station.f, { units: 'kilometers' });
  const kmCorte = snap.properties.location;

  const idx = pieces.findIndex(p => turf.booleanPointInPolygon(snap, p));
  if (idx < 0) {
    return { ok: false, pieces, motivo: 'el punto de corte no cae en ningún trozo' };
  }

  /* Con un corte preservado del archivo no se puede tocar el azimut: solo se
   * alarga manteniendo su orientación. */
  const intentos = lineaFija
    ? [4, 8, 16].map(largo => [null, largo])
    : ESCALERA;

  for (const [base, largo] of intentos) {
    const linea = lineaFija
      ? alargarLinea(lineaFija, largo)
      : perpendicularAt(axis, station.f, largo, base);
    const ranura = turf.buffer(linea, SLIVER_KM, { units: 'kilometers' });
    const cortado = safeDifference(pieces[idx], ranura);
    if (!cortado) continue;

    const trozos = turf.flatten(cortado).features;
    if (trozos.length < 2) continue;

    /* El test de "corte limpio" solo se aplica a los cortes AUTOMÁTICOS: está
     * para vetar una perpendicular mal orientada que recorta un lóbulo lateral.
     * Un corte preservado del archivo ya fue revisado y sus cifras están
     * publicadas, así que se acepta con que separe. El de Fraile en Puente Vía
     * a Miranda es oblicuo respecto al eje —de ahí que su tramo 1 dé 78,56 y no
     * 92,77 ha— y no pasaría este test. */
    if (!lineaFija) {
      const limpio = trozos.every(t => {
        const { lo, hi } = rangoKm(axis, t);
        return hi <= kmCorte + TOL_LADO_KM || lo >= kmCorte - TOL_LADO_KM;
      });
      if (!limpio) continue;
    }

    const out = [...pieces];
    out.splice(idx, 1, ...trozos);
    return { ok: true, pieces: out, base, largo, linea, nuevos: trozos.length };
  }

  return { ok: false, pieces,
    motivo: lineaFija
      ? 'el corte preservado del archivo no separa el polígono ni alargándolo'
      : 'ninguna combinación de la escalera separó el polígono de forma limpia' };
}

/* Reescala una línea de 2 puntos a `largoKm` conservando centro y azimut. */
function alargarLinea(linea, largoKm) {
  const [a, b] = linea.geometry.coordinates;
  const centro = turf.midpoint(turf.point(a), turf.point(b));
  const az = turf.bearing(turf.point(a), turf.point(b));
  const half = largoKm / 2;
  return turf.lineString([
    turf.destination(centro, half, az, { units: 'kilometers' }).geometry.coordinates,
    turf.destination(centro, half, az + 180, { units: 'kilometers' }).geometry.coordinates,
  ]);
}

/* ── Cortes versionados ──────────────────────────────────────────────── */

/* Indexados por río → nombre de estación.
 *
 * Reutilizarlos hace la corrida idempotente: el archivo no cambia entre
 * ejecuciones y los números del reporte son reproducibles. La contrapartida es
 * que un cambio en el algoritmo NO regenera los cortes ya guardados; para
 * forzarlo, correr con TRAMOS_REGENERAR_CORTES=1 o borrar el archivo. */
export function cargarCortesPrevios() {
  const mapa = new Map();
  if (process.env.TRAMOS_REGENERAR_CORTES === '1') {
    console.log('TRAMOS_REGENERAR_CORTES=1 — se ignoran los cortes versionados.\n');
    return mapa;
  }
  const abs = path.join(ROOT, CORTES_PATH);
  if (!fs.existsSync(abs)) return mapa;
  const fc = JSON.parse(fs.readFileSync(abs, 'utf8'));
  for (const f of fc.features ?? []) {
    if (f.geometry?.type !== 'LineString') continue;
    const k = normalizeRiver(f.properties?.rio);
    const e = f.properties?.estacion;
    if (!k || !e) continue;
    if (!mapa.has(k)) mapa.set(k, new Map());
    mapa.get(k).set(e, f);
  }
  return mapa;
}

/* Carga las capas base comunes a los dos análisis. */
export function cargarContexto() {
  return {
    buffers:  leer('data/cartografia/Buffer_Zona_de_Estudio.geojson'),
    trib:     leer('data/cartografia/Tributarios_rios_cauca.geojson'),
    rioCauca: leer('data/cartografia/Rio_cauca.geojson'),
    est:      leer('data/geovisor/puntos_calidad_tributarios.geojson'),
    cortesPrevios: cargarCortesPrevios(),
  };
}

/* Los 15 tributarios con buffer, excluido el Río Cauca.
 * TRAMOS_RIOS=bolo,fraile limita la corrida (útil al depurar). */
export function clavesDeRios(ctx) {
  const filtro = (process.env.TRAMOS_RIOS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return [...new Set(ctx.buffers.features.map(f => normalizeRiver(f.properties.NOM1_DRENA)))]
    .filter(k => k !== 'cauca')
    .filter(k => filtro.length === 0 || filtro.includes(k))
    .sort();
}

/* ── Segmentación de un río ──────────────────────────────────────────── */

/* Devuelve el buffer partido en tramos, con cada trozo ya asignado.
 * `null` si al río le falta buffer o eje. */
export function segmentarRio(clave, ctx) {
  const { buffers, trib, rioCauca, est, cortesPrevios } = ctx;
  const buscar = (fc, campo) =>
    fc.features.find(f => normalizeRiver(f.properties[campo]) === clave);

  const buffer = buscar(buffers, 'NOM1_DRENA');
  const ejeRaw = buscar(trib, 'NOM1_DRENA');
  if (!buffer || !ejeRaw) return null;

  const { axis } = orientAxisDownstream(ejeRaw, rioCauca);
  const largoEje = turf.length(axis, { units: 'kilometers' });

  /* Extensión del buffer sobre el eje: se muestrea cada 100 m. El buffer no
   * envuelve todo el cauce, solo el tramo de valle, y saber dónde arranca es lo
   * que explica que haya estaciones de montaña inutilizables como corte. */
  let bufIni = null, bufFin = null;
  for (let d = 0; d <= largoEje; d += 0.1) {
    if (turf.booleanPointInPolygon(turf.along(axis, d, { units: 'kilometers' }), buffer)) {
      if (bufIni === null) bufIni = d;
      bufFin = d;
    }
  }

  /* 1. Estaciones del río, descartando las mal clasificadas */
  const descartadas = [];
  let estaciones = est.features
    .filter(f => normalizeRiver(f.properties.Rio) === clave)
    .filter(f => {
      const hit = EXCLUIR.find(e => e.patron.test(f.properties.Punto_Monitoreo || ''));
      if (hit) descartadas.push({ n: f.properties.Punto_Monitoreo, motivo: hit.motivo });
      return !hit;
    })
    .map(f => ({
      f,
      nombre: f.properties.Punto_Monitoreo,
      corto:  shortStationName(f.properties.Punto_Monitoreo),
      N:      f.properties.N_Registros ?? 0,
      km:     kmOn(axis, f),
      enZona: turf.booleanPointInPolygon(f, buffer),
    }))
    .sort((a, b) => a.km - b.km);

  /* 2. Deduplicar puntos físicos repetidos */
  const dedup = [];
  for (const s of estaciones) {
    const prev = dedup.at(-1);
    if (prev && Math.abs(s.km - prev.km) < DEDUPE_KM) {
      descartadas.push({ n: (s.N > prev.N ? prev : s).nombre, motivo: `duplicada en km ${fmt(s.km, 2)}` });
      if (s.N > prev.N) dedup[dedup.length - 1] = s;
    } else {
      dedup.push(s);
    }
  }
  estaciones = dedup;

  /* 3. Cortes = intermedias que además caen dentro de la zona cañera.
   *    Una estación fuera del buffer no puede cortar: no hay polígono ahí. */
  const intermedias = estaciones.slice(1, -1);
  const cortes = intermedias.filter(s => s.enZona);
  const fueraZona = estaciones.filter(s => !s.enZona);

  /* 4. Cortar secuencialmente, preservando los cortes ya versionados */
  const previos = cortesPrevios.get(clave) ?? new Map();
  let pieces = turf.flatten(buffer).features;
  const fallos = [];
  const lineas = [];
  let nPreservados = 0;

  for (const s of cortes) {
    const fija = previos.get(s.nombre) ?? null;
    const r = splitPieces(pieces, axis, s, fija);
    if (!r.ok) fallos.push({ estacion: s.nombre, km: s.km, motivo: r.motivo });
    else {
      if (fija) nPreservados++;
      /* Para un corte reutilizado se guarda su geometría y sus propiedades
       * ORIGINALES, no las que se hayan alargado o recalculado internamente:
       * alargar conserva centro y azimut, así que es la misma recta, y el
       * archivo debe quedar idéntico al versionado corrida tras corrida. */
      lineas.push({
        estacion: s,
        linea: fija ?? r.linea,
        reutilizado: !!fija,
        props: fija?.properties ?? null,
      });
    }
    pieces = r.pieces;
  }

  /* 5. Asignar cada trozo a su tramo por posición sobre el eje */
  const bordes = [0, ...cortes.map(s => s.km), largoEje];
  const nTramos = bordes.length - 1;
  const bufHa = new Array(nTramos).fill(0);
  const piezas = [];

  for (const pz of pieces) {
    /* Asignación por la MEDIANA de las proyecciones, no por un punto
     * representativo suelto: en trozos largos y sinuosos `pointOnFeature`
     * puede caer en un lóbulo lateral y mandar el trozo al tramo equivocado. */
    const km = rangoKm(axis, pz).mediana;
    let i = bordes.findIndex((b, j) => j < nTramos && km >= b && km < bordes[j + 1]);
    if (i < 0) i = nTramos - 1;

    /* No se vigila aquí que el rango de km del trozo respete las fronteras: un
     * corte es una recta perpendicular y el eje es sinuoso, así que un trozo
     * que ES un tramo siempre se desborda ~700 m (medio ancho del corredor) por
     * cada extremo. Cualquier umbral que tolere ese desborde deja de distinguir
     * un tramo corto legítimo de dos tramos fusionados. El fallo real —un corte
     * que no separó— lo detectan las puertas de `fallos` y de tramo vacío. */
    bufHa[i] += areaHa(pz);
    piezas.push({ poly: pz, tramo: i });
  }

  const tramos = [];
  for (let i = 0; i < nTramos; i++) {
    tramos.push({
      indice: i + 1,
      kmInicio: bordes[i],
      kmFin: bordes[i + 1],
      longitudKm: bordes[i + 1] - bordes[i],
      arriba: i === 0 ? estaciones[0] : cortes[i - 1],
      abajo:  i === nTramos - 1 ? estaciones.at(-1) : cortes[i],
      bufferHa: bufHa[i],
    });
  }

  return {
    clave,
    nombre: buffer.properties.NOM1_DRENA,
    buffer, axis, largoEje, bufIni, bufFin,
    bufTotal: areaHa(buffer),
    estaciones, cortes, fueraZona, descartadas,
    piezas, tramos, nPiezas: pieces.length,
    fallos, lineas, nPreservados,
  };
}
