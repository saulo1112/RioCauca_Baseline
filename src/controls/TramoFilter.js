/* Navegación por tramos del corredor */

/* global maplibregl */

const TRAMOS = {
  all: { bounds: [[-76.77, 2.85], [-75.85, 4.90]], opts: { maxZoom: 10 } },
  '1': { bounds: [[-76.77, 2.88], [-76.38, 3.40]], opts: { maxZoom: 11 } },
  '2': { bounds: [[-76.55, 3.20], [-76.25, 3.97]], opts: { maxZoom: 11 } },
  '3': { bounds: [[-76.42, 3.80], [-75.88, 4.85]], opts: { maxZoom: 11 } },
};

export function setupTramoFilter(map) {
  document.querySelectorAll('.tramo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tramo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const t = TRAMOS[btn.dataset.tramo];
      if (!t) return;

      map.fitBounds(t.bounds, {
        padding: { top: 40, bottom: 60, left: 290, right: 60 },
        duration: 900,
        ...t.opts,
      });
    });
  });
}
