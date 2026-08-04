/* build_uso_suelo_tramos.mjs — Composición de uso del suelo por tramo.
 *
 *     cd tools/tramos && node build_uso_suelo_tramos.mjs
 *
 * Cruza la capa de cobertura y uso del suelo de la CVC
 * (data/databases/Uso_del_suelo_ZP.geojson) contra los mismos tramos que usa el
 * análisis de caña, y reporta qué fracción de cada tramo es caña, pastos,
 * bosque, zona urbana, etc.
 *
 * Produce:
 *     docs/uso_suelo_tramos.csv           (agrupado en 18 clases)
 *     docs/uso_suelo_tramos_detalle.csv   (los 103 códigos de 25k)
 *     docs/uso_suelo_tramos.md
 *
 * ── Dos decisiones que conviene tener presentes ──────────────────────────
 *
 * 1. La caña NO se toma de esta capa. `Hectareas_CZ.geojson` es la fuente
 *    autoritativa porque tiene resuelto el solapamiento entre buffers vecinos
 *    (Fraile–Bolo–Guachal, Amaime–Nima), cosa que esta capa no. Las demás
 *    clases se reescalan para que el tramo siga cerrando en 100 %.
 *
 * 2. La capa es de la CVC, así que cubre el Valle del Cauca y nada más:
 *    Risaralda queda con 0 % de cobertura y Palo con 1,5 %. Ambos se excluyen.
 *    Desbaratado se incluye con el 49,8 % que sí tiene, marcado como parcial.
 */

import * as turf from '@turf/turf';
import fs from 'node:fs';
import path from 'node:path';

globalThis.turf = turf;

import {
  ROOT, leer, safeIntersect, areaHa, normalizeRiver,
  cargarContexto, clavesDeRios, segmentarRio,
} from './segmentacion.mjs';
import { GRUPOS, ORDEN_GRUPOS, clasificar, codigosSinMapear } from './clases_uso.mjs';

/* ── Parámetros ──────────────────────────────────────────────────────── */

const USO_PATH = 'data/databases/Uso_del_suelo_ZP.geojson';

/* Ríos sin cobertura aprovechable en la capa de la CVC (jurisdicción). */
const EXCLUIDOS = {
  palo:      'dept. del Cauca, jurisdicción CRC — solo 1,5 % del buffer cubierto',
  risaralda: 'dept. de Risaralda, jurisdicción CARDER — 0 % del buffer cubierto',
};

/* Por debajo de esto un río se marca como cobertura parcial en el reporte. */
const COBERTURA_COMPLETA = 0.95;

/* Tolerancia del cierre por tramo: suma de clases ÷ área del fragmento. */
const TOL_CIERRE = 0.005;

/* ── Utilidades ──────────────────────────────────────────────────────── */

const fmt = (v, d = 2) => Number(v).toFixed(d);
const fmtCO = (v, d = 2) => Number(v).toLocaleString('es-CO',
  { minimumFractionDigits: d, maximumFractionDigits: d });

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const bboxOverlap = (a, b) => !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);

/* ── Análisis de un río ──────────────────────────────────────────────── */

