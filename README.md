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
│   └── utils/bounds.js, utils/format.js
├── scripts/                            ← Data pipelines (not published)
│   ├── build_calidad_trib.py           ← Tributary quality points + CSV per point
│   ├── build_hydro_data.py             ← Cauca River hydrometric stations
│   ├── build_hydro_trib.py             ← Tributary hydrometric stations
│   ├── build_caudal_consolidado.py     ← Consolidated tributary daily flow
│   ├── perfil_longitudinal_calidad.py  ← PNG longitudinal profiles
│   └── tramos/                         ← Segment analysis (Node + turf, own package.json)
├── data/
│   ├── cartografia/                    ← Map layers: 700 m buffer, cane (Hectareas_CZ),
│   │                                      Cauca River, tributaries, N/P prioritization,
│   │                                      segment cuts (WGS84)
│   ├── calidad_agua/                   ← Quality stations, CSV per point, profiles
│   ├── hidrologia/                     ← Flow rates and duration curves per station
│   ├── fuentes/                        ← Raw inputs read only by the scripts
│   │   ├── calidad_agua/, hidrologia/  ← CVC/CARDER spreadsheets and station folders
│   │   ├── cobertura/                  ← CVC land cover + Palo/Desbaratado/Risaralda covers
│   │   └── priorizacion/               ← N/P prioritization table (Report 1, Table 5.2)
│   └── exports/arcgis/                 ← Products for ArcGIS Pro (buffer by segment)
├── docs/                               ← Versioned reports (MD + CSV)
└── .github/workflows/deploy.yml        ← Auto-deploy on GitHub Pages
```

Only `index.html`, `css/`, `src/` and `data/{cartografia,calidad_agua,hidrologia}`
are published: that's everything the viewer loads.

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

Replace the raw input in `data/fuentes/` and rerun its pipeline; the viewer
picks up the output after a reload (bump `BUILD_VERSION` in
`src/layers/geojson.js` so browsers drop the cached copy).

| Data | Raw input (`data/fuentes/`) | Pipeline | Output read by the viewer |
|---|---|---|---|
| Tributary water quality | `calidad_agua/Calidad_agua_completo_v12.xlsx`, `Calidad_tributarios.geojson` | `python scripts/build_calidad_trib.py` | `data/calidad_agua/puntos_calidad_tributarios.geojson`, `csv_por_punto/` |
| Cauca River flow | `hidrologia/Estaciones Hidroclimatológicas - Río Cauca/` | `python scripts/build_hydro_data.py` | `data/hidrologia/estaciones_hidro.json` + station folders |
| Tributary flow | `hidrologia/Estaciones Hidroclimatológicas - Ríos tributarios/`, `Estaciones_tributarios.geojson` | `python scripts/build_hydro_trib.py` | `data/hidrologia/estaciones_hidro_trib.json`, `tributarios/` |
| Cauca quality profiles | `data/calidad_agua/Calidad_del_agua_del_Rio_Cauca_*.csv` | `python scripts/perfil_longitudinal_calidad.py` | `data/calidad_agua/perfiles/*.png` |
| Cane by segment | `data/cartografia/Hectareas_CZ.geojson` | `cd scripts/tramos && node build_tramos_cana.mjs` | `docs/tramos_cana_tributarios.*`, `data/cartografia/cortes_tramos.geojson` |
| N/P prioritization | `priorizacion/Priorizacion_NP_subtramos.csv` | `node build_priorizacion_tramos.mjs` | `data/cartografia/Priorizacion_NP_tramos.geojson` |
| Buffer by segment (ArcGIS) | — (uses the segments above) | `node build_buffer_tramos.mjs && py geojson_a_shapefile.py` | `data/exports/arcgis/` (not used by the viewer) |
| Corridor monitoring (Activity 5: load → concentration) | `monitoreo_corredor/` (Report 1 Table 4.10, station equivalences) + `docs/Tasas retributivas.xlsx` (CVC discharge inventory) + the outputs above | `node build_posiciones_monitoreo.mjs && python scripts/build_monitoreo_corredor.py` | `data/cartografia/Monitoreo_corredor.geojson`, `src/config/monitoreo.js` (generated constants), `docs/monitoreo_corredor.xlsx` |

---

## Diffuse load and prioritization

**Formula used (Report 1, Table 5.2, median-emission scenario):**
`Load (kg/year) = Cane_area (ha) × factor`, with **9.57 kg N/ha/year** and
**1.38 kg P/ha/year**; daily load = annual ÷ 365. Cane area is the
normalized cane of each segment (`docs/tramos_cana_tributarios.csv`).

Each segment's category follows fixed N-load thresholds: ≥ 15,000 Very high ·
≥ 5,000 High · ≥ 1,000 Medium · > 0 Low · 0 Not applicable (no cane in the
strip). The table lives in `data/fuentes/priorizacion/Priorizacion_NP_subtramos.csv`
and is shown in the viewer via *Study Area* (hover) → *Prioritization by load*.

The Palo and Desbaratado rows were recomputed with the September 2026 cane
update — see [docs/auditoria_actualizacion_cana.md](docs/auditoria_actualizacion_cana.md).

**Pending:** runoff-weighted loads (average annual runoff per buffer, IDEAM).

### Water-quality monitoring panel (Activity 5)

*Study Area* (hover) → **Monitoreo de calidad de agua** shows the closing
station of each High / Very high segment, colored by status (included,
pending, excluded, prior exclusion) with steps of the prioritization palette.
Clicking a point opens its card in the info panel: pick N or P, the
hydrological condition and the corridor's removal (0–40 %), and the
concentration is recomputed live with `load = ha × EF / 365 × (1 − removal)`
and `C = load / (Q × 86.4)`. An optional target concentration returns the
removal it requires and warns above the validated 40 %. The measured
historical mean is shown apart, as text: it includes point sources and is not
comparable with the projected diffuse concentration. The constants live in
`src/config/monitoreo.js`, generated by `scripts/build_monitoreo_corredor.py`
from the same parameters as `docs/monitoreo_corredor.xlsx`, so the viewer and
the workbook cannot drift apart.

---

## Segment and sugarcane-cutting tool

Side panel → *Sugarcane* (hover) → **Cut segments and calculate cane area**.

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

Geometric closure 100.0000% on both. `data/cartografia/cortes_tramos.geojson` carries
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

**46 segments across 15 rivers, 28,289.57 ha** (Palo and Desbaratado updated in
September 2026). The Cauca River isn't segmented: its 24,414.93 ha of cane are
reported as a whole in `data/exports/arcgis/`.

Generated with:

```bash
cd scripts/tramos && npm install && node build_tramos_cana.mjs
```

`scripts/tramos/` is a desktop tool with its own `package.json`: **the static site
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
from CVC's land-cover layer (`data/fuentes/cobertura/Uso_del_suelo_ZP.geojson`,
1:25,000 scale).

```bash
cd scripts/tramos && node build_uso_suelo_tramos.mjs
```

Uses **the same segments** as the cane analysis: the buffer partition lives
in `scripts/tramos/segmentacion.mjs`, shared by both scripts, so they match by
construction, not coincidence.

Three caveats:

- **The layer stops at the Valle del Cauca boundary.** Risaralda ends up
  with 0% coverage and Palo with 1.5%: both **are excluded**. Desbaratado is
  included with the 49.8% it does have, marked as partial. **Its land-use shares
  still reflect the previous cane figures** (the September 2026 cane exceeds the
  area covered by the CVC layer; pending review).
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
| Python | 3.x | Data-prep scripts in `scripts/` (not published) |

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
│   └── utils/bounds.js, utils/format.js
├── scripts/                            ← Pipelines de datos (no se publican)
│   ├── build_calidad_trib.py           ← Puntos de calidad de tributarios + CSV por punto
│   ├── build_hydro_data.py             ← Estaciones hidrométricas del Río Cauca
│   ├── build_hydro_trib.py             ← Estaciones hidrométricas de tributarios
│   ├── build_caudal_consolidado.py     ← Caudal diario consolidado de tributarios
│   ├── perfil_longitudinal_calidad.py  ← PNG de perfiles longitudinales
│   └── tramos/                         ← Análisis de tramos (Node + turf, package.json propio)
├── data/
│   ├── cartografia/                    ← Capas del mapa: buffer 700 m, caña (Hectareas_CZ),
│   │                                     Río Cauca, tributarios, priorización N/P,
│   │                                     cortes de tramo (WGS84)
│   ├── calidad_agua/                   ← Estaciones de calidad, CSV por punto, perfiles
│   ├── hidrologia/                     ← Caudales y curvas de duración por estación
│   ├── fuentes/                        ← Insumos crudos; solo los leen los scripts
│   │   ├── calidad_agua/, hidrologia/  ← Excel CVC/CARDER y carpetas por estación
│   │   ├── cobertura/                  ← Cobertura CVC + coberturas Palo/Desbaratado/Risaralda
│   │   └── priorizacion/               ← Tabla de priorización N/P (Informe 1, Tabla 5.2)
│   └── exports/arcgis/                 ← Productos para ArcGIS Pro (buffer por tramo)
├── docs/                               ← Reportes versionados (MD + CSV)
└── .github/workflows/deploy.yml        ← Auto-deploy en GitHub Pages
```

Solo se publican `index.html`, `css/`, `src/` y `data/{cartografia,calidad_agua,hidrologia}`:
es todo lo que carga el visor.

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

Se reemplaza el insumo crudo en `data/fuentes/` y se vuelve a correr su pipeline; el visor
toma la salida al recargar (subir `BUILD_VERSION` en `src/layers/geojson.js` para que el
navegador descarte la copia en caché).

| Dato | Insumo crudo (`data/fuentes/`) | Pipeline | Salida que carga el visor |
|---|---|---|---|
| Calidad agua tributarios | `calidad_agua/Calidad_agua_completo_v12.xlsx`, `Calidad_tributarios.geojson` | `python scripts/build_calidad_trib.py` | `data/calidad_agua/puntos_calidad_tributarios.geojson`, `csv_por_punto/` |
| Caudales Río Cauca | `hidrologia/Estaciones Hidroclimatológicas - Río Cauca/` | `python scripts/build_hydro_data.py` | `data/hidrologia/estaciones_hidro.json` + carpetas por estación |
| Caudales tributarios | `hidrologia/Estaciones Hidroclimatológicas - Ríos tributarios/`, `Estaciones_tributarios.geojson` | `python scripts/build_hydro_trib.py` | `data/hidrologia/estaciones_hidro_trib.json`, `tributarios/` |
| Perfiles calidad Cauca | `data/calidad_agua/Calidad_del_agua_del_Rio_Cauca_*.csv` | `python scripts/perfil_longitudinal_calidad.py` | `data/calidad_agua/perfiles/*.png` |
| Caña por tramo | `data/cartografia/Hectareas_CZ.geojson` | `cd scripts/tramos && node build_tramos_cana.mjs` | `docs/tramos_cana_tributarios.*`, `data/cartografia/cortes_tramos.geojson` |
| Priorización N/P | `priorizacion/Priorizacion_NP_subtramos.csv` | `node build_priorizacion_tramos.mjs` | `data/cartografia/Priorizacion_NP_tramos.geojson` |
| Buffer por tramo (ArcGIS) | — (usa los tramos de arriba) | `node build_buffer_tramos.mjs && py geojson_a_shapefile.py` | `data/exports/arcgis/` (no lo usa el visor) |
| Monitoreo del corredor (Actividad 5: carga → concentración) | `monitoreo_corredor/` (Informe 1 Tabla 4.10, equivalencia de estaciones) + `docs/Tasas retributivas.xlsx` (inventario CVC de vertimientos) + las salidas de arriba | `node build_posiciones_monitoreo.mjs && python scripts/build_monitoreo_corredor.py` | `data/cartografia/Monitoreo_corredor.geojson`, `src/config/monitoreo.js` (constantes generadas), `docs/monitoreo_corredor.xlsx` |

---

## Carga difusa y priorización

**Fórmula usada (Informe 1, Tabla 5.2, escenario de mediana emisión):**
`Carga (kg/año) = Área_caña (ha) × factor`, con **9,57 kg N/ha/año** y **1,38 kg P/ha/año**;
carga diaria = anual ÷ 365. El área es la caña normalizada de cada tramo
(`docs/tramos_cana_tributarios.csv`).

La categoría de cada tramo sigue umbrales fijos sobre la carga de N: ≥ 15.000 Muy alta ·
≥ 5.000 Alta · ≥ 1.000 Media · > 0 Baja · 0 No aplica (sin caña en la franja). La tabla vive
en `data/fuentes/priorizacion/Priorizacion_NP_subtramos.csv` y se ve en el visor desde
*Zona de Estudio* (hover) → *Ver priorización por carga (N/P)*.

Las filas de Palo y Desbaratado se recalcularon con la actualización de caña de septiembre
de 2026 — ver [docs/auditoria_actualizacion_cana.md](docs/auditoria_actualizacion_cana.md).

**Pendiente:** cargas ponderadas por escorrentía (escorrentía anual promedio por buffer, IDEAM).

### Panel de monitoreo de calidad de agua (Actividad 5)

*Zona de Estudio* (hover) → **Monitoreo de calidad de agua** muestra la estación de cierre
de cada subtramo Alta / Muy alta, coloreada por estado (incluida, pendiente, excluida,
exclusión previa) con los escalones de la paleta de priorización. Un clic en un punto abre
su ficha en el panel de información: se elige N o P, la condición hidrológica y la remoción
del corredor (0–40 %), y la concentración se recalcula en vivo con
`carga = ha × FE / 365 × (1 − remoción)` y `C = carga / (Q × 86,4)`. Una meta de
concentración opcional devuelve la remoción necesaria y avisa si supera el 40 % validado. El
histórico medido va aparte, en texto: incluye aportes puntuales y no es comparable con la
concentración difusa proyectada. Las constantes viven en `src/config/monitoreo.js`, que
genera `scripts/build_monitoreo_corredor.py` con los mismos parámetros de
`docs/monitoreo_corredor.xlsx`, así que el visor y el libro no pueden diferir.

---

## Herramienta de tramos y caña de azúcar

Panel lateral → *Caña de Azúcar* (hover) → **Cortar tramos y calcular caña**.

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

Cierre geométrico 100,0000 % en ambos. `data/cartografia/cortes_tramos.geojson` trae los cortes de
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

**46 tramos en 15 ríos, 28.289,57 ha** (Palo y Desbaratado actualizados en septiembre de
2026). El Río Cauca no se divide en tramos: sus 24.414,93 ha de caña se reportan completas en
`data/exports/arcgis/`.

Se genera con:

```bash
cd scripts/tramos && npm install && node build_tramos_cana.mjs
```

`scripts/tramos/` es una herramienta de escritorio con su propio `package.json`: **el sitio estático
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
de cobertura de la CVC (`data/fuentes/cobertura/Uso_del_suelo_ZP.geojson`, escala 1:25.000).

```bash
cd scripts/tramos && node build_uso_suelo_tramos.mjs
```

Usa **los mismos tramos** que el análisis de caña: la partición del buffer vive en
`scripts/tramos/segmentacion.mjs`, compartida por los dos scripts, así que coinciden por
construcción y no por coincidencia.

Tres advertencias:

- **La capa se detiene en el límite del Valle del Cauca.** Risaralda queda con 0 % de
  cobertura y Palo con 1,5 %: ambos **se excluyen**. Desbaratado se incluye con el 49,8 %
  que sí tiene, marcado como parcial. **Sus porcentajes de uso del suelo todavía reflejan la
  caña anterior** (la caña de septiembre de 2026 supera el área que cubre la capa CVC;
  pendiente de revisión).
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
| Python | 3.x | Scripts de preparación de datos en `scripts/` (no se publican) |

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
