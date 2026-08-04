# Corredor Biológico — Línea Base Interactiva
**Proyecto 890K | UAO × ASOCAÑA | Fase I — Diagnóstico de Calidad del Agua**

Plataforma web estática (GitHub Pages) que sirve como línea base interactiva de calidad del agua del río Cauca y sus tributarios priorizados (Pan de Azúcar → La Virginia).

---

## Estructura del repositorio

```
Rio_Cauca_Baseline/
├── index.html                          ← Entrada única (sidebar, leyenda, #map)
├── css/styles.css                      ← Estilos dark mode (archivo único)
├── src/
│   ├── main.js                         ← Bootstrap: initMap → capas → controles
│   ├── map/init.js, map/basemaps.js    ← Mapa MapLibre y mapas base ráster
│   ├── layers/geojson.js               ← Carga y registro de todas las capas
│   ├── layers/registry.js              ← Paleta RIVER_COLORS
│   ├── controls/LayerPanel.js          ← Checkboxes → visibility
│   ├── controls/TramoFilter.js         ← Navegación por extensiones
│   ├── controls/InfoPanel.js           ← Popup de atributos + descargas CSV
│   ├── controls/CutLineTool.js         ← Herramienta de tramos y caña
│   ├── controls/*Gallery.js            ← Lightbox de perfiles PNG
│   ├── tramos/geometry.js              ← Semiplanos, corte, área geodésica
│   ├── tramos/stations.js              ← Río ↔ estaciones, etiquetas de tramo
│   ├── data/waterQuality.js            ← Parser CSV + join por estación
│   ├── utils/bounds.js, utils/format.js
│   └── build_*.py, perfil_*.py         ← Preparación de datos (no se sirven)
├── tools/tramos/                       ← Análisis de tramos (Node + turf).
│                                         Fuera del sitio: tiene package.json propio
├── docs/                               ← Reportes versionados (MD + CSV)
├── data/
│   ├── cartografia/                    ← Buffer 700 m, caña (Hectareas_CZ),
│   │                                     Río Cauca y tributarios (WGS84)
│   ├── cortes_tramos.geojson           ← Cortes de tramo versionados
│   ├── databases/                      ← Estaciones y calidad (fuente CVC)
│   ├── geovisor/                       ← Puntos de calidad + CSV por punto
│   ├── hydrology/                      ← Caudales y curvas de duración
│   └── water_quality/perfiles/         ← PNG de perfiles longitudinales
└── .github/workflows/deploy.yml        ← Auto-deploy en GitHub Pages
```

---

## Deploy en GitHub Pages

```bash
# 1. Inicializar repositorio
cd Rio_Cauca_Baseline
git init
git add .
git commit -m "MVP: Línea base interactiva v1.0"
git branch -M main

# 2. Crear repositorio en GitHub y conectar
git remote add origin https://github.com/TU_USUARIO/corredor-biologico-linea-base.git
git push -u origin main

# 3. En GitHub: Settings → Pages → Source: "GitHub Actions" → Save
#    El workflow deploy.yml hará el deploy automáticamente en cada push a main.
```

**URL resultante:** `https://TU_USUARIO.github.io/corredor-biologico-linea-base/`

---

## Prueba local

```bash
cd Rio_Cauca_Baseline
python -m http.server 8000
# Abrir: http://localhost:8000
```

---

## Actualización de datos

| Dato | Archivo a reemplazar | Fuente | Estado |
|---|---|---|---|
| Calidad agua tributarios | `data/calidad_agua.csv` | CVC — DT02 | Pendiente |
| Calidad agua Cauca | `data/calidad_agua.csv` (filas Tramo 1/2/3) | CVC — DT02 | Pendiente |
| Caudales CVC tributarios | `data/hidrometria.csv` | CVC — DT02 | Pendiente |
| Curvas duración Risaralda | `data/caudales_cdc.csv` | CARDER ERA | ✓ Disponible |
| Geometría tributarios | `data/rios_tributarios.geojson` | SHP CVC/IDEAM | Pendiente SHP |
| Coordenadas estaciones | `data/estaciones_hidrometricas.geojson` | ArcGIS Pro (MAGNA-SIRGAS) | Pendiente verificación |
| Área caña por buffer | Nuevas columnas en GeoJSON tributarios | SHP CVC + ArcGIS Pro | Pendiente |