function analizarRio(clave, ctx, usoIdx, canaPorTramo) {
  const seg = segmentarRio(clave, ctx);
  if (!seg) return null;

  const nTramos = seg.tramos.length;

  /* Área por (tramo, código de cobertura). Se recorre polígono a polígono con
   * prefiltro por bbox: la capa tiene 12.101 polígonos y solo unos cientos
   * caen sobre cada río. */
  const porTramo = Array.from({ length: nTramos }, () => new Map());
  let cubierta = 0;

  for (const { poly, tramo } of seg.piezas) {
    const bbPieza = turf.bbox(poly);
    for (const u of usoIdx) {
      if (!bboxOverlap(bbPieza, u.bb)) continue;
      const clip = safeIntersect(poly, u.f);
      if (!clip) continue;
      const ha = areaHa(clip);
      if (ha <= 0) continue;
      cubierta += ha;
      const m = porTramo[tramo];
      m.set(u.cod, (m.get(u.cod) ?? 0) + ha);
    }
  }

  const cobertura = cubierta / seg.bufTotal;

  /* Sustituir la caña por la de Hectareas_CZ y reescalar el resto.
   *
   * El área del tramo se conoce con exactitud (es el fragmento de buffer). La
   * caña autoritativa ocupa una parte; las demás clases, que vienen de esta
   * capa, se reescalan proporcionalmente para llenar lo que queda. Así el
   * tramo cierra en 100 % y se conserva la composición RELATIVA de los otros
   * usos, que es lo que esta capa sí sabe. */
  const tramos = seg.tramos.map((t, i) => {
    const m = porTramo[i];
    const canaUso = (m.get('22171') ?? 0) + (m.get('22172') ?? 0);
    const canaCZ  = canaPorTramo[i] ?? 0;

    /* Todo lo que no es caña, según la capa de uso */
    const otras = [...m.entries()].filter(([cod]) => cod !== '22171' && cod !== '22172');
    const sumaOtras = otras.reduce((s, [, ha]) => s + ha, 0);

    /* En un tramo con cobertura parcial el denominador es lo cubierto, no el
     * área del fragmento: de lo contrario los porcentajes describirían huecos
     * sin dato como si fueran una clase. */
    const areaRef = cobertura >= COBERTURA_COMPLETA
      ? t.bufferHa
      : canaUso + sumaOtras;

    const restante = Math.max(0, areaRef - canaCZ);
    const factor = sumaOtras > 0 ? restante / sumaOtras : 0;

    const clases = otras.map(([cod, ha]) => {
      const c = clasificar({ COD_COB25: cod, COD_INT_CVC: null });
      return { cod, grupo: c.grupo, clase: c.clase, ha: ha * factor };
    });
    clases.push({ cod: '22171', grupo: 'CANA', clase: 'Caña de azúcar', ha: canaCZ });

    return { ...t, areaRef, canaUso, canaCZ, factorReescalado: factor, clases };
  });

  return { ...seg, cobertura, cubierta, tramos, canaPorTramo };
}

/* ── Puertas de verificación ─────────────────────────────────────────── */

function verificar(rios) {
  const errores = [];
  for (const r of rios) {
    for (const t of r.tramos) {
      const suma = t.clases.reduce((s, c) => s + c.ha, 0);
      if (t.areaRef > 0 && Math.abs(suma / t.areaRef - 1) > TOL_CIERRE) {
        errores.push(`${r.nombre} T${t.indice}: las clases suman ${fmt(suma)} ha ` +
          `frente a ${fmt(t.areaRef)} ha de referencia`);
      }
      const pct = t.clases.reduce((s, c) => s + (t.areaRef > 0 ? c.ha / t.areaRef * 100 : 0), 0);
      if (t.areaRef > 0 && Math.abs(pct - 100) > 0.01) {
        errores.push(`${r.nombre} T${t.indice}: los porcentajes suman ${fmt(pct)} %`);
      }
      const cana = t.clases.find(c => c.grupo === 'CANA');
      if (Math.abs((cana?.ha ?? 0) - t.canaCZ) > 0.001) {
        errores.push(`${r.nombre} T${t.indice}: la caña no coincide con Hectareas_CZ`);
      }
    }
    const sumaBuf = r.tramos.reduce((s, t) => s + t.bufferHa, 0);
    if (Math.abs(sumaBuf / r.bufTotal - 1) > 0.002) {
      errores.push(`${r.nombre}: los tramos suman ${fmt(sumaBuf)} ha de ` +
        `${fmt(r.bufTotal)} ha de buffer`);
    }
  }
  return errores;
}

/* ── Salidas ─────────────────────────────────────────────────────────── */

