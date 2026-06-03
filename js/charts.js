/* charts.js — Gráficas Chart.js
   Proyecto 890K | UAO × ASOCAÑA */

// ── Coeficientes de carga difusa (actualizar cuando lleguen los SHP) ────────
const COEF_N = 10;   // kg N / ha / año  (rango bibliográfico: 8–12)
const COEF_P = 1.1;  // kg P / ha / año  (rango bibliográfico: 0.8–1.5)
// Carga (kg/año) = área_caña_ha × coef × (escorrentía_mm / 1000)
// escorrentía pendiente: Zonal Statistics IDEAM sobre buffer 700 m

// ── Configuración global Chart.js ────────────────────────────────────────────
Chart.defaults.color      = '#8fa3b8';
Chart.defaults.font.family = "'DM Sans', sans-serif";
const CHART_GRID = 'rgba(255,255,255,0.05)';

// ── Mapeo de parámetros ──────────────────────────────────────────────────────
const PARAM_COLS = {
  DBO5: { min: 'DBO5_min', med: 'DBO5_med', max: 'DBO5_max', label: 'DBO₅ (mg O₂/L)', color: '#ef5350' },
  DQO:  { min: 'DQO_min',  med: 'DQO_med',  max: 'DQO_max',  label: 'DQO (mg O₂/L)',   color: '#ffa726' },
  SST:  { min: 'SST_min',  med: 'SST_med',  max: 'SST_max',  label: 'SST (mg/L)',       color: '#a5d6a7' },
  OD:   { min: 'OD_min',   med: 'OD_med',   max: 'OD_max',   label: 'OD (mg O₂/L)',    color: '#29b6f6' },
  NT:   { min: 'NT_min',   med: 'NT_med',   max: 'NT_max',   label: 'N Total (mgN/L)',  color: '#66bb6a' },
  PT:   { min: 'PT_min',   med: 'PT_med',   max: 'PT_max',   label: 'P Total (mg/L)',   color: '#ab47bc' },
  ICA5: { min: 'ICA5_min', med: 'ICA5_med', max: 'ICA5_max', label: 'ICA-5 [IDEAM]',   color: '#26c6da' },
};

const RIOS_ORDEN = [
  'Palo','Desbaratado','Fraile','Bolo','Amaime','Nima','Zabaletas',
  'Guabas','Guadalajara','Riofrío','Tuluá','Bugalagrande','La Paila','Risaralda','Guachal',
];

let chartCalidad = null;
let chartCaudal  = null;
let chartCarga   = null;

