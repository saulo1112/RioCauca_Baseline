/* ProfileGallery.js — Galería de perfiles longitudinales del Informe Fase 1.
 *
 * Reúne las 118 figuras del Capítulo 3 (Río Cauca y los quince tributarios),
 * separadas por río y por tipo: parámetros fisicoquímicos y caudal. Las
 * imágenes y su índice (manifest.json) los genera
 * scripts/extraer_perfiles_informe.py a partir del .docx del informe.
 *
 * API:
 *   open({ tipo, rio })  — abre la galería; tipo 'calidad' | 'caudal'
 *   close()
 */

import { BUILD_VERSION } from '../layers/geojson.js';
import { escapeHtml } from '../utils/format.js';

const BASE = 'data/perfiles_informe/';

const TIPOS = [
  { id: 'calidad', label: 'Calidad fisicoquímica' },
  { id: 'caudal',  label: 'Caudal' },
];

let _manifest = null;
let _overlay = null;
let _rio = 'Río Cauca';
let _tipo = 'calidad';
let _index = 0;

async function _loadManifest() {
  if (_manifest) return _manifest;
  const resp = await fetch(`${BASE}manifest.json?v=${BUILD_VERSION}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  _manifest = await resp.json();
  return _manifest;
}

const _figuras = (rio, tipo) =>
  _manifest?.rios.find(r => r.rio === rio)?.figuras.filter(f => f.tipo === tipo) ?? [];

export async function open({ tipo = 'calidad', rio } = {}) {
  if (_overlay) close();
  _tipo = tipo;
  if (rio) _rio = rio;
  _index = 0;

  _overlay = document.createElement('div');
  _overlay.className = 'pg-overlay';
  _overlay.innerHTML = `
    <div class="pg-container" role="dialog" aria-label="Perfiles longitudinales">
      <div class="pg-header">
        <div>
          <div class="pg-title">Perfiles longitudinales</div>
          <div class="pg-subtitle">Calidad del agua y caudal por río</div>
        </div>
        <button class="pg-close" type="button" title="Cerrar (Esc)">✕</button>
      </div>
      <div class="pg-body">
        <nav class="pg-rivers"></nav>
        <section class="pg-view">
          <div class="pg-tabs"></div>
          <div class="pg-stage">
            <button class="pg-nav pg-prev" type="button" title="Anterior (←)">‹</button>
            <img class="pg-main" alt="">
            <div class="pg-empty" hidden></div>
            <button class="pg-nav pg-next" type="button" title="Siguiente (→)">›</button>
          </div>
          <div class="pg-caption"></div>
          <div class="pg-thumbs"></div>
        </section>
      </div>
    </div>`;
  document.body.appendChild(_overlay);

  _overlay.querySelector('.pg-close').addEventListener('click', close);
  _overlay.querySelector('.pg-prev').addEventListener('click', () => _step(-1));
  _overlay.querySelector('.pg-next').addEventListener('click', () => _step(1));
  _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });
  document.addEventListener('keydown', _onKey);

  try {
    await _loadManifest();
  } catch (err) {
    console.error('[perfiles] No se pudo cargar el índice de figuras:', err);
    _showEmpty('No se pudo cargar la galería de perfiles.');
    return;
  }
  if (!_overlay) return;   // se cerró mientras cargaba
  /* Si el último río visto no tiene figuras del tipo pedido (p. ej. caudal en
   * Guachal), se abre en el Río Cauca, que tiene de ambos tipos. */
  if (!_figuras(_rio, _tipo).length) _rio = _manifest.rios[0].rio;
  _renderRivers();
  _render();
}

export function close() {
  document.removeEventListener('keydown', _onKey);
  _overlay?.remove();
  _overlay = null;
}

/* ── Navegación ───────────────────────────────────────────────────────── */

function _onKey(e) {
  if (e.key === 'Escape') close();
  else if (e.key === 'ArrowLeft') _step(-1);
  else if (e.key === 'ArrowRight') _step(1);
}

function _step(delta) {
  const n = _figuras(_rio, _tipo).length;
  if (n > 1) { _index = (_index + delta + n) % n; _render(); }
}

function _selectRiver(rio) {
  _rio = rio;
  _index = 0;
  /* Si el río no tiene figuras del tipo activo, se pasa al otro tipo. */
  if (!_figuras(_rio, _tipo).length) {
    const otro = TIPOS.find(t => _figuras(_rio, t.id).length);
    if (otro) _tipo = otro.id;
  }
  _renderRivers();
  _render();
}

/* ── Render ───────────────────────────────────────────────────────────── */

function _renderRivers() {
  const nav = _overlay.querySelector('.pg-rivers');
  const grupo = (titulo, rios) => `
    <div class="pg-group">${titulo}</div>
    ${rios.map(r => `
      <button type="button" class="pg-river${r.rio === _rio ? ' active' : ''}" data-rio="${escapeHtml(r.rio)}">
        ${escapeHtml(r.rio.replace(/^Río /, ''))}
        <span class="pg-count">${r.figuras.length}</span>
      </button>`).join('')}`;

  nav.innerHTML =
    grupo('Río principal', _manifest.rios.filter(r => r.grupo === 'cauca')) +
    grupo('Tributarios', _manifest.rios.filter(r => r.grupo === 'tributario'));
  nav.querySelectorAll('.pg-river').forEach(b =>
    b.addEventListener('click', () => _selectRiver(b.dataset.rio)));
  nav.querySelector('.pg-river.active')?.scrollIntoView({ block: 'nearest' });
}

function _renderTabs() {
  const tabs = _overlay.querySelector('.pg-tabs');
  tabs.innerHTML = `<span class="pg-rio-name">${escapeHtml(_rio)}</span>` + TIPOS.map(t => {
    const n = _figuras(_rio, t.id).length;
    return `<button type="button" class="pg-tab${t.id === _tipo ? ' active' : ''}" data-tipo="${t.id}"
      ${n ? '' : 'disabled title="No hay perfiles de este tipo para este río"'}>
      ${t.label} <span class="pg-count">${n}</span></button>`;
  }).join('');
  tabs.querySelectorAll('.pg-tab:not([disabled])').forEach(b =>
    b.addEventListener('click', () => { _tipo = b.dataset.tipo; _index = 0; _render(); }));
}

function _showEmpty(msg) {
  const main = _overlay.querySelector('.pg-main');
  const empty = _overlay.querySelector('.pg-empty');
  main.hidden = true;
  empty.hidden = false;
  empty.textContent = msg;
  _overlay.querySelector('.pg-caption').textContent = '';
  _overlay.querySelector('.pg-thumbs').innerHTML = '';
  _overlay.querySelectorAll('.pg-nav').forEach(b => { b.hidden = true; });
}

function _render() {
  if (!_overlay) return;
  _renderTabs();

  const figs = _figuras(_rio, _tipo);
  if (!figs.length) { _showEmpty('No hay perfiles de este tipo para este río.'); return; }

  const fig = figs[_index];
  const main = _overlay.querySelector('.pg-main');
  const empty = _overlay.querySelector('.pg-empty');
  empty.hidden = true;
  main.hidden = false;
  main.onerror = () => _showEmpty(`Imagen no disponible — ${fig.leyenda}`);
  main.src = `${BASE}${fig.archivo}?v=${BUILD_VERSION}`;
  main.alt = fig.leyenda;
  _overlay.querySelectorAll('.pg-nav').forEach(b => { b.hidden = figs.length < 2; });

  _overlay.querySelector('.pg-caption').innerHTML =
    `<span>${escapeHtml(fig.leyenda)}</span>` +
    `<span class="pg-pos">${_index + 1} / ${figs.length}</span>`;

  const thumbs = _overlay.querySelector('.pg-thumbs');
  thumbs.innerHTML = figs.map((f, i) => `
    <button type="button" class="pg-thumb${i === _index ? ' active' : ''}" data-i="${i}" title="${escapeHtml(f.leyenda)}">
      <img src="${BASE}${f.archivo}?v=${BUILD_VERSION}" alt="" loading="lazy">
      <span>${escapeHtml(f.parametro)}</span>
    </button>`).join('');
  thumbs.querySelectorAll('.pg-thumb').forEach(t =>
    t.addEventListener('click', () => { _index = Number(t.dataset.i); _render(); }));
  thumbs.querySelector('.pg-thumb.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