function escribirCSV(rios, destino, agrupado) {
  const cols = ['rio', 'tramo', 'estacion_aguas_arriba', 'estacion_aguas_abajo',
    'km_inicio', 'km_fin', 'area_tramo_ha', 'area_referencia_ha', 'cobertura_pct',
    agrupado ? 'grupo' : 'cod_cob25', agrupado ? 'nombre_grupo' : 'clase',
    'area_ha', 'pct', 'fuente_cana', 'cana_ha_uso_suelo', 'factor_reescalado'];
  const filas = [cols.join(',')];

  for (const r of rios) {
    for (const t of r.tramos) {
      /* agrupar o no según el CSV que se esté escribiendo */
      const acc = new Map();
      for (const c of t.clases) {
        const k = agrupado ? c.grupo : c.cod;
        const prev = acc.get(k) ?? { ha: 0, etiqueta: agrupado ? GRUPOS[c.grupo] : c.clase };
        prev.ha += c.ha;
        acc.set(k, prev);
      }
      const orden = agrupado
        ? ORDEN_GRUPOS.filter(g => acc.has(g))
        : [...acc.keys()].sort();

      for (const k of orden) {
        const { ha, etiqueta } = acc.get(k);
        if (ha <= 0) continue;
        filas.push([
          csvCell(r.nombre), t.indice,
          csvCell(t.arriba?.nombre ?? ''), csvCell(t.abajo?.nombre ?? ''),
          fmt(t.kmInicio, 3), fmt(t.kmFin, 3),
          fmt(t.bufferHa), fmt(t.areaRef), fmt(r.cobertura * 100, 1),
          k, csvCell(etiqueta),
          fmt(ha), fmt(t.areaRef > 0 ? ha / t.areaRef * 100 : 0),
          k === 'CANA' || k === '22171' ? 'Hectareas_CZ' : 'Uso_del_suelo_ZP',
          fmt(t.canaUso), fmt(t.factorReescalado, 6),
        ].join(','));
      }
    }
  }

  filas.push('');
  filas.push(`# generado,${new Date().toISOString()}`);
  filas.push('# cobertura,capa CVC Uso_del_suelo_ZP (escala 1:25.000)');
  filas.push('# cana,tomada de Hectareas_CZ por tener resuelto el solape entre buffers vecinos');
  filas.push('# resto,reescalado para que el tramo cierre en 100 % del area de referencia');
  filas.push('# excluidos,' + csvCell(Object.entries(EXCLUIDOS)
    .map(([k, v]) => `${k}: ${v}`).join(' | ')));

  fs.writeFileSync(destino, filas.join('\n'), 'utf8');
}

