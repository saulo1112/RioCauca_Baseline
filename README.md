# Cauca River Corridor — Interactive Baseline
**Project 890K | UAO × ASOCAÑA | Phase I — Water Quality Diagnosis**

**English** | [Español](#español)

Static web platform (GitHub Pages) serving as an interactive water-quality
baseline for the Cauca River and its prioritized tributaries (Pan de Azúcar
→ La Virginia).

---

## Repository structure

```
Rio_Cauca_Baseline/
├── index.html                          ← Single entry point (sidebar, legend, #map)
├── css/styles.css                      ← Dark mode styles (single file)
├── src/
│   ├── main.js                         ← Bootstrap: initMap → layers → controls
│   ├── map/init.js, map/basemaps.js    ← MapLibre map and raster basemaps
│   ├── layers/geojson.js               ← Loads and registers every layer
│   ├── layers/registry.js              ← RIVER_COLORS palette
│   ├── controls/LayerPanel.js          ← Checkboxes → visibility
│   ├── controls/TramoFilter.js         ← Navigation by reach
│   ├── controls/InfoPanel.js           ← Attribute popup + CSV downloads
│   ├── controls/CutLineTool.js         ← Segment and cane-area cutting tool
│   ├── controls/*Gallery.js            ← PNG profile lightbox
│   ├── tramos/geometry.js              ← Half-planes, cutting, geodesic area
│   ├── tramos/stations.js              ← River ↔ stations, segment labels
│   ├── data/waterQuality.js            ← CSV parser + join by station
│   ├── utils/bounds.js, utils/format.js
│   └── build_*.py, perfil_*.py         ← Data preparation (not served to the browser)
├── tools/tramos/                       ← Segment analysis (Node + turf).
│                                          Outside the site: has its own package.json
├── docs/                               ← Versioned reports (MD + CSV)
├── data/
│   ├── cartografia/                    ← 700 m buffer, cane (Hectareas_CZ),
│   │                                      Cauca River and tributaries (WGS84)
│   ├── cortes_tramos.geojson           ← Versioned segment cuts
│   ├── databases/                      ← Stations and quality data (CVC source)
│   ├── geovisor/                       ← Quality points + CSV per point
│   ├── hydrology/                      ← Flow rates and duration curves
│   └── water_quality/perfiles/         ← PNG longitudinal profiles
└── .github/workflows/deploy.yml        ← Auto-deploy on GitHub Pages
```

---

## Deploy on GitHub Pages

```bash
# 1. Initialize the repository
cd Rio_Cauca_Baseline
git init
git add .
git commit -m "MVP: Interactive baseline v1.0"
git branch -M main

# 2. Create the repository on GitHub and connect it
git remote add origin https://github.com/YOUR_USERNAME/corredor-biologico-linea-base.git
git push -u origin main

# 3. On GitHub: Settings → Pages → Source: "GitHub Actions" → Save
#    The deploy.yml workflow deploys automatically on every push to main.
```

**Resulting URL:** `https://YOUR_USERNAME.github.io/corredor-biologico-linea-base/`

---

## Local testing

```bash
cd Rio_Cauca_Baseline
python -m http.server 8000
# Open: http://localhost:8000
```

---

## Data updates

| Data | File to replace | Source | Status |
|---|---|---|---|
| Tributary water quality | `data/calidad_agua.csv` | CVC — DT02 | Pending |
| Cauca water quality | `data/calidad_agua.csv` (Reach 1/2/3 rows) | CVC — DT02 | Pending |
| CVC tributary flow rates | `data/hidrometria.csv` | CVC — DT02 | Pending |
| Risaralda duration curves | `data/caudales_cdc.csv` | CARDER ERA | ✓ Available |
| Tributary geometry | `data/rios_tributarios.geojson` | SHP CVC/IDEAM | SHP pending |
| Station coordinates | `data/estaciones_hidrometricas.geojson` | ArcGIS Pro (MAGNA-SIRGAS) | Verification pending |
| Cane area by buffer | New columns in the tributary GeoJSON | SHP CVC + ArcGIS Pro | Pending |

### Updating CARDER data when DT02/DT03 arrive:
```bash
# 1. Copy the source CSVs into the "Fase I/Derechos de petición/" folder
# 2. Run the transformation script:
cd Rio_Cauca_Baseline
python scripts/prepare_data.py
# 3. Commit the new files in data/
git add data/
git commit -m "Update DT02 data — CVC water quality"
git push
```

---

## Diffuse load model (in development)

**Formula:** `Load (kg/year) = Cane_area (ha) × Export_coefficient × (Runoff_mm / 1000)`

| Parameter | Value | Literature range | Source |
|---|---|---|---|
| N coef. | 10 kg N/ha/year | 8–12 kg/ha/year | Technical literature |
| P coef. | 1.1 kg P/ha/year | 0.8–1.5 kg/ha/year | Technical literature |
| Cane area | Pending | — | SHP CVC + ArcGIS Pro (700 m buffer) |
| Runoff | Pending | — | IDEAM Zonal Statistics over the buffer |

**Pending:**
- Obtain average annual runoff per buffer (IDEAM)

---

## Segment and sugarcane-cutting tool

Side panel → *Study Area* → **Cut segments and calculate cane area**.

Disaggregates cane hectares by segment between monitoring stations, instead
of by whole river. All computation happens in the browser with Turf.js;
there is no backend.

**How to use it**

1. Choose the river from the selector.
2. Add cuts, two ways:
   - **Cut at a station** — generates the exact perpendicular to the channel
     axis at the selected station. Reproducible, the recommended option.
   - **Draw a cut** — trace by hand with two clicks (Esc cancels).
3. The table recalculates itself. Clicking any row frames that segment.
4. Export: `⬇ CSV` (table with traceability metadata), `⬇ Cuts`
   (the lines, for versioning), `⬇ Polygons` (the segments, to reopen in
   ArcGIS Pro).

**How it's computed**

- Each cut line becomes two half-plane polygons; segments come from boolean
  operations on those, not from reassembling the buffer outline by hand.
  The half-plane's reach is derived from the buffer's bounding box: a fixed
  small value silently drops area exactly where meanders stick out.
- Areas use `turf.area()`, geodesic on the WGS84 ellipsoid — never
  planimetric over degrees.
- Segments are ordered and named by projecting both cuts and stations onto
  the river axis (`nearestPointOnLine`), so **the order cuts are drawn in
  doesn't change the result**. Flow direction is inferred from which end of
  the axis is closer to the Cauca River.
- Since `turf.area()` is geodesic and ArcGIS computed in MAGNA-Sirgas, the
  table shows both the **raw** column and one **normalized** by the factor
  `SUM_AREA_HA / geodesic_area`, so segments sum to exactly the river's
  published total. Measured: −0.26% on the Bolo and Fraile.
- The panel reports **geometric closure** (sum of segments ÷ river total).
  It must read 100.000%; if not, some cut is misoriented.

**Verified status** (Bolo and Fraile, 2 cuts per river, 3 segments):

| River | Segment 1 | Segment 2 | Segment 3 | Total | Official ArcGIS |
|---|---|---|---|---|---|
| Bolo | 295.66 | 1,614.78 | 1,884.41 | 3,794.85 ha | 3,794.85 ha |
| Fraile | 78.56 | 1,960.59 | 2,950.86 | 4,990.00 ha | 4,990.00 ha |

Geometric closure 100.0000% on both. `data/cortes_tramos.geojson` carries
the cuts for all 15 tributaries and loads only when the tool is opened.

**Limitation:** a cut behaves as an infinite line. If a river crosses that
line again at another meander, the segment would split into non-contiguous
pieces; the tool detects it (it warns when a cut crosses the buffer at more
than 2 points) but doesn't prevent it. The Cauca River itself isn't
available in the selector because its axis is 43 loose lines, not a single
one.

> ⚠️ **Use the report, not the tool, for official figures.**
> The interactive tool still uses the infinite half-plane method, which on
> meandering rivers double-counts area (the Palo closed at 112.38%). The
> consolidated analysis in
> [docs/tramos_cana_tributarios.md](docs/tramos_cana_tributarios.md) uses a
> verified, local cutting method and **is the valid source**. Porting that
> method into the viewer is still pending.

---

## Segment analysis: the 15 tributaries

[**docs/tramos_cana_tributarios.md**](docs/tramos_cana_tributarios.md) — full report
[**docs/tramos_cana_tributarios.csv**](docs/tramos_cana_tributarios.csv) — tabular data

**46 segments across 15 rivers, 25,092.55 ha.** The Cauca River itself is
still pending.

Generated with:

```bash
cd tools/tramos && npm install && node build_tramos_cana.mjs
```

`tools/` is a desktop tool with its own `package.json`: **the static site
still has no build step or dependencies.**

Two findings from the analysis worth keeping in mind:

- **The 700 m buffer only covers the flat zone**, not the whole river axis:
  it starts where the mountain ends (in Bugalagrande and Tuluá it covers
  barely 30% of the axis). That's why a mountain station can't be used as a
  cut point. Of the 74 stations, only 48 fall inside the cane zone.
- **Guabas (1,825.85 ha) and Nima (896.63 ha) remain undisaggregated**: they
  have only one station inside the cane zone, so they admit no intermediate
  cut. It's a monitoring gap, not a calculation error.

---

## Land use by segment

[**docs/uso_suelo_tramos.md**](docs/uso_suelo_tramos.md) — report
[**docs/uso_suelo_tramos.csv**](docs/uso_suelo_tramos.csv) — 18 land-use groups
[**docs/uso_suelo_tramos_detalle.csv**](docs/uso_suelo_tramos_detalle.csv) — the 103 codes at 1:25k

What fraction of each segment is cane, pasture, forest, urban area, etc.,
from CVC's land-cover layer (`data/databases/Uso_del_suelo_ZP.geojson`,
1:25,000 scale).

