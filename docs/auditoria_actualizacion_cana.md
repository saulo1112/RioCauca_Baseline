# Auditoría — actualización de caña (Cauca, Palo, Desbaratado) y reorganización del repositorio

*Septiembre de 2026. Fuente de la caña nueva: capa ajustada entregada por el equipo
(`Hectáreas_CZ_ajustado.geojson`), incorporada como `data/cartografia/Hectareas_CZ.geojson`.*

Todas las cifras "antes" salen del commit `b79644b` (repositorio ya reorganizado, caña
anterior) y las "después" del estado actual, calculadas por script — nada se transcribió a mano.

---

## 1. Resumen

| Río | Caña antes (ha) | Caña después (ha) | Δ (ha) | Polígonos |
|---|---:|---:|---:|---|
| Río Cauca | 23.225,56 | **24.414,93** | +1.189,37 | 451 → 458 |
| Río Desbaratado | 1.613,65 | **3.687,40** | +2.073,75 | 34 → 2 |
| Río Palo | 511,13 | **1.634,40** | +1.123,27 | 33 → 11 |
| **Total capa (16 ríos)** | 48.318,11 | **52.704,50** | +4.386,39 | |
| **Total tributarios por tramo (15 ríos)** | 25.092,55 | **28.289,57** | +3.197,02 | |

- Los otros 13 ríos quedaron **idénticos** (geometría y área al centésimo; verificado).
- Toda la caña nueva cae 100 % dentro del buffer de 700 m y no se solapa entre ríos.
- **Cargas N/P del corredor (tributarios):** 240.085 → **270.682 kg N/año** (+30.597) y
  34.526 → **38.946 kg P/año** (+4.420).

---

## 2. Capa de caña (`data/cartografia/Hectareas_CZ.geojson`)

- La capa ajustada traía el área en `AREA_CALC_HA` y no en `SUM_AREA_HA`, que es el campo que
  leen el geovisor y los scripts. Se agregó `SUM_AREA_HA = round(AREA_CALC_HA, 2)` conservando
  `AREA_CALC_HA` y la geometría exacta del archivo entregado. El archivo ajustado se retiró del
  repositorio porque su contenido completo quedó en la capa canónica.
- Tamaño: 25,6 MB → 9,2 MB (JSON compacto): el geovisor la carga más rápido.

### Efecto en el popup de caña ("Porcentaje relativo")

El popup calcula el % de cada río sobre el total de la capa, así que al subir el total cambia
el porcentaje de **todos** los ríos, no solo de los tres editados:

| Río | ha | % antes | % después |
|---|---:|---:|---:|
| Río Cauca | 24.414,93 | 48,07 | 46,32 |
| Río Fraile | 4.990,00 | 10,33 | 9,47 |
| Río Bolo | 3.794,85 | 7,85 | 7,20 |
| **Río Desbaratado** | 3.687,40 | 3,34 | **7,00** |
| Río Amaime | 3.475,86 | 7,19 | 6,59 |
| Río Zabaletas | 2.526,97 | 5,23 | 4,79 |
| Río Guabas | 1.825,85 | 3,78 | 3,46 |
| **Río Palo** | 1.634,40 | 1,06 | **3,10** |
| Río La Paila | 1.438,91 | 2,98 | 2,73 |
| Río Bugalagrande | 1.282,58 | 2,65 | 2,43 |
| Río Nima | 896,63 | 1,86 | 1,70 |
| Río Risaralda | 678,41 | 1,40 | 1,29 |
| Río Guachal | 654,74 | 1,36 | 1,24 |
| Río Tuluá | 631,30 | 1,31 | 1,20 |
| Río Riofrío | 504,77 | 1,04 | 0,96 |
| Río Guadalajara | 266,90 | 0,55 | 0,51 |

---

## 3. Caña por tramo (`docs/tramos_cana_tributarios.csv`)