### Para actualizar los datos CARDER cuando lleguen DT02/DT03:
```bash
# 1. Copiar los CSV fuente a la carpeta Fase I/Derechos de petición/
# 2. Ejecutar el script de transformación:
cd Rio_Cauca_Baseline
python scripts/prepare_data.py
# 3. Hacer commit de los nuevos archivos en data/
git add data/
git commit -m "Actualización datos DT02 — calidad agua CVC"
git push
```

---

## Modelo de carga difusa (en desarrollo)

**Fórmula:** `Carga (kg/año) = Área_caña (ha) × Coef_exportación × (Escorrentía_mm / 1000)`

| Parámetro | Valor | Rango bibliográfico | Fuente |
|---|---|---|---|
| Coef. N | 10 kg N/ha/año | 8–12 kg/ha/año | Literatura técnica |
| Coef. P | 1.1 kg P/ha/año | 0.8–1.5 kg/ha/año | Literatura técnica |
| Área caña | Pendiente | — | SHP CVC + ArcGIS Pro (buffer 700 m) |
| Escorrentía | Pendiente | — | Zonal Statistics IDEAM sobre buffer |

**Pendientes:**
- Obtener escorrentía anual promedio por buffer (IDEAM)

---

## Herramienta de tramos y caña de azúcar

Panel lateral → *Zona de Estudio* → **Cortar tramos y calcular caña**.

Desagrega las hectáreas de caña por tramo entre estaciones de monitoreo, en vez de
por río completo. Todo el cálculo ocurre en el navegador con Turf.js; no hay backend.

**Cómo se usa**

1. Elegir el río en el selector.
2. Añadir cortes, de dos maneras:
   - **Corte en estación** — genera la perpendicular exacta al eje del cauce en la
     estación seleccionada. Reproducible, es la opción recomendada.
   - **Dibujar corte** — traza a mano con dos clics (Esc cancela).
3. La tabla se recalcula sola. Un clic en cualquier fila encuadra ese tramo.
4. Exportar: `⬇ CSV` (tabla con metadatos de trazabilidad), `⬇ Cortes`
   (las líneas, para versionar), `⬇ Polígonos` (los tramos, para reabrir en ArcGIS Pro).

**Cómo se calcula**

- Cada línea de corte se convierte en dos polígonos de semiplano; los tramos salen de
  operaciones booleanas sobre ellos, no de reensamblar el contorno del buffer a mano.
  El alcance del semiplano se deriva del bbox del buffer: con un valor fijo pequeño, los
  meandros que sobresalen quedan fuera del recorte y el área se pierde en silencio.
- Las áreas usan `turf.area()`, geodésica sobre el esferoide WGS84 — nunca planimetría
  sobre grados.
- Los tramos se ordenan y se nombran proyectando cortes y estaciones sobre el eje del
  río (`nearestPointOnLine`), de modo que **el orden en que se dibujen no altera el
  resultado**. El sentido de flujo se deduce de qué extremo del eje está más cerca del
  Río Cauca.
- Como `turf.area()` es geodésica y ArcGIS calculó en MAGNA-Sirgas, la tabla muestra la
  columna **cruda** y una **normalizada** por el factor `SUM_AREA_HA / área_geodésica`,
  para que los tramos sumen exactamente el total publicado del río. Medido: −0,26 % en
  Bolo y Fraile.
- El panel reporta el **cierre geométrico** (suma de tramos ÷ total del río). Debe dar
  100,000 %; si no, algún corte está mal orientado.

**Estado verificado** (Bolo y Fraile, 2 cortes por río, 3 tramos):

