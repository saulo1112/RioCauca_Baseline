/* data-loader.js — Carga de datos
   Proyecto 890K | UAO × ASOCAÑA */

const AppData = {
  capas: {
    tributarios:   null,
    bufferRC:      null,
    bufferZP:      null,
    czCauca:       null,
    czTributarios: null,
  },
  calidadAgua:  null,
  hidrometria:  null,
  caudalesCDC:  null,
};

async function loadGeoJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
    return await res.json();
  } catch (e) {
    console.warn(`[data-loader] GeoJSON no disponible: ${path}`, e.message);
    return null;
  }
}

function loadCSV(path) {
  return new Promise((resolve) => {
    Papa.parse(path, {
      download:       true,
      header:         true,
      skipEmptyLines: true,
      dynamicTyping:  true,
      complete: (results) => {
        if (results.errors.length) {
          console.warn(`[data-loader] Errores en CSV ${path}:`, results.errors);
        }
        resolve(results.data || []);
      },
      error: (err) => {
        console.warn(`[data-loader] CSV no disponible: ${path}`, err);
        resolve([]);
      }
    });
  });
}

/* Fase 1: capas ligeras + CSVs (rápido, se renderizan al inicio) */
async function loadAllData() {
  const [tributarios, bufferRC, bufferZP, calidadAgua, hidrometria, caudalesCDC] =
    await Promise.all([
      loadGeoJSON('capas/Tributarios.geojson'),
      loadGeoJSON('capas/BufferRC.geojson'),
      loadGeoJSON('capas/BufferZP.geojson'),
      loadCSV('data/calidad_agua.csv'),
      loadCSV('data/hidrometria.csv'),
      loadCSV('data/caudales_cdc.csv'),
    ]);

  AppData.capas.tributarios = tributarios;
  AppData.capas.bufferRC    = bufferRC;
  AppData.capas.bufferZP    = bufferZP;
  AppData.calidadAgua       = calidadAgua;
  AppData.hidrometria       = hidrometria;
  AppData.caudalesCDC       = caudalesCDC;

  console.log('[data-loader] Capas base y CSVs cargados');
  return AppData;
}

/* Fase 2: capas de cobertura de gran tamaño (asíncrono, en segundo plano) */
async function loadLargeCapas() {
  console.log('[data-loader] Iniciando carga de capas de cobertura...');

  const [czCauca, czTributarios] = await Promise.all([
    loadGeoJSON('capas/CZRioCauca.geojson'),
    loadGeoJSON('capas/CZRiosTributarios.geojson'),
  ]);

  AppData.capas.czCauca       = czCauca;
  AppData.capas.czTributarios = czTributarios;

  console.log('[data-loader] Capas de cobertura cargadas');
  document.dispatchEvent(new CustomEvent('largeCapasLoaded'));
}