function escribirMD(rios, destino) {
  const L = [];
  const hoy = new Date().toISOString().slice(0, 10);
  const nTramos = rios.reduce((s, r) => s + r.tramos.length, 0);

  L.push('# Uso del suelo por tramo — tributarios del Río Cauca');
  L.push('');
  L.push('**Proyecto 890K | UAO × ASOCAÑA | Fase I — Corredor Biológico**  ');
  L.push(`*Generado el ${hoy} por \`tools/tramos/build_uso_suelo_tramos.mjs\`*`);
  L.push('');
  L.push(`Composición de coberturas dentro del buffer de 700 m, desagregada por los mismos tramos`);
  L.push(`del análisis de caña. **${nTramos} tramos en ${rios.length} ríos.**`);
  L.push('');
  L.push('Datos: [uso_suelo_tramos.csv](uso_suelo_tramos.csv) (agrupado) y');
  L.push('[uso_suelo_tramos_detalle.csv](uso_suelo_tramos_detalle.csv) (103 códigos de 25k).');
  L.push('');

  L.push('## 1. Advertencias antes de usar estas cifras');
  L.push('');
  L.push('**La capa no cubre todo el corredor.** Es cartografía de la CVC, así que se detiene en el');
  L.push('límite del Valle del Cauca:');
  L.push('');
  L.push('| Río | Cobertura del buffer | Tratamiento |');
  L.push('|---|---|---|');
  L.push('| Risaralda | 0 % | **excluido** — dept. de Risaralda, jurisdicción CARDER |');
  L.push('| Palo | 1,5 % | **excluido** — dept. del Cauca, jurisdicción CRC |');
  for (const r of rios.filter(r => r.cobertura < COBERTURA_COMPLETA)) {
    L.push(`| ${r.nombre} | ${fmtCO(r.cobertura * 100, 1)} % | **parcial** — los porcentajes describen ` +
      'solo la fracción con datos |');
  }
  L.push('');
  L.push('**La caña no sale de esta capa.** Se toma de `Hectareas_CZ.geojson`, que tiene resuelto el');
  L.push('solapamiento entre buffers vecinos. La capa de uso del suelo sobrestima la caña frente a');
  L.push('ella, por vigencia distinta y por no descontar el solape. Las demás clases se reescalan');
  L.push('para que cada tramo cierre en 100 %; el CSV trae `cana_ha_uso_suelo` y `factor_reescalado`');
  L.push('para que el ajuste sea auditable.');
  L.push('');
  L.push('**La vigencia es heterogénea.** Cada cuenca se levantó en un año distinto, entre 2014 y');
  L.push('2025, así que la comparación entre ríos mezcla fechas.');
  L.push('');
  L.push('**Es cobertura, no uso.** La capa no trae el campo `COD_USO25`; lo que aquí se agrupa como');
  L.push('«uso» es cobertura del suelo, que es la misma base desde la que la CVC infiere el uso.');
  L.push('');

  L.push('## 2. Composición por río');
  L.push('');
  const gruposUsados = ORDEN_GRUPOS.filter(g =>
    rios.some(r => r.tramos.some(t => t.clases.some(c => c.grupo === g && c.ha > 0))));
  L.push('| Río | Cobertura | ' + gruposUsados.map(g => g).join(' | ') + ' |');
  L.push('|---|---|' + gruposUsados.map(() => '---').join('|') + '|');
  for (const r of [...rios].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
    const tot = r.tramos.reduce((s, t) => s + t.areaRef, 0);
    const porG = new Map();
    for (const t of r.tramos) for (const c of t.clases) {
      porG.set(c.grupo, (porG.get(c.grupo) ?? 0) + c.ha);
    }
    L.push(`| ${r.nombre} | ${fmtCO(r.cobertura * 100, 0)} % | ` +
      gruposUsados.map(g => {
        const v = porG.get(g) ?? 0;
        return v > 0 ? fmtCO(v / tot * 100, 1) : '—';
      }).join(' | ') + ' |');
  }
  L.push('');
  L.push('Códigos: ' + gruposUsados.map(g => `**${g}** ${GRUPOS[g]}`).join(' · ') + '.');
  L.push('');

  L.push('## 3. Detalle por tramo');
  L.push('');
  for (const r of [...rios].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
    L.push(`### ${r.nombre}`);
    L.push('');
    if (r.cobertura < COBERTURA_COMPLETA) {
      L.push(`> **Cobertura parcial (${fmtCO(r.cobertura * 100, 1)} %).** Los porcentajes describen`);
      L.push('> únicamente la parte del buffer con datos de la CVC.');
      L.push('');
    }
    for (const t of r.tramos) {
      const arriba = t.arriba ? t.arriba.corto : '—';
      const abajo = t.abajo ? t.abajo.corto : '—';
      L.push(`**Tramo ${t.indice}** — ${arriba} → ${abajo} · km ${fmtCO(t.kmInicio, 1)}–${fmtCO(t.kmFin, 1)} · ` +
        `${fmtCO(t.bufferHa, 0)} ha`);
      L.push('');
      L.push('| Grupo | ha | % |');
      L.push('|---|---|---|');
      const porG = new Map();
      for (const c of t.clases) porG.set(c.grupo, (porG.get(c.grupo) ?? 0) + c.ha);
      for (const g of ORDEN_GRUPOS) {
        const v = porG.get(g) ?? 0;
        if (v <= 0.005) continue;
        L.push(`| ${GRUPOS[g]} | ${fmtCO(v)} | ${fmtCO(v / t.areaRef * 100, 1)} |`);
      }
      L.push('');
    }
  }

  L.push('---');
  L.push('');
  L.push('## Fuentes');
  L.push('');
  L.push('| Capa | Archivo |');
  L.push('|---|---|');
  L.push('| Cobertura y uso del suelo | `data/databases/Uso_del_suelo_ZP.geojson` (CVC, 1:25.000) |');
  L.push('| Buffer 700 m | `data/cartografia/Buffer_Zona_de_Estudio.geojson` |');
  L.push('| Caña (autoritativa) | `data/cartografia/Hectareas_CZ.geojson` |');
  L.push('| Cortes de tramo | `data/cortes_tramos.geojson` |');
  L.push('');
  L.push('Clasificación según «GeoCVC — Guía rápida temática: Cobertura y uso del suelo, 2022»,');
  L.push('dominios `Dom_Cob_CLC_CVC_25k` y `Dom_Cob_Int_Grupo_UA`. La tabla código → grupo está en');
  L.push('`tools/tramos/clases_uso.mjs`.');
  L.push('');

  fs.writeFileSync(destino, L.join('\n'), 'utf8');
}

