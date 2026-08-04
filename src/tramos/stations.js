/* stations.js — Emparejamiento río ↔ estaciones y etiquetado de tramos.
 *
 * Ojo con la ortografía: la cartografía escribe "Rio Fraile" (campos RIO y
 * NOM1_DRENA) mientras que los puntos de calidad escriben "Rio Frayle"
 * (campo Rio). Todo el emparejamiento pasa por normalizeRiver().
 */

/* global turf */

import { locationOnAxis } from './geometry.js';

/* Variantes ortográficas del mismo río entre capas. La cartografía y los
 * puntos de calidad no coinciden en la grafía, y sin esta tabla el río se
 * queda sin estaciones (silenciosamente: la tabla sale con etiquetas "km X"
 * en vez de nombres). */
const ALIAS = {
  frayle:    'fraile',      // calidad "Rio Frayle"    ↔ cartografía "Rio Fraile"
  sabaletas: 'zabaletas',   // calidad "Rio Sabaletas" ↔ cartografía "Rio Zabaletas"
};

/* Normaliza un nombre de río a una clave comparable:
 * minúsculas, sin tildes, sin el prefijo "rio/río", y con las variantes
 * ortográficas conocidas unificadas. */
export function normalizeRiver(name) {
  if (!name) return '';
  let s = String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quitar tildes
    .toLowerCase()
    .trim()
    .replace(/^rio\s+/, '')
    .replace(/\s+/g, ' ');

  return ALIAS[s] ?? s;
}

/* Busca la feature de una FeatureCollection cuyo campo `field` coincide con el
 * río pedido, comparando de forma normalizada. */
export function findByRiver(fc, field, river) {
  if (!fc?.features) return null;
  const key = normalizeRiver(river);
  return fc.features.find(f => normalizeRiver(f.properties?.[field]) === key) ?? null;
}

/* Todas las estaciones de calidad de un río, ya proyectadas sobre el eje y
 * ordenadas de aguas arriba a aguas abajo. */
export function stationsAlongAxis(estacionesFC, axis, river) {
  if (!estacionesFC?.features) return [];
  const key = normalizeRiver(river);

  return estacionesFC.features
    .filter(f => normalizeRiver(f.properties?.Rio) === key)
    .map(f => ({
      feature: f,
      nombre: f.properties?.Punto_Monitoreo ?? '—',
      corto: shortStationName(f.properties?.Punto_Monitoreo),
      km: locationOnAxis(axis, f),
    }))
    .sort((a, b) => a.km - b.km);
}

/* "Rio Bolo - Limnígrafo CVC - Los Minchos" → "Limnígrafo CVC - Los Minchos".
 * Quita solo el primer segmento si es el nombre del río, para no mutilar
 * nombres que legítimamente contienen guiones. */
export function shortStationName(nombre) {
  if (!nombre) return '—';
  const parts = String(nombre).split(' - ');
  if (parts.length > 1 && /^r[íi]o\s+/i.test(parts[0].trim())) {
    return parts.slice(1).join(' - ').trim();
  }
  return String(nombre).trim();
}

/* Estación más cercana a una posición dada sobre el eje (en km). */
export function nearestStationAtKm(stations, km) {
  if (!stations.length) return null;
  return stations.reduce((best, s) =>
    Math.abs(s.km - km) < Math.abs(best.km - km) ? s : best, stations[0]);
}

/* Asigna a cada fragmento las estaciones que lo delimitan y arma su etiqueta.
 *
 * Se etiqueta por proximidad en km sobre el eje (no por el orden de dibujo),
 * de modo que redibujar los cortes en otro orden produce exactamente los
 * mismos nombres. */
export function labelFragments(fragments, stations) {
  return fragments.map((frag, i) => {
    const up = nearestStationAtKm(stations, frag.kmInicio);
    const down = nearestStationAtKm(stations, frag.kmFin);

    const upName = up?.corto ?? `km ${frag.kmInicio.toFixed(1)}`;
    const downName = down?.corto ?? `km ${frag.kmFin.toFixed(1)}`;

    return {
      ...frag,
      indice: i + 1,
      estacionArriba: upName,
      estacionAbajo: downName,
      estacionArribaFull: up?.nombre ?? '—',
      estacionAbajoFull: down?.nombre ?? '—',
      etiqueta: `${upName} → ${downName}`,
    };
  });
}