| Río | Tramo 1 | Tramo 2 | Tramo 3 | Total | Oficial ArcGIS |
|---|---|---|---|---|---|
| Bolo | 295,66 | 1.614,78 | 1.884,41 | 3.794,85 ha | 3.794,85 ha |
| Fraile | 78,56 | 1.960,59 | 2.950,86 | 4.990,00 ha | 4.990,00 ha |

Cierre geométrico 100,0000 % en ambos. `data/cortes_tramos.geojson` trae los cortes de
los 15 tributarios y se carga solo al abrir la herramienta.

**Limitación:** el corte se comporta como una recta infinita. Si un río vuelve a cruzar
esa recta en otro meandro, el tramo quedaría partido en trozos no contiguos; la
herramienta lo detecta (avisa cuando el corte cruza el buffer en más de 2 puntos) pero
no lo impide. El Río Cauca no está disponible en el selector porque su eje son 43
líneas sueltas, no una sola.

> ⚠️ **Para cifras oficiales usa el reporte, no la herramienta.**
> La herramienta interactiva sigue usando el método de semiplano infinito, que en ríos
> meandriformes cuenta área dos veces (el Palo cerraba en 112,38 %). El análisis
> consolidado de [docs/tramos_cana_tributarios.md](docs/tramos_cana_tributarios.md) usa un
> método de corte local, verificado, y **es la fuente válida**. Portar ese método al visor
> está pendiente.

---

## Análisis de tramos: los 15 tributarios

[**docs/tramos_cana_tributarios.md**](docs/tramos_cana_tributarios.md) — reporte completo  
[**docs/tramos_cana_tributarios.csv**](docs/tramos_cana_tributarios.csv) — datos tabulares

**46 tramos en 15 ríos, 25.092,55 ha.** El Río Cauca queda pendiente.

Se genera con:

```bash
cd tools/tramos && npm install && node build_tramos_cana.mjs
```

`tools/` es una herramienta de escritorio con su propio `package.json`: **el sitio estático
sigue sin build step ni dependencias**.

Dos hallazgos del análisis que conviene tener presentes:

- **El buffer de 700 m solo cubre la zona plana**, no todo el eje del río: arranca donde
  termina la montaña (en Bugalagrande y Tuluá cubre apenas el 30 % del eje). Por eso una
  estación de montaña no puede usarse como punto de corte. De las 74 estaciones, solo 48
  caen dentro de la zona cañera.
- **Guabas (1.825,85 ha) y Nima (896,63 ha) quedan sin desagregar**: tienen una sola
  estación dentro de la zona cañera, así que no admiten ningún corte intermedio. Es un
  vacío de monitoreo, no un error de cálculo.

---

## Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| MapLibre GL JS | 4.7.1 | Mapa interactivo (CDN unpkg, global `maplibregl`) |
| Turf.js | 7.1.0 | Geometría de la herramienta de tramos (CDN unpkg, global `turf`) |
| Google Fonts | — | DM Sans + Syne |
| GitHub Pages | — | Hosting estático |
| GitHub Actions | v4 | Auto-deploy |
| Python | 3.x | Scripts de preparación de datos en `src/` (no se sirven al navegador) |

Sin build step: módulos ES nativos y `<script>` globales. No hay `package.json` ni bundler.
Las gráficas son PNG pre-renderizados por los scripts de Python, no una librería de charts.

---

## Notas técnicas

- **Coordenadas:** WGS84 (EPSG:4326) en la app web. Las geometrías son aproximadas.
  Pendiente verificación y reemplazo con shapefiles en MAGNA-SIRGAS Origen Único (CVC) usando ArcGIS Pro.
- **Sistema de coordenadas SIG:** MAGNA-SIRGAS Origen Único (CVC) para los informes HTML de estaciones.
  Script de conversión a WGS84 pendiente de identificar el EPSG correcto.
- **Datos ERA CARDER:** Corresponden al río Risaralda y sus afluentes (Consota, Otún, etc.).
  No incluyen aún los tributarios del Valle del Cauca priorizados en este proyecto.

---

*Director del proyecto: Ing. Javier Ernesto Holguín González, UAO*  
*Fase I — Diagnóstico de calidad del agua | 2025–2026*
