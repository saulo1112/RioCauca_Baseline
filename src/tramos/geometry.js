/* geometry.js — Núcleo geométrico de la herramienta de tramos.
 *
 * Sin DOM y sin MapLibre: recibe y devuelve GeoJSON puro, para poder probarlo
 * desde la consola del navegador de forma aislada.
 *
 * Estrategia de corte: en vez de partir el contorno del buffer con
 * turf.lineSplit y reensamblar los anillos a mano (frágil: hay que decidir qué
 * trozo de contorno pertenece a cada mitad), cada línea de corte se convierte
 * en un POLÍGONO DE SEMIPLANO que cubre todo un lado del corte. Los tramos
 * salen entonces de operaciones booleanas ya probadas (intersect / difference)
 * que devuelven MultiPolygon correctos sin trabajo manual.
 *
 * Todas las áreas se calculan con turf.area(), que es geodésica sobre el
 * esferoide WGS84 — nunca planimetría ingenua sobre grados.
 */

/* global turf */

export function turfReady() {
  return typeof turf !== 'undefined' && typeof turf.area === 'function';
}

/* Alcance que deben tener la prolongación de la línea y la profundidad del
 * semiplano para que el corte se comporte como una recta infinita frente a
 * este buffer.
 *
 * NO basta con un par de kilómetros: aunque el buffer solo mide 1,4 km de
 * ancho, un río de 80 km como el Fraile ocupa decenas de kilómetros de
 * extensión lateral. Si el semiplano es más angosto que eso, los meandros que
 * sobresalen de la banda quedan fuera del recorte y el área se pierde en
 * silencio (con 5 km de prolongación el Fraile perdía 1.400 ha de buffer).
 *
 * Se usa la diagonal completa del bbox con un 20 % de margen. */
export function reachKm(feature) {
  const [w, s, e, n] = turf.bbox(feature);
  return turf.distance(turf.point([w, s]), turf.point([e, n]),
    { units: 'kilometers' }) * 1.2;
}

/* ── Utilidades básicas ──────────────────────────────────────────────── */

/* Hectáreas geodésicas de cualquier Feature/geometría poligonal. */
export function areaHa(geom) {
  if (!geom) return 0;
  return turf.area(geom) / 10000;
}

/* Descompone Polygon/MultiPolygon en una lista de Feature<Polygon> sueltos.
 * Trabajar con partes individuales permite el prefiltro por bbox y evita que
 * una sola booleana gigante falle por completo. */
export function explodePolygons(feature) {
  if (!feature) return [];
  const geom = feature.geometry ?? feature;
  if (geom.type === 'Polygon') {
    return [turf.polygon(geom.coordinates, feature.properties ?? {})];
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.map(rings => turf.polygon(rings, feature.properties ?? {}));
  }
  return [];
}

/* ── Semiplanos ──────────────────────────────────────────────────────── */

/* Prolonga una LineString `km` en ambos extremos, siguiendo el rumbo de
 * sus segmentos terminales. */
export function extendLine(line, km) {
  const coords = (line.geometry ?? line).coordinates;
  if (coords.length < 2) throw new Error('La línea de corte necesita al menos 2 vértices');

  const first = coords[0];
  const second = coords[1];
  const last = coords[coords.length - 1];
  const beforeLast = coords[coords.length - 2];

  /* destination(origen, dist, rumbo) — el rumbo se invierte en el extremo
   * inicial para prolongar "hacia atrás". */
  const startExt = turf.destination(
    turf.point(first), km, turf.bearing(turf.point(second), turf.point(first)),
    { units: 'kilometers' },
  ).geometry.coordinates;

  const endExt = turf.destination(
    turf.point(last), km, turf.bearing(turf.point(beforeLast), turf.point(last)),
    { units: 'kilometers' },
  ).geometry.coordinates;

  return turf.lineString([startExt, ...coords, endExt]);
}

/* Construye el polígono que cubre uno de los dos lados de la línea.
 * side: +1 o -1 (a qué lado se desplaza la copia de la línea).
 * reach: alcance en km, normalmente reachKm(buffer).
 *
 * El anillo se cierra con la línea extendida más su copia trasladada
 * `reach` km en perpendicular, recorrida al revés. */