```bash
cd tools/tramos && node build_uso_suelo_tramos.mjs
```

Uses **the same segments** as the cane analysis: the buffer partition lives
in `tools/tramos/segmentacion.mjs`, shared by both scripts, so they match by
construction, not coincidence.

Three caveats:

- **The layer stops at the Valle del Cauca boundary.** Risaralda ends up
  with 0% coverage and Palo with 1.5%: both **are excluded**. Desbaratado is
  included with the 49.8% it does have, marked as partial.
- **Cane doesn't come from this layer.** The `area_ha` column for the CANA
  class is exactly `cana_ha_normalizada` from
  `tramos_cana_tributarios.csv` (source `Hectareas_CZ.geojson`, which has
  neighboring-buffer overlap already resolved). Other classes are rescaled
  proportionally so the segment closes at 100% with that cane value already
  substituted.
- **Currency is heterogeneous:** each basin was surveyed between 2014 and
  2025.

---

## Tech stack

| Technology | Version | Use |
|---|---|---|
| MapLibre GL JS | 4.7.1 | Interactive map (CDN unpkg, global `maplibregl`) |
| Turf.js | 7.1.0 | Segment-tool geometry (CDN unpkg, global `turf`) |
| Google Fonts | — | DM Sans + Syne |
| GitHub Pages | — | Static hosting |
| GitHub Actions | v4 | Auto-deploy |
| Python | 3.x | Data-prep scripts in `src/` (not served to the browser) |