Los cortes de tramo no cambian (dependen de las estaciones, no de la caña); solo se reparte la
caña nueva. Cierre geométrico: Desbaratado 100,00 %, Palo **99,85 % → 99,96 %**.

| Río | T | Tramo | Caña antes | Caña después | % del río antes → después | % cobertura antes → después |
|---|---|---|---:|---:|---|---|
| Desbaratado | 1 | Antes de bocatoma cabecera Miranda → Antes de porcícola (Pte. Jordán) | 450,63 | **1.181,63** | 27,93 → 32,05 | 33,33 → 87,41 |
| Desbaratado | 2 | Antes de porcícola (Pte. Jordán) → Puente Ortigal | 1.163,02 | **2.505,77** | 72,07 → 67,95 | 40,48 → 87,22 |
| Palo | 1 | Bocatoma corregimiento El Palo → Antes de PTAR Guachené | 0,20 | **40,69** | 0,04 → 2,49 | 0,24 → 48,11 |
| Palo | 2 | Antes de PTAR Guachené → Después de PTAR Guachené | 12,94 | **76,32** | 2,53 → 4,67 | 6,70 → 39,54 |
| Palo | 3 | Después de PTAR Guachené → Puente del Maíz | 193,04 | **465,19** | 37,77 → 28,46 | 26,84 → 64,67 |
| Palo | 4 | Puente del Maíz → Antes Bocatoma Propal | 3,21 | **310,31** | 0,63 → 18,99 | 0,79 → 76,68 |
| Palo | 5 | Antes Bocatoma Propal → Puente PICC | 0,00 | **172,55** | 0,00 → 10,56 | 0,00 → 48,02 |
| Palo | 6 | Puente PICC → Puente Perico Negro | 45,86 | **75,55** | 8,97 → 4,62 | 19,11 → 31,48 |
| Palo | 7 | Puente Perico Negro → Puente Puerto Tejada | 73,73 | **51,04** ↓ | 14,42 → 3,12 | 29,43 → 20,38 |
| Palo | 8 | Puente Puerto Tejada → Desembocadura a río Cauca | 182,15 | **442,74** | 35,64 → 27,09 | 18,10 → 44,00 |

> **Palo T7 baja** (73,73 → 51,04 ha): la edición no solo agregó caña, también la redistribuyó
> a lo largo del río. Vale la pena confirmarlo contra la cobertura fuente.

---

## 4. Cargas N/P y priorización (`data/fuentes/priorizacion/Priorizacion_NP_subtramos.csv`)

**Método** (Nota de la Tabla 5.2, escenario de mediana emisión): N = área × 9,57 kg/ha/año,
P = área × 1,38 kg/ha/año, kg/d = kg/año ÷ 365. **Categoría** por umbrales sobre la carga de N:
≥ 15.000 Muy alta · ≥ 5.000 Alta · ≥ 1.000 Media · > 0 Baja · 0 No aplica.

Los umbrales no estaban escritos en el informe; se infirieron de la tabla publicada y se
validaron: **reproducen la categoría publicada de las 35 filas que no se tocaron**.

Filas modificadas (el resto queda como se publicó):

| Río | T | Área (ha) | N (kg/año) | P (kg/año) | Categoría |
|---|---|---|---|---|---|
| Desbaratado | 1 | 450,6 → 1.181,6 | 4.312 → 11.308 | 620 → 1.631 | Media → **Alta** |
| Desbaratado | 2 | 1.163,0 → 2.505,8 | 11.128 → 23.980 | 1.600 → 3.458 | Alta → **Muy alta** |
| Palo | 1 | 0,2 → 40,7 | 2 → 389 | 0 → 56 | Baja |
| Palo | 2 | 12,9 → 76,3 | 124 → 730 | 18 → 105 | Baja |
| Palo | 3 | 193,0 → 465,2 | 1.847 → 4.452 | 266 → 642 | Media |
| Palo | 4 | 3,2 → 310,3 | 31 → 2.970 | 4 → 428 | Baja → **Media** |
| Palo | 5 | 0,0 → 172,6 | 0 → 1.651 | 0 → 238 | No aplica → **Media** |
| Palo | 6 | 45,9 → 75,5 | 439 → 723 | 63 → 104 | Baja |
| Palo | 7 | 73,7 → 51,0 | 705 → 488 | 101 → 70 | Baja |
| Palo | 8 | 182,2 → 442,7 | 1.743 → 4.237 | 251 → 611 | Media |
| Guachal | 1 | 654,7 (sin cambio) | 6.264 (sin cambio) | 901 | Media → **Alta** |

