/* WaterQualityGallery.js — Galería lightbox de perfiles de calidad del agua.
 *
 * Muestra las 6 imágenes generadas por src/perfil_longitudinal_calidad.py
 * (una por parámetro, perfil longitudinal por condición hidrológica).
 *
 * API:
 *   init()  — prepara la lista de imágenes (llamar una vez al arrancar)
 *   open()  — abre la galería en la primera imagen (DBO)
 *   close() — cierra y limpia el DOM del overlay
 */

const BASE = 'data/water_quality/perfiles/';

const GALERIA_PERFILES = [
  { param: 'DBO',      label: 'DBO₅',            archivo: 'perfil_DBO_condicion.png'      },
  { param: 'DQO',      label: 'DQO',              archivo: 'perfil_DQO_condicion.png'      },
  { param: 'OD',       label: 'Oxígeno Disuelto', archivo: 'perfil_OD_condicion.png'       },
  { param: 'SST',      label: 'SST',              archivo: 'perfil_SST_condicion.png'      },
  { param: 'NITRATOS', label: 'Nitratos',         archivo: 'perfil_NITRATOS_condicion.png' },
  { param: 'P_TOTAL',  label: 'Fósforo Total',    archivo: 'perfil_P_TOTAL_condicion.png'  },
];

const TIPO_CONDICION = 'Perfil longitudinal por condición hidrológica';

/* Lista de 6 imágenes */
let IMAGES = [];

/* Estado del overlay abierto */
let _overlay = null;
let _index   = 0;

function _buildImages() {
  IMAGES = GALERIA_PERFILES.map(p => ({
    src:   BASE + p.archivo,
    label: p.label,
    tipo:  TIPO_CONDICION,
    param: p.param,
  }));
}

export function init() {
  if (IMAGES.length === 0) _buildImages();
}

export function open() {
  if (IMAGES.length === 0) _buildImages();
  if (_overlay) close();           // evitar duplicados

  _index = 0;

  _overlay = document.createElement('div');
  _overlay.className = 'wqg-overlay';
  _overlay.innerHTML = `
    <div class="wqg-container">
      <div class="wqg-header">
        <span class="wqg-title">Perfiles de Calidad del Agua — Río Cauca</span>
        <button class="wqg-close" type="button" title="Cerrar">✕</button>
      </div>
      <div class="wqg-stage">
        <button class="wqg-nav wqg-prev" type="button" title="Anterior">‹</button>
        <img class="wqg-main" alt="">
        <div class="wqg-missing" hidden></div>
        <button class="wqg-nav wqg-next" type="button" title="Siguiente">›</button>
      </div>
      <div class="wqg-caption"></div>
      <div class="wqg-thumbs"></div>
    </div>`;

  document.body.appendChild(_overlay);

  /* Miniaturas */
  const thumbs = _overlay.querySelector('.wqg-thumbs');
  IMAGES.forEach((img, i) => {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'wqg-thumb';
    t.dataset.index = String(i);
    t.innerHTML =
      `<img src="${img.src}" alt="${img.label}" loading="lazy">` +
      `<span class="wqg-thumb-ph" hidden>${img.param}</span>`;
    /* Placeholder gris si la miniatura no existe (404) */
    const tImg = t.querySelector('img');
    tImg.addEventListener('error', () => {
      tImg.hidden = true;
      t.querySelector('.wqg-thumb-ph').hidden = false;
      t.classList.add('wqg-thumb-missing');
    });
    t.addEventListener('click', () => _goto(i));
    thumbs.appendChild(t);
  });

  /* Eventos de control */
  _overlay.querySelector('.wqg-close').addEventListener('click', close);
  _overlay.querySelector('.wqg-prev').addEventListener('click', () => _step(-1));
  _overlay.querySelector('.wqg-next').addEventListener('click', () => _step(1));
  _overlay.addEventListener('click', e => {
    if (e.target === _overlay) close();   // clic fuera del contenedor
  });
  document.addEventListener('keydown', _onKey);

  _render();
}

export function close() {
  document.removeEventListener('keydown', _onKey);
  if (_overlay) {
    _overlay.remove();
    _overlay = null;
  }
}

/* ── Navegación ───────────────────────────────────────────────────────── */

function _onKey(e) {
  if (e.key === 'Escape')     { close(); }
  else if (e.key === 'ArrowLeft')  { _step(-1); }
  else if (e.key === 'ArrowRight') { _step(1); }
}

function _step(delta) {
  _goto((_index + delta + IMAGES.length) % IMAGES.length);   // navegación circular
}

function _goto(i) {
  _index = i;
  _render();
}

function _render() {
  if (!_overlay) return;
  const img = IMAGES[_index];

  const main    = _overlay.querySelector('.wqg-main');
  const missing = _overlay.querySelector('.wqg-missing');

  missing.hidden = true;
  main.hidden    = false;
  main.onerror = () => {
    main.hidden    = true;
    missing.hidden = false;
    missing.textContent = `Imagen no disponible — ${img.label}`;
  };
  main.src = img.src;
  main.alt = `${img.label} — ${img.tipo}`;

  _overlay.querySelector('.wqg-caption').innerHTML =
    `<strong>${img.label}</strong> — ${img.tipo}`;

  /* Resaltar miniatura activa y centrarla en el scroll */
  _overlay.querySelectorAll('.wqg-thumb').forEach((t, i) => {
    const active = i === _index;
    t.classList.toggle('wqg-thumb-active', active);
    if (active) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
}