No build step: native ES modules and global `<script>` tags. No
`package.json` or bundler. Charts are pre-rendered PNGs from the Python
scripts, not a charting library.

---

## Technical notes

- **Coordinates:** WGS84 (EPSG:4326) in the web app. Geometries are
  approximate. Verification and replacement with MAGNA-SIRGAS Origen Único
  (CVC) shapefiles via ArcGIS Pro is pending.
- **GIS coordinate system:** MAGNA-SIRGAS Origen Único (CVC) for the station
  HTML reports. A conversion script to WGS84 is pending identifying the
  correct EPSG.
- **CARDER ERA data:** Corresponds to the Risaralda River and its
  tributaries (Consota, Otún, etc.). Does not yet include the prioritized
  Valle del Cauca tributaries in this project.

---

*Project director: Ing. Javier Ernesto Holguín González, UAO*
*Phase I — Water Quality Diagnosis | 2025–2026*

---

# Español

[English](#cauca-river-corridor--interactive-baseline) | **Español**

**Proyecto 890K | UAO × ASOCAÑA | Fase I — Diagnóstico de Calidad del Agua**

Plataforma web estática (GitHub Pages) que sirve como línea base interactiva
de calidad del agua del río Cauca y sus tributarios priorizados (Pan de
Azúcar → La Virginia).

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

## Uso del suelo por tramo

[**docs/uso_suelo_tramos.md**](docs/uso_suelo_tramos.md) — reporte
[**docs/uso_suelo_tramos.csv**](docs/uso_suelo_tramos.csv) — 18 grupos de uso
[**docs/uso_suelo_tramos_detalle.csv**](docs/uso_suelo_tramos_detalle.csv) — los 103 códigos de 25k

Qué fracción de cada tramo es caña, pastos, bosque, zona urbana, etc., a partir de la capa
de cobertura de la CVC (`data/databases/Uso_del_suelo_ZP.geojson`, escala 1:25.000).

```bash
cd tools/tramos && node build_uso_suelo_tramos.mjs
```

Usa **los mismos tramos** que el análisis de caña: la partición del buffer vive en
`tools/tramos/segmentacion.mjs`, compartida por los dos scripts, así que coinciden por
construcción y no por coincidencia.

Tres advertencias:

- **La capa se detiene en el límite del Valle del Cauca.** Risaralda queda con 0 % de
  cobertura y Palo con 1,5 %: ambos **se excluyen**. Desbaratado se incluye con el 49,8 %
  que sí tiene, marcado como parcial.
- **La caña no sale de esta capa.** La columna `area_ha` de la clase CANA es exactamente
  `cana_ha_normalizada` de `tramos_cana_tributarios.csv` (fuente `Hectareas_CZ.geojson`,
  que tiene resuelto el solapamiento entre buffers vecinos). Las demás clases se reescalan
  proporcionalmente para que el tramo cierre en 100 % con esa caña ya sustituida.
- **La vigencia es heterogénea:** cada cuenca se levantó entre 2014 y 2025.

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