export function buildHalfPlane(line, side, reach) {
  const ext = extendLine(line, reach);
  const coords = ext.geometry.coordinates;

  /* Rumbo global de la línea; basta porque los cortes son esencialmente
   * rectos (2 clics) y la extensión domina la geometría. */
  const bearing = turf.bearing(
    turf.point(coords[0]), turf.point(coords[coords.length - 1]),
  );
  const offsetBearing = bearing + 90 * side;

  const moved = turf.transformTranslate(ext, reach, offsetBearing,
    { units: 'kilometers' });
  const movedCoords = [...moved.geometry.coordinates].reverse();

  const ring = [...coords, ...movedCoords, coords[0]];
  return turf.polygon([ring]);
}

/* ── Validación del corte ────────────────────────────────────────────── */

/* Un corte solo es válido si atraviesa el buffer de lado a lado, es decir si
 * cruza el contorno en 2 puntos o más.
 *
 * Con más de 2 cruces el corte, prolongado como recta, vuelve a entrar al
 * buffer en otro meandro: el tramo resultante quedaría partido en dos trozos
 * no contiguos. No se bloquea (a veces es geométricamente correcto), pero se
 * advierte porque suele indicar un corte mal orientado.
 *
 * Devuelve { ok, points, message, warning }. */
export function validateCut(line, bufferFeature) {
  const outline = turf.polygonToLine(bufferFeature);
  const hits = turf.lineIntersect(
    extendLine(line, reachKm(bufferFeature)), outline);
  const n = hits.features.length;

  if (n === 0) {
    return { ok: false, points: 0, warning: false,
      message: 'La línea de corte no toca la zona de estudio. Dibújala cruzando el buffer.' };
  }
  if (n < 2) {
    return { ok: false, points: n, warning: false,
      message: 'La línea de corte no atraviesa el buffer completo (solo lo toca en un punto).' };
  }
  if (n > 2) {
    return { ok: true, points: n, warning: true,
      message: `El corte cruza el buffer en ${n} puntos: prolongado corta también otro meandro. `
             + 'Revisa su orientación o el cierre geométrico.' };
  }
  return { ok: true, points: n, warning: false, message: '' };
}

/* ── Ordenamiento a lo largo del eje del río ─────────────────────────── */

/* Distancia acumulada en km desde el inicio del eje hasta la proyección del
 * punto sobre él. Es la clave para ordenar cortes y fragmentos sin depender
 * del orden en que el usuario dibujó ni del orden de salida de las booleanas. */
export function locationOnAxis(axis, point) {
  const snapped = turf.nearestPointOnLine(axis, point, { units: 'kilometers' });
  return snapped.properties.location;
}

/* Orienta el eje del río aguas arriba → aguas abajo.
 * Regla: el extremo más cercano al eje del Río Cauca es la desembocadura.
 * Devuelve { axis, reversed } con el eje ya en sentido de flujo. */
export function orientAxisDownstream(axis, rioCaucaFC) {
  const coords = (axis.geometry ?? axis).coordinates;
  const start = turf.point(coords[0]);
  const end = turf.point(coords[coords.length - 1]);

  /* Distancia mínima de cada extremo a cualquier tramo del Río Cauca. */
  const distTo = pt => Math.min(...rioCaucaFC.features.map(f => {
    try {
      return turf.pointToLineDistance(pt, f, { units: 'kilometers' });
    } catch {
      return Infinity;
    }
  }));

  const dStart = distTo(start);
  const dEnd = distTo(end);

  /* Si el inicio está más cerca del Cauca, el eje viene invertido. */
  if (dStart < dEnd) {
    return { axis: turf.lineString([...coords].reverse(), axis.properties ?? {}), reversed: true };
  }
  return { axis: turf.lineString(coords, axis.properties ?? {}), reversed: false };
}

/* ── Corte del buffer en fragmentos ──────────────────────────────────── */

