/* Navegación por tramos del corredor */

/* global maplibregl */

const TRAMOS = {
  all: { bounds: [[-76.65, 3.00], [-75.78, 5.20]], opts: { maxZoom: 10 } },
  '1': { bounds: [[-76.65, 2.95], [-76.10, 3.60]], opts: { maxZoom: 11 } },
  '2': { bounds: [[-76.45, 3.55], [-75.90, 4.15]], opts: { maxZoom: 11 } },
  '3': { bounds: [[-76.10, 4.10], [-75.75, 5.25]], opts: { maxZoom: 11 } },
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