/* ── Main ────────────────────────────────────────────────────────────── */

const ctx = cargarContexto();

console.log(`Cargando ${USO_PATH}…`);
const uso = leer(USO_PATH);

/* Puerta de arranque: ningún código sin grupo asignado. */
const faltan = codigosSinMapear(uso.features);
if (faltan.size) {
  console.log('\nFALLA  códigos COD_COB25 sin grupo en clases_uso.mjs:');
  for (const [cod, n] of [...faltan].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cod}  (${n} polígonos)`);
  }
  process.exit(1);
}

const usoIdx = uso.features.map(f => ({
  f, bb: turf.bbox(f), cod: String(f.properties.COD_COB25),
}));
console.log(`${usoIdx.length} polígonos de cobertura, ${new Set(usoIdx.map(u => u.cod)).size} clases\n`);

/* Caña por tramo, del análisis ya publicado. */
const canaCsv = fs.readFileSync(path.join(ROOT, 'docs/tramos_cana_tributarios.csv'), 'utf8');
const canaPorRio = {};
for (const linea of canaCsv.split('\n').slice(1)) {
  const c = linea.split(',');
  if (c.length < 13 || !/^\d+$/.test(c[1])) continue;
  (canaPorRio[normalizeRiver(c[0])] ??= [])[Number(c[1]) - 1] = parseFloat(c[11]);
}

const claves = clavesDeRios(ctx).filter(k => {
  if (EXCLUIDOS[k]) {
    console.log(`  ${k.padEnd(14)} excluido — ${EXCLUIDOS[k]}`);
    return false;
  }
  return true;
});

console.log(`\nProcesando ${claves.length} tributarios…\n`);

const rios = [];
for (const k of claves) {
  const t0 = Date.now();
  const r = analizarRio(k, ctx, usoIdx, canaPorRio[k] ?? []);
  if (!r) { console.log(`  ${k.padEnd(14)} omitido (falta buffer o eje)`); continue; }
  rios.push(r);
  const nClases = new Set(r.tramos.flatMap(t => t.clases.map(c => c.grupo))).size;
  console.log(
    `  ${r.nombre.padEnd(17)} ${String(r.tramos.length).padStart(2)} tramos  ` +
    `${String(nClases).padStart(2)} grupos  cobertura ${fmt(r.cobertura * 100, 1).padStart(6)} %  ` +
    `${String(Date.now() - t0).padStart(6)} ms`);
}

const errores = verificar(rios);
console.log('\n── Puertas de verificación ─────────────────────────');
if (errores.length) {
  for (const e of errores) console.log(`  FALLA  ${e}`);
  console.log(`\n${errores.length} PROBLEMA(S). No se escribieron las salidas.`);
  process.exit(1);
}
console.log('  OK  todos los COD_COB25 tienen grupo asignado');
console.log('  OK  las clases de cada tramo suman su área de referencia');
console.log('  OK  los porcentajes de cada tramo suman 100,00 %');
console.log('  OK  la caña coincide con docs/tramos_cana_tributarios.csv');
console.log('  OK  los tramos de cada río suman el área del buffer');

const docs = path.join(ROOT, 'docs');
fs.mkdirSync(docs, { recursive: true });
escribirCSV(rios, path.join(docs, 'uso_suelo_tramos.csv'), true);
escribirCSV(rios, path.join(docs, 'uso_suelo_tramos_detalle.csv'), false);
escribirMD(rios, path.join(docs, 'uso_suelo_tramos.md'));

console.log('\nTODAS LAS PRUEBAS PASARON');
console.log(`${rios.reduce((s, r) => s + r.tramos.length, 0)} tramos en ${rios.length} ríos`);
console.log('  docs/uso_suelo_tramos.csv');
console.log('  docs/uso_suelo_tramos_detalle.csv');
console.log('  docs/uso_suelo_tramos.md');