/* Parte el buffer con N líneas de corte y devuelve N+1 fragmentos ordenados
 * de aguas arriba a aguas abajo.
 *
 * Implementación: para cada corte se decide qué semiplano es el de "aguas
 * arriba" comparando la posición de su centroide sobre el eje. Luego el
 * fragmento i = buffer ∩ abajo(corte i-1) ∩ arriba(corte i). */
export function splitBufferByCuts(bufferFeature, cutLines, axis) {
  if (cutLines.length === 0) {
    return [{
      polygon: bufferFeature,
      planes: [],
      kmInicio: 0,
      kmFin: turf.length(axis, { units: 'kilometers' }),
    }];
  }

  /* 1. Ordenar los cortes por su posición a lo largo del eje. */
  const cuts = cutLines
    .map(line => {
      const mid = turf.center(line);
      return { line, km: locationOnAxis(axis, mid) };
    })
    .sort((a, b) => a.km - b.km);

  /* 2. Para cada corte, identificar cuál de sus dos semiplanos contiene la
   *    parte de aguas arriba del eje. Se prueba con un punto del eje situado
   *    claramente antes del corte. */
  const axisLenKm = turf.length(axis, { units: 'kilometers' });
  const reach = reachKm(bufferFeature);

  for (const cut of cuts) {
    const probeKm = Math.max(0.01, cut.km - Math.max(0.5, axisLenKm * 0.02));
    const probe = turf.along(axis, probeKm, { units: 'kilometers' });

    const planeA = buildHalfPlane(cut.line, +1, reach);
    const planeB = buildHalfPlane(cut.line, -1, reach);

    if (turf.booleanPointInPolygon(probe, planeA)) {
      cut.upstream = planeA;
      cut.downstream = planeB;
    } else {
      cut.upstream = planeB;
      cut.downstream = planeA;
    }
  }

  /* 3. Construir los N+1 fragmentos. */
  const fragments = [];

  for (let i = 0; i <= cuts.length; i++) {
    let poly = bufferFeature;

    /* Recortar por debajo del corte anterior (todo lo que está aguas abajo). */
    if (i > 0) poly = safeIntersect(poly, cuts[i - 1].downstream);
    /* Recortar por encima del corte actual (todo lo que está aguas arriba). */
    if (i < cuts.length && poly) poly = safeIntersect(poly, cuts[i].upstream);

    if (!poly) continue;

    /* Los semiplanos que delimitan el fragmento se conservan: son polígonos de
     * 9 vértices y permiten calcular el área de caña sin volver a tocar el
     * polígono del buffer, que tiene miles de vértices (ver
     * canaAreaInFragment). */
    const planes = [];
    if (i > 0) planes.push(cuts[i - 1].downstream);
    if (i < cuts.length) planes.push(cuts[i].upstream);

    fragments.push({
      polygon: poly,
      planes,
      kmInicio: i === 0 ? 0 : cuts[i - 1].km,
      kmFin: i === cuts.length ? axisLenKm : cuts[i].km,
    });
  }

  /* 4. Ordenar por posición sobre el eje — no confiar en el orden de salida. */
  fragments.sort((a, b) => a.kmInicio - b.kmInicio);
  return fragments;
}

/* turf.intersect devuelve null cuando no hay solape y lanza en geometrías
 * degeneradas; ambos casos se tratan como "sin resultado". */
function safeIntersect(a, b) {
  try {
    return turf.intersect(turf.featureCollection([a, b]));
  } catch (err) {
    console.warn('[tramos] intersect falló:', err.message);
    return null;
  }
}

/* ── Área de caña dentro de un fragmento ─────────────────────────────── */

/* Suma las hectáreas de caña dentro de un fragmento.
 *
 * `fragment` es un elemento de splitBufferByCuts: { polygon, planes, … }.
 *
 * CLAVE DE RENDIMIENTO — se opera contra los SEMIPLANOS, no contra el
 * polígono del fragmento. Esto es exacto porque la capa de caña ya viene
 * recortada al buffer en ArcGIS (verificado: 0,0000 % de caña fuera del
 * buffer en Bolo, Fraile, Guachal, Amaime y Nima), de modo que
 *
 *     caña ∩ fragmento = caña ∩ buffer ∩ semiplanos = caña ∩ semiplanos
 *
 * Un semiplano tiene 9 vértices frente a los ~2.900 del buffer, y turf.intersect
 * es O(n·m): medido, 1.252 ms contra el fragmento vs 2 ms contra los semiplanos.
 *
 * Por cada polígono de caña solo hay tres desenlaces:
 *   - contenido en todos los semiplanos  → se suma su área íntegra
 *   - disjunto de alguno                 → aporta 0
 *   - a caballo de una línea de corte    → único caso que pasa por intersect
 *     (típicamente 1–3 polígonos por corte) */
