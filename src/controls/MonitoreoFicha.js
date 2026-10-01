/* MonitoreoFicha.js — Sección interactiva de la ficha de un punto de la capa
 * "Monitoreo de calidad de agua". Se pinta dentro de #info-extra del panel de
 * información existente (InfoPanel.js), igual que la sección de caudal de las
 * estaciones hidrométricas: no es un panel nuevo.
 *
 * Recalcula en vivo, con las mismas fórmulas que docs/monitoreo_corredor.xlsx
 * (src/monitoreo/calculo.js), la concentración en la estación de cierre según
 * nutriente, condición hidrológica y % de remoción del corredor (0–40 %).
 * El histórico se muestra aparte, en texto, fuera de la escala del gráfico:
 * integra aportes puntuales y no es comparable con la proyección difusa.
 */

import { CONDICIONES, ESCENARIOS, REMOCION_MAX_VALIDADA } from '../config/monitoreo.js';
import { NUTRIENTES, caudal, proyectar, remocionParaMeta } from '../monitoreo/calculo.js';
import { fmt, escapeHtml } from '../utils/format.js';

const REM_MAX_PCT = REMOCION_MAX_VALIDADA * 100;

/* Selección compartida entre fichas: al pasar de un subtramo a otro se
 * conservan nutriente, condición y remoción, para comparar en igualdad. Las
 * metas van por nutriente porque sus unidades no son intercambiables. */
const _sel = { nut: 'N', cond: 'Promedio', remPct: 0, meta: { N: '', P: '' } };

export function renderMonitoreo(p, extra) {
  if (!extra) return;

  if (caudal(p, 'Promedio') == null) {
    extra.innerHTML =
      '<hr class="info-sep">' +
      '<div class="mon-nota">Sin caudal de estación: la concentración no se proyecta para este subtramo.</div>';
    return;
  }

  extra.innerHTML = plantilla(p);
  const $ = sel => extra.querySelector(sel);

  extra.querySelectorAll('.mon-seg button').forEach(b => {
    b.addEventListener('click', () => {
      _sel.nut = b.dataset.nut;
      $('.mon-meta-input').value = _sel.meta[_sel.nut];
      actualizar(p, extra);
    });
  });
  $('.mon-cond').addEventListener('change', e => { _sel.cond = e.target.value; actualizar(p, extra); });
  $('.mon-rem').addEventListener('input', e => { _sel.remPct = Number(e.target.value); actualizar(p, extra); });
  $('.mon-meta-input').addEventListener('input', e => { _sel.meta[_sel.nut] = e.target.value; actualizar(p, extra); });

  actualizar(p, extra);
}

/* ── Estructura (se pinta una vez por ficha) ─────────────────────────── */

function plantilla(p) {
  const opciones = CONDICIONES.map(c => {
    const q = caudal(p, c.id);
    return `<option value="${c.id}"${c.id === _sel.cond ? ' selected' : ''}${q == null ? ' disabled' : ''}>` +
           `${c.id}${q != null ? ` · ${fmt(q, 3)} m³/s` : ' · sin dato'}</option>`;
  }).join('');
  const ticks = ESCENARIOS.map(e => `<span>${fmt(e.remocion * 100, 0)} % · ${e.etiqueta}</span>`).join('');

  return `
    <hr class="info-sep">
    <div class="info-hist-title">Concentración proyectada en la estación de cierre</div>
    ${aviso(p)}
    <div class="mon-ctrl">
      <div class="mon-seg" role="group" aria-label="Parámetro">
        <button type="button" data-nut="N">N total</button>
        <button type="button" data-nut="P">P total</button>
      </div>
      <label class="mon-field">
        <span class="mon-lbl">Condición hidrológica (caudal de ${escapeHtml(p.estacion_hidro ?? '—')})</span>
        <select class="mon-cond">${opciones}</select>
      </label>
      <div class="mon-field">
        <label class="mon-lbl mon-lbl-row" for="mon-rem">
          <span>Remoción del corredor</span><output class="mon-rem-val" for="mon-rem"></output>
        </label>
        <input id="mon-rem" class="mon-rem" type="range" min="0" max="${REM_MAX_PCT}" step="0.1"
               value="${Math.min(_sel.remPct, REM_MAX_PCT)}">
        <div class="mon-ticks">${ticks}</div>
      </div>
    </div>
    <div class="mon-res" aria-live="polite">
      <div class="mon-res-conc"><span class="mon-res-val"></span> <span class="mon-res-unit"></span></div>
      <div class="mon-res-sub mon-res-carga"></div>
      <div class="mon-res-sub mon-res-base"></div>
    </div>
    <div class="mon-chart-wrap"></div>
    <div class="mon-field mon-meta">
      <label class="mon-lbl" for="mon-meta">Meta de concentración (<span class="mon-meta-unit"></span>), opcional</label>
      <input id="mon-meta" class="mon-meta-input" type="number" min="0" step="any" inputmode="decimal"
             value="${escapeHtml(_sel.meta[_sel.nut])}">
      <div class="mon-meta-out" aria-live="polite"></div>
    </div>
    <div class="mon-hist"></div>`;
}