Guachal no cambió de caña: se recategoriza porque al fusionar sus dos subtramos (corrección de
GG2) su carga quedó en 6.264 kg N/año, por encima del umbral de Alta.

| Categoría | Tramos antes | Tramos después |
|---|---:|---:|
| Muy alta | 7 | **8** |
| Alta | 7 | **8** |
| Media | 9 | 9 |
| Baja | 16 | **15** |
| No aplica | 7 | **6** |

Totales de la tabla: 240.085 → 270.682 kg N/año (658,0 → 741,8 kg N/d) y
34.526 → 38.946 kg P/año (94,7 → 107,1 kg P/d).

---

## 5. Capa para ArcGIS (`data/exports/arcgis/`, GeoJSON + shapefile)

- Palo y Desbaratado: `CANA_CRUD`, `CANA_NORM`, `PCT_CANA`, `PCT_COBER` con los valores de la
  sección 3.
- **Río Cauca: antes llevaba la caña vacía; ahora** `CANA_CRUD` 24.481,03 (geodésica),
  `CANA_NORM` 24.414,93, `PCT_CANA` 100, `PCT_COBER` 46,32 % de sus 52.714,75 ha de buffer.
- **Las columnas `CN_Normal` y `CN_Humedo` agregadas en ArcGIS se conservaron** en las 47
  filas, con valores idénticos (ver sección 8).

---

## 6. Río Cauca — carga proyectada (solo informativa)

El geovisor no muestra cargas del Cauca (no forma parte de la Tabla 5.2). Con los mismos
factores:

| | Caña (ha) | N (kg/año) | N (kg/d) | P (kg/año) | P (kg/d) |
|---|---:|---:|---:|---:|---:|
| Antes | 23.225,56 | 222.269 | 609,0 | 32.051 | 87,8 |
| **Después** | **24.414,93** | **233.651** | **640,1** | **33.693** | **92,3** |

---

## 7. Cambios en el geovisor

| Qué | Cambio |
|---|---|
| Capa de caña | Valores nuevos de Cauca, Palo y Desbaratado; % relativo de todos los ríos recalculado (sección 2) |
| Priorización N/P | 11 tramos con área, cargas o categoría nuevas; leyenda con nota "caña actualizada 2026-09" |
| Herramienta de tramos | Palo normaliza contra 1.634,40 ha (factor 0,9975, cierre 100,000 %); Desbaratado contra 3.687,40 ha |
| Caché | `BUILD_VERSION` 2.6 → 2.7 (el navegador descarga las capas nuevas) |
| Verificación | Playwright: popups y herramienta leen los valores nuevos; 0 requests con error, 0 errores de consola |

---

## 8. Correcciones hechas de paso

- **`build_tramos_cana.mjs` escribía `NaN` sin fallar** si la capa de caña no traía
  `SUM_AREA_HA` (justo lo que habría pasado al reemplazar el archivo tal cual). Ahora falla con
  un mensaje claro.
- **`geojson_a_shapefile.py` borraba las columnas agregadas en ArcGIS** al regenerar el
  shapefile (se detectó con `CN_Normal`/`CN_Humedo`, que se restauraron de inmediato desde git).
  Ahora las conserva uniéndolas por río + tramo. Además usa rutas relativas.
- **`docs/caudal_consolidado_tributarios.csv` estaba desactualizado**: no incluía Buichitolo ni
  La Rafaela (agregadas después de generarlo). Se regeneró durante la reorganización.