export function canaAreaInFragment(fragment, canaParts) {
  const planes = fragment.planes ?? [];

  /* Sin cortes el fragmento es el buffer completo: toda la caña está dentro. */
  if (planes.length === 0) {
    return {
      ha: canaParts.reduce((s, p) => s + p.areaHa, 0),
      nContained: canaParts.length,
      nIntersect: 0,
    };
  }

  let ha = 0;
  let nIntersect = 0;
  let nContained = 0;

  for (const part of canaParts) {
    let allIn = true;
    let outside = false;

    for (const plane of planes) {
      if (safeBoolean(() => turf.booleanContains(plane, part.feature), false)) continue;
      allIn = false;
      if (safeBoolean(() => turf.booleanDisjoint(plane, part.feature), false)) {
        outside = true;
        break;
      }
    }

    if (outside) continue;

    if (allIn) {
      ha += part.areaHa;
      nContained++;
      continue;
    }

    /* Polígono partido por la línea de corte: recortarlo semiplano a semiplano. */
    let clip = part.feature;
    for (const plane of planes) {
      clip = safeIntersect(plane, clip);
      if (!clip) break;
    }
    if (clip) {
      ha += areaHa(clip);
      nIntersect++;
    }
  }

  return { ha, nContained, nIntersect };
}

function safeBoolean(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

/* Precalcula bbox y área de cada polígono de caña, una sola vez por río. */
export function prepareCana(canaFeature) {
  return explodePolygons(canaFeature).map(feature => ({
    feature,
    bbox: turf.bbox(feature),
    areaHa: areaHa(feature),
  }));
}

/* ── Corte perpendicular automático en un punto ──────────────────────── */

/* Base sobre la que se mide el rumbo local del eje, en km.
 *
 * NO bajarla sin medir. Los ejes vienen digitalizados con un vértice cada
 * 13–24 m, así que con una base corta el rumbo lo domina el zigzag de
 * digitalización y no la dirección real del cauce: la "perpendicular" sale
 * girada y recorta un lóbulo lateral en vez de cruzar el corredor. Medido
 * sobre Riofrío, Palo, Tuluá y Amaime: con ±50 m fallan 6 cortes; con ±500 m
 * ninguno. */
const BEARING_BASE_KM = 0.5;

/* Genera la perpendicular exacta al eje en la proyección de `point`.
 * Más reproducible que el pulso del mouse; la línea resultante se puede
 * borrar y redibujar a mano si hace falta.
 *
 * `bearingBaseKm` permite alargar la base del rumbo cuando el corte no llega a
 * separar el polígono (ver la escalera de reintentos en
 * tools/tramos/build_tramos_cana.mjs). */
export function perpendicularAt(axis, point, lengthKm = 2, bearingBaseKm = BEARING_BASE_KM) {
  const snapped = turf.nearestPointOnLine(axis, point, { units: 'kilometers' });
  const km = snapped.properties.location;
  const total = turf.length(axis, { units: 'kilometers' });

  const a = turf.along(axis, Math.max(0, km - bearingBaseKm), { units: 'kilometers' });
  const b = turf.along(axis, Math.min(total, km + bearingBaseKm), { units: 'kilometers' });
  const bearing = turf.bearing(a, b);

  const half = lengthKm / 2;
  const p1 = turf.destination(snapped, half, bearing + 90, { units: 'kilometers' });
  const p2 = turf.destination(snapped, half, bearing - 90, { units: 'kilometers' });

  return turf.lineString([
    p1.geometry.coordinates,
    p2.geometry.coordinates,
  ]);
}