function aviso(p) {
  if (p.estado === 'Excluida') {
    const pct = p.pct_puntual_n != null ? `${fmt(p.pct_puntual_n, 1)} % de la carga total de N` : 'dominante';
    return `<div class="mon-aviso" role="note"><span aria-hidden="true">⚠</span><div>` +
      `<strong>Carga puntual dominante</strong> (${pct}). La meta de remoción no es interpretable como ` +
      `objetivo del corredor en este subtramo.</div></div>`;
  }
  if (p.estado === 'Pendiente') {
    return `<div class="mon-aviso" role="note"><span aria-hidden="true">⚠</span><div>` +
      `<strong>Dominancia de la carga puntual no resuelta.</strong> ${escapeHtml(p.criterio_dominancia ?? '')}. ` +
      `La meta de remoción no es interpretable todavía como objetivo del corredor.</div></div>`;
  }
  return '';
}

/* ── Recalculo en vivo ───────────────────────────────────────────────── */

function actualizar(p, extra) {
  const $ = sel => extra.querySelector(sel);
  const nut = NUTRIENTES[_sel.nut];
  const r = _sel.remPct / 100;
  const res = proyectar(p, _sel.nut, _sel.cond, r);

  extra.querySelectorAll('.mon-seg button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.nut === _sel.nut)));
  $('.mon-rem-val').textContent = `${fmt(_sel.remPct, 1)} %`;
  $('.mon-meta-unit').textContent = nut.unidadConc;

  if (!res) {
    $('.mon-res-val').textContent = '—';
    $('.mon-res-unit').textContent = '';
    $('.mon-res-carga').textContent = `Sin caudal para la condición ${_sel.cond}.`;
    $('.mon-res-base').textContent = '';
    $('.mon-chart-wrap').innerHTML = '';
    $('.mon-meta-out').innerHTML = '';
    return;
  }

  $('.mon-res-val').textContent = fmt(res.conc, 4);
  $('.mon-res-unit').textContent = nut.unidadConc;
  $('.mon-res-carga').textContent =
    `Carga ${fmt(res.carga, 2)} ${nut.unidadCarga} · Q ${_sel.cond.toLowerCase()} ${fmt(res.q, 3)} m³/s`;
  $('.mon-res-base').textContent = r > 0
    ? `Sin corredor: ${fmt(res.concBase, 4)} ${nut.unidadConc} (−${fmt(res.concBase - res.conc, 4)})`
    : 'Condición base, sin corredor.';

  const meta = leerMeta();
  const rMeta = meta.valor != null ? remocionParaMeta(res.concBase, meta.valor) : null;
  $('.mon-chart-wrap').innerHTML = grafico(res, r, nut, meta.valor, rMeta);
  conectarGrafico($('.mon-chart-wrap'), res, nut, extra);
  $('.mon-meta-out').innerHTML = textoMeta(p, res, nut, meta, rMeta);
  $('.mon-meta-out .mon-meta-ir')?.addEventListener('click', ev => {
    _sel.remPct = Number(ev.currentTarget.dataset.rem);
    $('.mon-rem').value = String(_sel.remPct);
    actualizar(p, extra);
  });

  const hist = p[nut.hist];
  const n = p[nut.nHist];
  $('.mon-hist').innerHTML = hist != null
    ? `<div>Histórico medido en la estación: <strong>${nut.nombre} ${fmt(hist, 4)} ${nut.unidadConc.replace(/^mg [NP]\//, 'mg/')}</strong>` +
      ` (media de ${n} registro${n === 1 ? '' : 's'}).</div>` +
      '<div class="mon-hist-nota">El histórico incluye aportes puntuales y otros difusos de la cuenca; no es ' +
      'directamente comparable con la concentración difusa proyectada, que solo representa la caña del subtramo.</div>'
    : '<div>Sin histórico medido de este parámetro en la estación.</div>';
}

function leerMeta() {
  const txt = String(_sel.meta[_sel.nut] ?? '').trim();
  if (!txt) return { valor: null, error: null };
  const v = Number(txt.replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return { valor: null, error: 'Ingresar una concentración mayor que 0.' };
  return { valor: v, error: null };
}

function textoMeta(p, res, nut, meta, rMeta) {
  if (meta.error) return `<div class="mon-meta-err">${meta.error}</div>`;
  if (meta.valor == null) return '';
  const salvedad = p.estado !== 'Incluida'
    ? ' <span class="mon-meta-salvedad">No interpretable como objetivo del corredor en este subtramo.</span>' : '';
  if (rMeta <= 0) {
    return `<div>La concentración sin corredor (${fmt(res.concBase, 4)} ${nut.unidadConc}) ya cumple la meta: ` +
           `no se requiere remoción.${salvedad}</div>`;
  }
  const pct = rMeta * 100;
  if (pct > REM_MAX_PCT + 1e-9) {
    return `<div class="mon-meta-err"><span aria-hidden="true">⚠</span> Remoción necesaria: <strong>${fmt(pct, 1)} %</strong>, ` +
           `por encima del ${fmt(REM_MAX_PCT, 0)} % validado por el proyecto. La meta no se alcanza solo con el ` +
           `corredor.${salvedad}</div>`;
  }
  return `<div>Remoción necesaria: <strong>${fmt(pct, 1)} %</strong>, dentro del rango validado ` +
         `(0–${fmt(REM_MAX_PCT, 0)} %).${salvedad}</div>` +
         `<button type="button" class="mon-meta-ir" data-rem="${Math.round(pct * 10) / 10}">` +
         `Llevar el control a ${fmt(pct, 1)} %</button>`;
}

/* ── Gráfico: concentración frente a remoción (una sola serie) ───────── */
/* Lineal, de la base (0 %) al escenario 2 (40 %). Marcas en los tres
 * escenarios del Excel, punto en la remoción elegida y, si hay meta, una
 * referencia horizontal. El histórico NO va en esta escala (ver arriba). */

const G = { w: 272, h: 132, l: 44, r: 18, t: 14, b: 26 };

function escalas(res, meta) {
  const techo = Math.max(res.concBase, meta ?? 0) * 1.12;
  const ymax = redondearArriba(techo);
  const pw = G.w - G.l - G.r;
  const ph = G.h - G.t - G.b;
  return {
    ymax,
    x: pct => G.l + (pct / REM_MAX_PCT) * pw,
    y: c => G.t + (1 - c / ymax) * ph,
    pct: px => Math.min(REM_MAX_PCT, Math.max(0, ((px - G.l) / pw) * REM_MAX_PCT)),
  };
}

/* Máximo "redondo" del eje: 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10^k. */
function redondearArriba(v) {
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const m = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(k => k * e >= v - 1e-12);
  return m * e;
}

function decimales(ymax) {
  return Math.max(0, Math.min(5, 1 - Math.floor(Math.log10(ymax))));
}

function grafico(res, r, nut, meta, rMeta) {
  const s = escalas(res, meta);
  const conc = pct => res.concBase * (1 - pct / 100);
  const d = decimales(s.ymax);
  const ticksY = [0, s.ymax / 2, s.ymax];
  const x0 = s.x(0), x1 = s.x(REM_MAX_PCT);

  let svg = `<svg class="mon-chart" viewBox="0 0 ${G.w} ${G.h}" role="img" ` +
    `aria-label="Concentración de ${nut.nombre} en función de la remoción del corredor, de ` +
    `${fmt(conc(0), 4)} a ${fmt(conc(REM_MAX_PCT), 4)} ${nut.unidadConc}">`;

  /* Grilla y eje Y (recesivos) */
  for (const v of ticksY) {
    svg += `<line class="mon-grid" x1="${x0}" x2="${x1}" y1="${s.y(v)}" y2="${s.y(v)}"/>` +
           `<text class="mon-axis" x="${x0 - 5}" y="${s.y(v) + 3}" text-anchor="end">${fmt(v, d)}</text>`;
  }
  svg += `<text class="mon-axis" x="${x0 - 5}" y="${G.t - 5}" text-anchor="end">${nut.unidadConc}</text>`;

  /* Eje X con los escenarios del Excel */
  for (const e of ESCENARIOS) {
    const pct = e.remocion * 100;
    svg += `<text class="mon-axis" x="${s.x(pct)}" y="${G.h - 12}" text-anchor="middle">${fmt(pct, 0)} %</text>` +
           `<text class="mon-axis mon-axis-sub" x="${s.x(pct)}" y="${G.h - 3}" text-anchor="middle">${e.etiqueta}</text>`;
  }

  /* Meta (referencia horizontal) */
  if (meta != null) {
    svg += `<line class="mon-meta-line" x1="${x0}" x2="${x1}" y1="${s.y(meta)}" y2="${s.y(meta)}"/>` +
           `<text class="mon-axis mon-meta-lbl" x="${x1}" y="${s.y(meta) - 4}" text-anchor="end">Meta</text>`;
  }

  /* Serie */
  svg += `<line class="mon-serie" x1="${x0}" y1="${s.y(conc(0))}" x2="${x1}" y2="${s.y(conc(REM_MAX_PCT))}"/>`;
  for (const e of ESCENARIOS) {
    const pct = e.remocion * 100;
    svg += `<circle class="mon-esc" cx="${s.x(pct)}" cy="${s.y(conc(pct))}" r="3"/>`;
  }
  if (rMeta != null && rMeta > 0 && rMeta * 100 <= REM_MAX_PCT + 1e-9) {
    svg += `<circle class="mon-meta-pt" cx="${s.x(rMeta * 100)}" cy="${s.y(meta)}" r="3.5"/>`;
  }
  svg += `<circle class="mon-actual" cx="${s.x(r * 100)}" cy="${s.y(conc(r * 100))}" r="4.5"/>`;

  /* Capa de lectura al pasar el puntero (crosshair + valor) */
  svg += `<g class="mon-hover" visibility="hidden"><line class="mon-cross" y1="${G.t}" y2="${G.h - G.b}"/>` +
         `<text class="mon-tip" y="${G.t - 4}" text-anchor="middle"></text></g>` +
         `<rect class="mon-hit" x="${x0 - 6}" y="${G.t}" width="${x1 - x0 + 12}" height="${G.h - G.t - G.b}"/>`;
  return svg + '</svg>';
}

/* Hover: lectura de la concentración en cualquier remoción; clic: llevar el
 * control a ese punto. */
function conectarGrafico(wrap, res, nut, extra) {
  const svg = wrap.querySelector('svg');
  if (!svg) return;
  const hit = svg.querySelector('.mon-hit');
  const g = svg.querySelector('.mon-hover');
  const cross = svg.querySelector('.mon-cross');
  const tip = svg.querySelector('.mon-tip');
  const s = escalas(res, leerMeta().valor);

  const pctDe = ev => {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return s.pct(pt.matrixTransform(svg.getScreenCTM().inverse()).x);
  };

  hit.addEventListener('pointermove', ev => {
    const pct = pctDe(ev);
    const x = s.x(pct);
    cross.setAttribute('x1', x); cross.setAttribute('x2', x);
    tip.setAttribute('x', Math.min(G.w - 60, Math.max(G.l + 50, x)));
    tip.textContent = `${fmt(pct, 1)} % → ${fmt(res.concBase * (1 - pct / 100), 4)} ${nut.unidadConc}`;
    g.setAttribute('visibility', 'visible');
  });
  hit.addEventListener('pointerleave', () => g.setAttribute('visibility', 'hidden'));
  hit.addEventListener('click', ev => {
    const rem = extra.querySelector('.mon-rem');
    rem.value = String(Math.round(pctDe(ev) * 10) / 10);
    rem.dispatchEvent(new Event('input'));
  });
}
