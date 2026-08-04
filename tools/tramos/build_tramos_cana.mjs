/* build_tramos_cana.mjs — Hectáreas de caña por tramo entre estaciones de calidad.
 *
 *     cd tools/tramos && npm install && node build_tramos_cana.mjs
 *
 * Herramienta de escritorio: NO forma parte del sitio estático. Reutiliza los
 * módulos de geometría del visor (../../src/tramos/) para que el reporte y el
 * geovisor compartan una sola definición de "tramo".
 *
 * Produce:
 *     docs/tramos_cana_tributarios.md
 *     docs/tramos_cana_tributarios.csv
 *     data/cortes_tramos.geojson
 *
 * La partición del buffer en tramos vive en ./segmentacion.mjs, compartida con
 * build_uso_suelo_tramos.mjs para que los dos análisis usen exactamente los
 * mismos tramos. Aquí solo se cruza esa partición contra la capa de caña.
 */

import * as turf from '@turf/turf';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/* Los módulos del visor esperan turf como global (allí llega por <script>). */
globalThis.turf = turf;

import {
  ROOT, CORTES_PATH, leer, safeIntersect, areaHa, normalizeRiver, shortStationName,
  cargarContexto, clavesDeRios, segmentarRio,
} from './segmentacion.mjs';

const { prepareCana } =
  await import(pathToFileURL(path.join(ROOT, 'src/tramos/geometry.js')).href);

/* ── Parámetros ──────────────────────────────────────────────────────── */

const BASE_INICIAL = Number(process.env.TRAMOS_BASE_INICIAL ?? 0.25);
const TOL_CIERRE = 0.998;   // cierre geométrico mínimo aceptable

/* ── Utilidades ──────────────────────────────────────────────────────── */

const read = leer;
const fmt = (v, d = 2) => Number(v).toFixed(d);

