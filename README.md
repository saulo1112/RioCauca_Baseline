# Corredor Biológico — Línea Base Interactiva
**Proyecto 890K | UAO × ASOCAÑA | Fase I — Diagnóstico de Calidad del Agua**

Plataforma web estática (GitHub Pages) que sirve como línea base interactiva de calidad del agua del río Cauca y sus tributarios priorizados (Pan de Azúcar → La Virginia).

---

## Estructura del repositorio

```
Rio_Cauca_Baseline/
├── index.html                         ← Entrada principal
├── css/styles.css                     ← Estilos dark mode
├── js/
│   ├── data-loader.js                 ← Carga GeoJSON y CSV
│   ├── map.js                         ← Mapa Leaflet (capas, popups, filtros)
│   ├── charts.js                      ← Gráficas Chart.js
│   └── filters.js                     ← Event listeners UI
├── data/
│   ├── rios_tributarios.geojson       ← 15 tributarios (geometría aprox.)
│   ├── estaciones_hidrometricas.geojson ← 35 estaciones CVC (coords aprox.)
│   ├── cauca_tramos.geojson           ← 3 tramos río Cauca
│   ├── calidad_agua.csv               ← Perfil calidad (muestra / CARDER)
│   ├── hidrometria.csv                ← Estadísticos caudal (muestra / CVC)
│   └── caudales_cdc.csv               ← Curvas duración caudal (CARDER ERA)
├── scripts/
│   └── prepare_data.py                ← Transforma CSVs CARDER → formato app
└── .github/workflows/deploy.yml      ← Auto-deploy en GitHub Pages
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
- Calcular áreas de caña por buffer de 700 m en ArcGIS Pro
- Obtener escorrentía anual promedio por buffer (IDEAM)

---

## Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Leaflet.js | 1.9.4 | Mapa interactivo |
| Chart.js | 4.4.0 | Gráficas calidad/caudal/carga |
| PapaParse | 5.4.1 | Lectura de CSV |
| Google Fonts | — | DM Sans + Syne |
| GitHub Pages | — | Hosting estático |
| GitHub Actions | v4 | Auto-deploy |
| Python / pandas | 3.x | Script de transformación de datos |

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
