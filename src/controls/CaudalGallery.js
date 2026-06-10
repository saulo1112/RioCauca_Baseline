/* CaudalGallery.js — Lightbox para el perfil longitudinal de caudal del Río Cauca. */

const IMG_SRC = 'data/water_quality/perfiles/perfil_CAUDAL_condicion.png';

let _overlay = null;

function _onKey(e) {
  if (e.key === 'Escape') close();
}

export function init() {
  /* sin pre-construcción — el overlay se crea en open() */
}

export function open() {
  if (_overlay) close();

  _overlay = document.createElement('div');
  _overlay.className = 'cg-overlay';
  _overlay.innerHTML = `
    <div class="cg-container">
      <div class="cg-header">
        <span class="cg-title">Perfil Longitudinal de Caudal — Río Cauca</span>
        <button class="cg-close" type="button" title="Cerrar">✕</button>
      </div>
      <img class="cg-img" src="${IMG_SRC}" alt="Perfil longitudinal de caudal">
      <div class="cg-missing" hidden>Imagen no disponible</div>
      <div class="cg-caption">
        Caudal promedio por condición hidrológica y período trienal
        &nbsp;|&nbsp; Ref: Mediacanoa &nbsp;|&nbsp; Fuente: CVC 2015–2026
      </div>
    </div>`;

  document.body.appendChild(_overlay);

  _overlay.querySelector('.cg-img').addEventListener('error', () => {
    _overlay.querySelector('.cg-img').hidden    = true;
    _overlay.querySelector('.cg-missing').hidden = false;
  });

  _overlay.querySelector('.cg-close').addEventListener('click', close);
  _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });
  document.addEventListener('keydown', _onKey);
}

export function close() {
  document.removeEventListener('keydown', _onKey);
  if (_overlay) { _overlay.remove(); _overlay = null; }
}