/* Formato colombiano para el reporte: 1.234,56 */
function fmtCO(v, d = 2) {
  return Number(v).toLocaleString('es-CO', {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ── Análisis de un río ──────────────────────────────────────────────── */

function analizarRio(clave, ctx) {
  /* La partición del buffer en tramos es compartida con el análisis de uso del
   * suelo: ver ./segmentacion.mjs. Aquí solo se cruza contra la capa de caña. */
  const seg = segmentarRio(clave, ctx);
  if (!seg) return null;

  const canaF = ctx.cana.features.find(f => normalizeRiver(f.properties.RIO) === clave);
  if (!canaF) return null;

  const partes = prepareCana(canaF);
  const nTramos = seg.tramos.length;
  const canaHa = new Array(nTramos).fill(0);

  for (const { poly, tramo } of seg.piezas) {
    for (const p of partes) {
      const clip = safeIntersect(poly, p.feature);
      if (clip) canaHa[tramo] += areaHa(clip);
    }
  }

  /* Normalizar al total oficial de ArcGIS.
   *
   * El divisor es la suma REPARTIDA entre tramos, no el área total del río:
   * así el factor absorbe también la fracción de hectárea que se lleva la
   * ranura de corte, y los tramos suman exactamente el valor publicado. La
   * pérdida sigue siendo visible por separado en `cierreCana`. */
  const canaRaw   = partes.reduce((s, p) => s + p.areaHa, 0);
  const oficialHa = canaF.properties.SUM_AREA_HA;
  const sumaRaw   = canaHa.reduce((a, b) => a + b, 0);
  const factor    = sumaRaw > 0 ? oficialHa / sumaRaw : 1;

  const tramos = seg.tramos.map((t, i) => ({
    ...t,
    canaCrudaHa: canaHa[i],
    canaNormHa:  canaHa[i] * factor,
  }));

  return {
    ...seg,
    oficialHa, canaRaw, factor, tramos,
    cierreCana: sumaRaw / canaRaw,
    cierreBuffer: seg.tramos.reduce((a, t) => a + t.bufferHa, 0) / seg.bufTotal,
  };
}

/* ── Puertas de verificación ─────────────────────────────────────────── */

function verificar(rios) {
  const errores = [];
  for (const r of rios) {
    if (r.fallos.length) {
      for (const f of r.fallos) {
        errores.push(`${r.nombre}: el corte en "${f.estacion}" (km ${fmt(f.km, 2)}) no separó — ${f.motivo}`);
      }
    }
    if (r.cierreCana < TOL_CIERRE) {
      errores.push(`${r.nombre}: cierre de caña ${fmt(r.cierreCana * 100)} % < ${TOL_CIERRE * 100} %`);
    }
    if (r.cierreBuffer < TOL_CIERRE) {
      errores.push(`${r.nombre}: cierre de buffer ${fmt(r.cierreBuffer * 100)} % < ${TOL_CIERRE * 100} %`);
    }
    for (const t of r.tramos) {
      if (t.bufferHa < 0.01 && t.longitudKm >= 0.1) {
        errores.push(`${r.nombre}: tramo ${t.indice} sin área de buffer pese a medir ${fmt(t.longitudKm)} km`);
      }
    }
    const suma = r.tramos.reduce((s, t) => s + t.canaNormHa, 0);
    if (Math.abs(suma - r.oficialHa) > 0.01) {
      errores.push(`${r.nombre}: suma normalizada ${fmt(suma)} ≠ oficial ${fmt(r.oficialHa)}`);
    }
  }
  return errores;
}

/* ── Salidas ─────────────────────────────────────────────────────────── */

function escribirCSV(rios, destino) {
  const cols = ['rio', 'tramo', 'estacion_aguas_arriba', 'estacion_aguas_abajo',
    'n_registros_arriba', 'n_registros_abajo', 'km_inicio', 'km_fin', 'longitud_km',
    'area_buffer_ha', 'cana_ha_cruda', 'cana_ha_normalizada', 'pct_cana_del_rio',
    'pct_cobertura_tramo', 'estacion_arriba_en_zona_canera'];

  const filas = [cols.join(',')];
  for (const r of rios) {
    for (const t of r.tramos) {
      filas.push([
        csvCell(r.nombre), t.indice,
        csvCell(t.arriba?.nombre ?? ''), csvCell(t.abajo?.nombre ?? ''),
        t.arriba?.N ?? '', t.abajo?.N ?? '',
        fmt(t.kmInicio, 3), fmt(t.kmFin, 3), fmt(t.longitudKm, 3),
        fmt(t.bufferHa), fmt(t.canaCrudaHa), fmt(t.canaNormHa),
        fmt(t.canaNormHa / r.oficialHa * 100),
        t.bufferHa > 0 ? fmt(t.canaNormHa / t.bufferHa * 100) : '',
        t.arriba?.enZona ? 'si' : 'no',
      ].join(','));
    }
  }

  filas.push('');
  filas.push(`# generado,${new Date().toISOString()}`);
  filas.push('# metodo,corte perpendicular local + asignacion por posicion sobre el eje');
  filas.push('# area,turf.area geodesica WGS84 normalizada a SUM_AREA_HA (ArcGIS MAGNA-Sirgas)');
  filas.push(`# total_normalizado_ha,${fmt(rios.reduce((s, r) => s + r.oficialHa, 0))}`);

  fs.writeFileSync(destino, filas.join('\n'), 'utf8');
}

function escribirMD(rios, destino) {
  const L = [];
  const totalHa = rios.reduce((s, r) => s + r.oficialHa, 0);
  const nTramos = rios.reduce((s, r) => s + r.tramos.length, 0);
  const hoy = new Date().toISOString().slice(0, 10);

  L.push('# Hectáreas de caña de azúcar por tramo — tributarios del Río Cauca');
  L.push('');
  L.push('**Proyecto 890K | UAO × ASOCAÑA | Fase I — Corredor Biológico**  ');
  L.push(`*Generado el ${hoy} por \`tools/tramos/build_tramos_cana.mjs\`*`);
  L.push('');
  L.push(`Desagregación de las hectáreas de caña dentro del buffer de 700 m, por tramo entre`);
  L.push(`estaciones de calidad del agua. **${nTramos} tramos en ${rios.length} ríos, ${fmtCO(totalHa)} ha.**`);
  L.push('El Río Cauca queda fuera de este ejercicio.');
  L.push('');
  L.push('El objetivo es alimentar el modelo de carga difusa');
  L.push('`Carga (kg/año) = Área_caña (ha) × Coef_exportación × (Escorrentía_mm / 1000)`,');
  L.push('cuyos resultados se contrastan contra las mediciones de calidad en cada estación.');
  L.push('');

  /* ── Hallazgo estructural ── */
  L.push('## 1. El buffer de 700 m solo cubre la zona plana');
  L.push('');
  L.push('El buffer **no envuelve el eje completo del río**: arranca donde termina la montaña y');
  L.push('empieza el valle. Se verificó muestreando cada eje cada 100 m; la extensión resultante');
  L.push('concuerda con el campo `LONGITUD_AJUSTADA_KM` de la capa de buffer en los 15 ríos (las');
  L.push('diferencias de décimas provienen del paso de muestreo).');
  L.push('');
  const totEst = rios.reduce((s, r) => s + r.estaciones.length, 0);
  const totEnZona = rios.reduce((s, r) => s + r.estaciones.filter(e => e.enZona).length, 0);
  L.push('Esto tiene una consecuencia que gobierna todo el ejercicio: **una estación situada aguas');
  L.push('arriba de la zona plana no puede usarse como punto de corte**, porque allí no hay polígono');
  L.push(`que partir ni caña que repartir. De las ${totEst} estaciones disponibles, solo ${totEnZona} caen`);
  L.push('dentro de la zona cañera.');
  L.push('');
  L.push('| Río | Eje (km) | Buffer (km) | Arranca en km | % del eje | Estaciones | En zona cañera |');
  L.push('|---|---|---|---|---|---|---|');
  const porCobertura = [...rios].sort((a, b) => {
    const ca = (a.bufFin - a.bufIni) / a.largoEje, cb = (b.bufFin - b.bufIni) / b.largoEje;
    return ca - cb;
  });
  for (const r of porCobertura) {
    const enZona = r.estaciones.filter(s => s.enZona).length;
    const bufKm = r.bufFin - r.bufIni;
    L.push(`| ${r.nombre} | ${fmtCO(r.largoEje, 1)} | ${fmtCO(bufKm, 1)} | ` +
      `${fmtCO(r.bufIni, 1)} | ${fmtCO(bufKm / r.largoEje * 100, 0)} % | ` +
      `${r.estaciones.length} | ${enZona <= 1 ? `**${enZona}**` : enZona} |`);
  }
  L.push('');
  L.push('*Ordenado por cobertura ascendente. En negrita, los ríos con una sola estación en la*');
  L.push('*zona cañera: no admiten ningún corte intermedio.*');
  L.push('');

  /* ── Metodología ── */
  L.push('## 2. Metodología');
  L.push('');
  L.push('1. **Orientación del eje** aguas arriba → aguas abajo: el extremo más cercano al Río Cauca');
  L.push('   es la desembocadura.');
  L.push('2. **Proyección de estaciones** sobre el eje (`nearestPointOnLine`) para obtener su km');
  L.push('   acumulado. Todo el ordenamiento usa esta coordenada, nunca el orden del archivo.');
  L.push('3. **Depuración**: se descartan estaciones mal clasificadas y se deduplican los puntos');
  L.push('   físicos registrados dos veces (§4).');
  L.push('4. **Selección de cortes**: se descartan la primera y la última estación —son los extremos');
  L.push('   naturales del tramo— y de las intermedias se conservan solo las que caen dentro de la');
  L.push('   zona cañera. `n` estaciones útiles producen `n−1` tramos.');
  L.push('5. **Corte**: perpendicular local al eje en cada estación, materializada como una ranura de');
  L.push('   0,5 m que se resta del polígono. Se corta **secuencialmente**, verificando que cada corte');
  L.push('   separó de verdad el trozo.');
  L.push('');
  L.push('   El rumbo del cauce se mide sobre una base de 250 m. No puede ser más corta: los ejes');
  L.push('   traen un vértice cada 13–24 m, así que con una base menor el rumbo lo domina el zigzag');
  L.push('   de digitalización y la "perpendicular" sale girada, recortando un lóbulo lateral en vez');
  L.push('   de cruzar el corredor. Si un corte no separa, se reintenta con bases de 500, 1.000 y');
  L.push('   2.000 m y líneas de 4 a 16 km.');
  L.push('6. **Asignación**: cada trozo resultante se adjudica al tramo cuya franja de km contiene la');
  L.push('   mediana de sus vértices proyectados sobre el eje. Al usar el sistema de coordenadas del');
  L.push('   propio cauce, el método es inmune a los meandros.');
  L.push('7. **Área**: `turf.area`, geodésica sobre el esferoide WGS84 — nunca planimetría sobre');
  L.push('   grados.');
  L.push('');
  L.push('### Cortes preservados de Bolo y Fraile');
  L.push('');
  L.push('Los 4 cortes de Bolo y Fraile ya estaban versionados en `data/cortes_tramos.geojson` y sus');
  L.push('cifras publicadas, así que **se reutilizan tal cual en vez de regenerarlos**. No es un');
  L.push('detalle menor: el corte del Fraile en Puente Vía a Miranda es oblicuo al eje, y sustituirlo');
  L.push('por la perpendicular movía su tramo 1 de 78,56 a 92,77 ha. Los 13 ríos restantes usan');
  L.push('cortes perpendiculares generados automáticamente.');
  L.push('');
  L.push('### Columna cruda y columna normalizada');
  L.push('');
  L.push('`turf.area` es geodésica y ArcGIS calculó en MAGNA-Sirgas, así que difieren en torno al');
  L.push('0,26 %. Se reportan ambas: la **cruda** es el cálculo directo y la **normalizada** aplica');
  L.push('`factor = SUM_AREA_HA / suma repartida entre los tramos`, de modo que los tramos suman');
  L.push('exactamente el total oficial publicado de cada río. El divisor es la suma repartida y no el');
  L.push('área total del río para que el factor absorba también la fracción que se lleva la ranura de');
  L.push('corte; esa pérdida queda visible por separado en el cierre geométrico.');
  L.push('');
  L.push('### Cierre geométrico');
  L.push('');
  L.push('Métrica de control: suma de los tramos ÷ total del río. Debe dar 100 %. Un valor por debajo');
  L.push('indica área perdida y por encima, doble conteo.');
  L.push('');
  L.push('| Río | Cierre caña | Cierre buffer |');
  L.push('|---|---|---|');
  for (const r of [...rios].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
    L.push(`| ${r.nombre} | ${fmtCO(r.cierreCana * 100, 2)} % | ${fmtCO(r.cierreBuffer * 100, 2)} % |`);
  }
  L.push('');

  /* ── Resumen ── */
  L.push('## 3. Resumen por río');
  L.push('');
  L.push('| Río | Estaciones | En zona cañera | Cortes | Tramos | Buffer (ha) | Caña (ha) | % del buffer |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const r of [...rios].sort((a, b) => b.oficialHa - a.oficialHa)) {
    L.push(`| ${r.nombre} | ${r.estaciones.length} | ${r.estaciones.filter(s => s.enZona).length} | ` +
      `${r.cortes.length} | ${r.tramos.length} | ${fmtCO(r.bufTotal, 0)} | ` +
      `**${fmtCO(r.oficialHa)}** | ${fmtCO(r.oficialHa / r.bufTotal * 100, 1)} % |`);
  }
  L.push(`| **TOTAL** | | | | **${nTramos}** | | **${fmtCO(totalHa)}** | |`);
  L.push('');

  /* ── Detalle ── */
  L.push('## 4. Detalle por tramo');
  L.push('');
  L.push('El campo *zona* indica si la estación que abre el tramo está dentro de la zona cañera. Un');
  L.push('`no` significa que el tramo arranca en realidad donde el buffer entra al valle, aguas abajo');
  L.push('de esa estación de montaña.');
  L.push('');
  for (const r of [...rios].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
    L.push(`### ${r.nombre}`);
    L.push('');
    if (r.cortes.length === 0) {
      L.push('> **Sin desagregar.** Solo hay una estación dentro de la zona cañera, así que no existe');
      L.push('> ningún punto de corte intermedio. Es un vacío de monitoreo, no un error de cálculo.');
      L.push('');
    }
    L.push('| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const t of r.tramos) {
      const arriba = t.arriba ? `${t.arriba.corto} (n=${t.arriba.N})` : '—';
      const abajo  = t.abajo  ? `${t.abajo.corto} (n=${t.abajo.N})`   : '—';
      L.push(`| ${t.indice} | ${arriba} → ${abajo} | ${fmtCO(t.kmInicio, 1)}–${fmtCO(t.kmFin, 1)} | ${fmtCO(t.longitudKm, 1)} | ${fmtCO(t.bufferHa, 0)} | ${fmtCO(t.canaCrudaHa)} | **${fmtCO(t.canaNormHa)}** | ${fmtCO(t.canaNormHa / r.oficialHa * 100, 1)} % | ${t.arriba?.enZona ? 'sí' : 'no'} |`);
    }
    L.push(`| | **Total** | | | **${fmtCO(r.bufTotal, 0)}** | | **${fmtCO(r.oficialHa)}** | 100,0 % | |`);
    L.push('');
    if (r.fueraZona.length) {
      L.push(`*Estaciones fuera de la zona cañera (no utilizables como corte):* ` +
        r.fueraZona.map(s => `${s.corto} (km ${fmtCO(s.km, 1)})`).join('; ') + '.');
      L.push('');
    }
    if (r.descartadas.length) {
      L.push(`*Estaciones descartadas:* ` +
        r.descartadas.map(d => `${shortStationName(d.n)} — ${d.motivo}`).join('; ') + '.');
      L.push('');
    }
  }

  /* ── Anomalías ── */
  L.push('## 5. Anomalías de datos detectadas');
  L.push('');
  L.push('Se documentan para que puedan corregirse en la fuente; el análisis las maneja pero conviene');
  L.push('resolverlas en el Excel y el GeoJSON de origen.');
  L.push('');
  L.push('- **Grafías divergentes entre capas.** La cartografía escribe `Rio Fraile` y `Rio Zabaletas`;');
  L.push('  los puntos de calidad, `Rio Frayle` y `Rio Sabaletas`. Se unifican mediante una tabla de');
  L.push('  alias en `src/tramos/stations.js`. Sin ella, Zabaletas se queda sin estaciones y sus');
  L.push('  2.526,97 ha no se desagregan.');
  L.push('- **Puntos físicos duplicados.** Guabas registra "Puente después Mina La Victoria" (n=10) y');
  L.push('  "después Mina La Victoria" (n=7) en la misma coordenada; Tuluá hace lo propio en su');
  L.push('  desembocadura. Se conserva el registro con más muestras.');
  L.push('- **Estación mal clasificada.** `"Río Cauca - Antes río Risaralda"` figura bajo Río');
  L.push('  Risaralda; se excluye por decisión explícita.');
  L.push('- **Estaciones sobre subafluentes.** Valcanes (a 389 m del eje del Riofrío), Quebrada Los');
  L.push('  Lulos (147 m del Guabas), Río Guatica y Quebrada Chapata (88 m del Risaralda) miden');
  L.push('  cuerpos de agua distintos al cauce principal. Solo Chapata cae dentro de la zona cañera y');
  L.push('  se conserva como corte por decisión explícita, al marcar la confluencia de un afluente.');
  L.push('- **Río Parraga** tiene eje propio (46 km) y 3 estaciones, pero **ni buffer ni caña**');
  L.push('  asignada, por lo que queda fuera del alcance. Conviene confirmar que es lo esperado.');
  L.push('- **Guachal GG1 y GG2** aún no tienen datos de calidad (`N_Registros = 0`). Se incluyen para');
  L.push('  dejar la geometría lista, pero sus tramos no admiten contraste con mediciones todavía.');
  L.push('');

  /* ── Limitaciones ── */
  L.push('## 6. Limitaciones y advertencias');
  L.push('');
  L.push('- **Vacíos de monitoreo.** Guabas (1.825,85 ha) y Nima (896,63 ha) tienen una sola estación');
  L.push('  dentro de la zona cañera y quedan sin desagregar. Si la fase siguiente necesita resolución');
  L.push('  por tramo en esos ríos, hay que instalar estaciones intermedias.');
  L.push('- **Tramos altos con poca o ninguna caña.** Guadalajara y Tuluá presentan tramos con ~0 ha.');
  L.push('  Es correcto: están en el piedemonte, aguas arriba del cultivo.');
  L.push('- **El geovisor no coincide con este reporte.** La herramienta interactiva');
  L.push('  (`src/controls/CutLineTool.js`) sigue usando el método de semiplano infinito, que sobrestima');
  L.push('  por doble conteo en ríos meandriformes (el Palo cerraba en 112,38 %). **Las cifras válidas');
  L.push('  son las de este reporte.** Portar el método nuevo al visor está pendiente.');
  L.push('- **Precisión.** La ranura de corte consume entre 0,06 y 0,59 ha por río (< 0,02 %),');
  L.push('  absorbida por la normalización. La diferencia entre el área geodésica y la de ArcGIS es del');
  L.push('  orden del 0,26 % y también queda absorbida.');
  L.push('');
  L.push('---');
  L.push('');
  L.push('## Fuentes');
  L.push('');
  L.push('| Capa | Archivo |');
  L.push('|---|---|');
  L.push('| Buffer 700 m | `data/cartografia/Buffer_Zona_de_Estudio.geojson` |');
  L.push('| Caña de azúcar | `data/cartografia/Hectareas_CZ.geojson` (campo `SUM_AREA_HA`) |');
  L.push('| Ejes de tributarios | `data/cartografia/Tributarios_rios_cauca.geojson` |');
  L.push('| Río Cauca (orientación) | `data/cartografia/Rio_cauca.geojson` |');
  L.push('| Estaciones de calidad | `data/geovisor/puntos_calidad_tributarios.geojson` |');
  L.push('');
  L.push('Todas en WGS84 (EPSG:4326). Datos tabulares en `docs/tramos_cana_tributarios.csv`.');
  L.push('');

  fs.writeFileSync(destino, L.join('\n'), 'utf8');
}

/* ── Main ────────────────────────────────────────────────────────────── */

const ctx = {
  ...cargarContexto(),
  cana: read('data/cartografia/Hectareas_CZ.geojson'),
};

/* TRAMOS_RIOS=bolo,fraile limita la corrida a esos ríos (útil al depurar).
 * Ojo: en modo filtrado NO se reescribe cortes_tramos.geojson, para no perder
 * los cortes de los ríos que no se procesaron. */
const FILTRO = (process.env.TRAMOS_RIOS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const claves = clavesDeRios(ctx);

console.log(`Procesando ${claves.length} tributarios (Río Cauca excluido)…\n`);

const rios = [];
for (const k of claves) {
  const t0 = Date.now();
  const r = analizarRio(k, ctx);
  if (!r) { console.log(`  ${k.padEnd(14)} omitido (falta buffer, eje o caña)`); continue; }
  rios.push(r);
  console.log(
    `  ${r.nombre.padEnd(17)} ${String(r.cortes.length).padStart(2)} cortes ` +
    `${r.nPreservados ? `(${r.nPreservados} reutilizados)` : '                '} ` +
    `${String(r.tramos.length).padStart(2)} tramos  ` +
    `cierre ${fmt(r.cierreCana * 100).padStart(6)} %  ` +
    `${fmt(r.oficialHa).padStart(9)} ha  ${String(Date.now() - t0).padStart(5)} ms`);
}

const errores = verificar(rios);
console.log('\n── Puertas de verificación ─────────────────────────');
if (errores.length) {
  for (const e of errores) console.log(`  FALLA  ${e}`);
  console.log(`\n${errores.length} PROBLEMA(S). No se escribieron las salidas.`);
  process.exit(1);
}
console.log('  OK  todos los cortes separaron el buffer de forma limpia');
console.log('  OK  cierre geométrico ≥ 99,8 % en todos los ríos');
console.log('  OK  ningún tramo vacío con longitud significativa');
console.log('  OK  suma normalizada = SUM_AREA_HA en todos los ríos');

if (FILTRO.length) {
  console.log('\nModo filtrado: no se escriben las salidas.');
  for (const r of rios) {
    for (const t of r.tramos) {
      console.log(`  ${r.nombre} T${t.indice}: ${fmt(t.canaNormHa)} ha ` +
        `(buffer ${fmt(t.bufferHa, 0)} ha, km ${fmt(t.kmInicio, 1)}–${fmt(t.kmFin, 1)})`);
    }
  }
  process.exit(0);
}

const docs = path.join(ROOT, 'docs');
fs.mkdirSync(docs, { recursive: true });
escribirCSV(rios, path.join(docs, 'tramos_cana_tributarios.csv'));
escribirMD(rios, path.join(docs, 'tramos_cana_tributarios.md'));

/* Cortes de los 15 ríos, para que el geovisor los cargue por defecto.
 * Los preservados conservan su geometría original bit a bit. */
const cortesOut = [];
for (const r of rios) {
  for (const { estacion, linea, reutilizado, props } of r.lineas) {
    cortesOut.push({
      type: 'Feature',
      /* `tipo` y `metodo` describen cómo se creó el corte la PRIMERA vez, así
       * que en un corte reutilizado se arrastran verbatim. Si se recalcularan,
       * a la segunda corrida todos los cortes aparecerían como reutilizados y
       * se perdería el rastro de con qué criterio se trazó cada uno. */
      properties: reutilizado
        ? { ...props, km_eje: Number(estacion.km.toFixed(3)) }
        : {
            rio: r.nombre,
            estacion: estacion.nombre,
            km_eje: Number(estacion.km.toFixed(3)),
            tipo: 'auto',
            metodo: `perpendicular al eje, base de rumbo ${BASE_INICIAL * 1000} m`,
          },
      geometry: {
        type: 'LineString',
        coordinates: linea.geometry.coordinates.map(([x, y]) =>
          [Number(x.toFixed(6)), Number(y.toFixed(6))]),
      },
    });
  }
}
fs.writeFileSync(path.join(ROOT, CORTES_PATH),
  JSON.stringify({ type: 'FeatureCollection', features: cortesOut }, null, 2), 'utf8');

const nT = rios.reduce((s, r) => s + r.tramos.length, 0);
const ha = rios.reduce((s, r) => s + r.oficialHa, 0);
console.log(`\nTODAS LAS PRUEBAS PASARON`);
console.log(`${nT} tramos en ${rios.length} ríos | ${fmt(ha)} ha`);
console.log(`  docs/tramos_cana_tributarios.md`);
console.log(`  docs/tramos_cana_tributarios.csv`);
