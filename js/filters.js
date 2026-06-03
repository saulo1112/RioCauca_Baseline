/* filters.js — Event listeners UI
   Proyecto 890K | UAO × ASOCAÑA */

document.addEventListener('DOMContentLoaded', () => {

  // ── Botones de tramo ────────────────────────────────────────────
  document.querySelectorAll('.tramo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tramo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterByTramo(btn.dataset.tramo);
    });
  });

  // ── Tabs de gráficas ────────────────────────────────────────────
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.chart-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`panel-${tab.dataset.chart}`);
      if (target) target.classList.add('active');
    });
  });

  // ── Selects de calidad ──────────────────────────────────────────
  document.getElementById('param-select')?.addEventListener('change', () => {
    buildCalidadChart(AppData.calidadAgua);
  });
  document.getElementById('stat-select')?.addEventListener('change', () => {
    buildCalidadChart(AppData.calidadAgua);
  });

  // ── Select de unidad hidrográfica ───────────────────────────────
  document.getElementById('uh-select')?.addEventListener('change', () => {
    buildCaudalChart(AppData.caudalesCDC);
  });

  // ── Select de parámetro carga ───────────────────────────────────
  document.getElementById('carga-param-select')?.addEventListener('change', () => {
    buildCargaChart();
  });

});