// ── Tab 1: Perfil de calidad ─────────────────────────────────────────────────
function buildCalidadChart(data) {
  const canvas = document.getElementById('chart-calidad');
  if (!canvas) return;

  const param = document.getElementById('param-select')?.value || 'DBO5';
  const stat  = document.getElementById('stat-select')?.value  || 'med';
  const cols  = PARAM_COLS[param];
  if (!cols) return;

  // Filtrar solo cuerpos de agua con datos del parámetro
  const rows = (data || []).filter(r => r[cols.med] != null);
  if (!rows.length) {
    canvas.parentElement.innerHTML = '<p class="chart-note" style="text-align:center;padding:20px">Sin datos disponibles para este parámetro.</p>';
    return;
  }

  const labels   = rows.map(r => r.TRAMO_O_RIO || r.CUERPO_AGUA);
  const datasets = [];

  if (stat === 'all') {
    datasets.push({
      label:           'Máximo',
      data:            rows.map(r => r[cols.max]),
      borderColor:     cols.color,
      backgroundColor: `${cols.color}18`,
      borderWidth:     1.5,
      borderDash:      [4, 3],
      fill:            '+1',
      tension:         0.3,
      pointRadius:     2,
    });
    datasets.push({
      label:           'Medio',
      data:            rows.map(r => r[cols.med]),
      borderColor:     cols.color,
      backgroundColor: `${cols.color}28`,
      borderWidth:     2.5,
      fill:            '+1',
      tension:         0.3,
      pointRadius:     3,
    });
    datasets.push({
      label:           'Mínimo',
      data:            rows.map(r => r[cols.min]),
      borderColor:     cols.color,
      backgroundColor: `${cols.color}08`,
      borderWidth:     1.5,
      borderDash:      [4, 3],
      fill:            false,
      tension:         0.3,
      pointRadius:     2,
    });
  } else {
    const colKey = stat === 'min' ? cols.min : stat === 'max' ? cols.max : cols.med;
    datasets.push({
      label:           cols.label,
      data:            rows.map(r => r[colKey]),
      borderColor:     cols.color,
      backgroundColor: `${cols.color}30`,
      borderWidth:     2.5,
      fill:            true,
      tension:         0.3,
      pointRadius:     3,
      pointBackgroundColor: cols.color,
    });
  }

  if (chartCalidad) chartCalidad.destroy();
  chartCalidad = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { boxWidth: 12, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            title: ctx => ctx[0].label,
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}`,
          }
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 9 }, maxRotation: 45 },
          grid:  { color: CHART_GRID },
        },
        y: {
          title: { display: true, text: cols.label, font: { size: 9 } },
          grid:  { color: CHART_GRID },
          ticks: { font: { size: 9 } },
        }
      }
    }
  });
}

// ── Tab 2: Curva de duración de caudales ─────────────────────────────────────
function buildCaudalChart(data) {
  const canvas = document.getElementById('chart-caudal');
  if (!canvas) return;

  const uhSelect = document.getElementById('uh-select');
  const uhVal    = uhSelect?.value || '';

  const rows = (data || []);
  if (!rows.length) {
    canvas.parentElement.innerHTML = '<p class="chart-note" style="text-align:center;padding:20px">Sin datos de curva de duración disponibles.</p>';
    return;
  }

  // Unidades disponibles
  const unidades = [...new Set(rows.map(r => r['Unidad']))].sort();

  // Poblar select si está vacío
  if (uhSelect && uhSelect.options.length <= 1) {
    unidades.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u.length > 50 ? u.slice(0, 50) + '…' : u;
      uhSelect.appendChild(opt);
    });
  }

  const selectedUH = uhVal || unidades[0] || '';
  const uhRows = rows.filter(r => r['Unidad'] === selectedUH);

  const escenarios = {
    hist: uhRows.filter(r => /historico|histórico/i.test(r['Escenario'])),
    cc1:  uhRows.filter(r => r['Escenario']?.includes('2011-2040')),
    cc2:  uhRows.filter(r => r['Escenario']?.includes('2041-2070')),
  };

  const toDataset = (rows, label, color, dash) => {
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => a['Porcentaje Excedencia'] - b['Porcentaje Excedencia']);
    return {
      label,
      data:            sorted.map(r => ({ x: r['Porcentaje Excedencia'], y: r['Caudal m3s'] })),
      borderColor:     color,
      backgroundColor: `${color}18`,
      borderWidth:     dash ? 1.5 : 2.5,
      borderDash:      dash ? [5, 4] : [],
      fill:            false,
      tension:         0.2,
      pointRadius:     0,
    };
  };

  const datasets = [
    toDataset(escenarios.hist, 'Histórico',     '#29b6f6', false),
    toDataset(escenarios.cc1,  'CC 2011-2040',  '#ffa726', true),
    toDataset(escenarios.cc2,  'CC 2041-2070',  '#ef5350', true),
  ].filter(Boolean);

  if (chartCaudal) chartCaudal.destroy();
  chartCaudal = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { boxWidth: 12, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)} m³/s`
          }
        }
      },
      scales: {
        x: {
          type:  'linear',
          title: { display: true, text: 'Excedencia (%)', font: { size: 9 } },
          min:   0, max: 100,
          grid:  { color: CHART_GRID },
          ticks: { font: { size: 9 } },
        },
        y: {
          title: { display: true, text: 'Caudal (m³/s)', font: { size: 9 } },
          grid:  { color: CHART_GRID },
          ticks: { font: { size: 9 } },
        }
      }
    }
  });
}

// ── Tab 3: Carga difusa ───────────────────────────────────────────────────────
function buildCargaChart() {
  const canvas = document.getElementById('chart-carga');
  if (!canvas) return;

  const param = document.getElementById('carga-param-select')?.value || 'N';
  const color = param === 'N' ? '#66bb6a' : '#29b6f6';
  const label = param === 'N' ? 'Carga N (kg N/año)' : 'Carga P (kg P/año)';

  const data = RIOS_ORDEN.map(() => null);

  if (chartCarga) chartCarga.destroy();
  chartCarga = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: RIOS_ORDEN,
      datasets: [{
        label,
        data,
        backgroundColor: `${color}50`,
        borderColor:     color,
        borderWidth:     1.5,
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.parsed.y === null
              ? 'Pendiente — sin área caña disponible'
              : `${ctx.parsed.y?.toLocaleString()} kg/año`,
          }
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 8 }, maxRotation: 45 },
          grid:  { color: CHART_GRID },
        },
        y: {
          title: { display: true, text: label, font: { size: 9 } },
          grid:  { color: CHART_GRID },
          ticks: { font: { size: 9 } },
        }
      }
    }
  });
}

function buildCargaTable() {
  const container = document.getElementById('carga-table-container');
  if (!container) return;

  const rows = RIOS_ORDEN.map(rio => `
    <tr>
      <td>${rio}</td>
      <td class="td-pending">—</td>
      <td class="td-pending">—</td>
      <td class="td-pending">—</td>
      <td class="td-pending">Pendiente SHP</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="carga-table">
      <thead>
        <tr>
          <th>Río</th>
          <th>Área caña (ha)</th>
          <th>Carga N (kg/año)</th>
          <th>Carga P (kg/año)</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function initCharts(appData) {
  buildCalidadChart(appData.calidadAgua);
  buildCaudalChart(appData.caudalesCDC);
  buildCargaChart();
}