---

## 9. Pendientes (no se modificaron, a propósito)

1. **Uso del suelo de Desbaratado** (`docs/uso_suelo_tramos.*`) sigue con la caña anterior: la
   caña nueva (1.181,63 y 2.505,77 ha) supera el área que cubre la capa CVC en esos tramos (644 y
   1.460 ha, solo el 49,8 % del buffer). Queda para otra sesión.
2. **Número de curva en ArcGIS**: los CN de Palo, Desbaratado y Cauca se calcularon con la
   cobertura anterior; si dependen de la caña, conviene recalcularlos.
3. **Excel `data/fuentes/priorizacion/ECM_Contaminacion_Difusa_Final.xlsx`** (hoja
   `Estimacion ECM`): sigue con las áreas anteriores (Cauca 23.225,56, Desbaratado 1.613,65,
   Palo 511,13), usa factores 4,8 / 0,6 kg/ha/año (distintos de 9,57 / 1,38) y tiene
   **intercambiadas las áreas de Guadalajara y Guachal** (filas 12–13). No lo usa ningún script.
4. **Documento del informe (Tabla 5.2)**: incorporar las filas nuevas de Palo y Desbaratado y la
   recategorización de Guachal.
5. **Palo T7** baja de 73,73 a 51,04 ha: confirmar contra la cobertura fuente.

---

## 10. Reorganización del repositorio (commit `b79644b`)

| Antes | Ahora |
|---|---|
| `src/*.py` | `scripts/*.py` |
| `tools/tramos/` | `scripts/tramos/` |
| `data/cortes_tramos.geojson` | `data/cartografia/cortes_tramos.geojson` |
| `data/databases/Estaciones_Calidad_RC.geojson`, `Calidad_del_agua_del_Rio_Cauca_*.csv` | `data/calidad_agua/` |
| `data/geovisor/` (puntos, estadísticas, `csv_por_punto/`) | `data/calidad_agua/` |
| `data/water_quality/perfiles/` | `data/calidad_agua/perfiles/` |
| `data/hydrology/` | `data/hidrologia/` |
| `data/databases/Calidad_agua_completo_v12.xlsx`, `Calidad_tributarios.geojson` | `data/fuentes/calidad_agua/` |
| `data/databases/hidrology/…`, `Estaciones_tributarios.geojson` | `data/fuentes/hidrologia/` |
| `data/databases/Uso_del_suelo_ZP.geojson`, `docs/Coberturas (Palo, Desbaratado y Risaralda)/` | `data/fuentes/cobertura/` |
| `data/databases/Priorizacion_NP_subtramos.csv`, `ECM_Contaminacion_Difusa_Final (3).xlsx` | `data/fuentes/priorizacion/` |
| `data/cartografia/Buffer_Zona_Estudio_por_Tramo.geojson`, `shapefiles/` | `data/exports/arcgis/` |

**Eliminados** (duplicados exactos verificados por hash, u obsoletos; recuperables del historial):
`data/water quality/` (sin uso desde el commit 86ad8b3), el espejo
`Curvas de duración de caudal/` (110 archivos, 47 MB, todos con copia idéntica conservada),
los 6 `perfil_*_boxplot.png`, las salidas de LA FLORESTA y LA PRIMAVERA, el CSV huérfano de
GG2 y la copia duplicada de `docs/PUNTOS_DE_MONITOREO.xlsx`.

**Publicación:** GitHub Pages ahora sube solo `index.html`, `css/`, `src/` y
`data/{cartografia,calidad_agua,hidrologia}` — unos 55 MB en lugar de ~300 MB.

**Verificación:** todos los pipelines corrieron desde su nueva ubicación con salidas idénticas;
en el navegador, las 150 URLs dinámicas (CSV y curvas de cada estación, CSV por punto) responden
sin error, tanto en el repositorio completo como en el sitio recortado.
