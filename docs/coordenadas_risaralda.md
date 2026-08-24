# Coordenadas de estaciones — Río Risaralda

Revisión cruzada de las estaciones de calidad del agua e hidrométricas del Río Risaralda,
comparando la capa de tributarios del geovisor (`Rio_Cauca_Baseline`) contra el catálogo
fuente de CARDER (`PUNTOS_DE_MONITOREO.xlsx`, hoja `MONITOREO`) y el abscisado
(`estaciones_hidro.csv`). Todas las coordenadas en **WGS84 (EPSG:4326)**.

> **Estado: 8 de 9 estaciones del catálogo CARDER.** La capa de tributarios trae las 8
> estaciones del Río Risaralda que sí tienen histórico de muestras. Queda **fuera**
> SUP-241 (Desembocadura): ningún archivo de la fuente CARDER trae su histórico real —
> ver la nota al final de §1. Aparte de estas 8, existe una estación cercana,
> "La Virginia - Risaralda", que pertenece a la capa del **Río Cauca** y no cuenta aquí —
> ver §4.

---

## 1. Estaciones de calidad del agua

**8** puntos en el geovisor (`data/geovisor/puntos_calidad_tributarios.geojson`), verificados
contra el catálogo CARDER. La columna **Δ catálogo** es la distancia entre la coordenada del
geovisor y la del catálogo CARDER para el mismo código.

| Código CARDER | Estación (geovisor) | Latitud | Longitud | N registros | Δ catálogo |
|---|---|---|---|---|---|
| SUP-047 | Quebrada Chapata - Desembocadura | 5.109283 | -75.844000 | 50 | 122 m |
| SUP-050 | Río Risaralda - Antes Descarga Municipio Mistrató | 5.308165 | -75.885589 | 37 | 50 m |
| SUP-195 | Río Risaralda - Después Descarga Municipio Mistrató | 5.293912 | -75.878735 | 45 | 0,1 m |
| SUP-123 | Río Guatica - Desembocadura río Risaralda | 5.235894 | -75.813516 | 32 | 12 m |
| SUP-048 | Río Risaralda - Las Palmeras | 5.111179 | -75.842635 | 61 | 0,3 m |
| SUP-058 | Río Risaralda - Puente Negro | 4.987874 | -75.859077 | 50 | 60 m |
| SUP-049 | Río Risaralda - Puente Umbría | 5.247729 | -75.840945 | 65 | 28 m |
| SUP-105 | Río Cauca - Antes río Risaralda | 4.892604 | -75.888080 | 47 | 0 m — corregida (ver §3) |

*Δ catálogo* de decenas de metros es normal (redigitalización manual vs. coordenada GPS de
campo). La fila de SUP-105 quedó en 0 m porque su coordenada se corrigió para que coincidiera
con el catálogo (ver §3).

### SUP-241 queda fuera — sin histórico de muestras accesible

El catálogo CARDER trae una **novena** estación, SUP-241 ("Río Risaralda - Desembocadura",
4.893119, -75.886855), que **no está** en `puntos_calidad_tributarios.geojson`: revisé dos
archivos independientes de la fuente CARDER que deberían traer su serie fisicoquímica
(`PUNTOS_DE_MONITOREO.xlsx`, hoja `SUP-241`, y el CSV suelto de la carpeta
`SUP-241 (DESEMBOCADURA - CAUCA)/calidad_fisicoquimica.csv`, incluida la copia que se dejó en
`docs/`) y **ambos contienen, por error, los mismos 50 registros de SUP-047** (Quebrada
Chapata: `Punto_COD=47`, `Punto_Nombre="QUEBRADA CHAPATA, DESEMBOCADURA"`) en vez de datos
propios de SUP-241. Es un error de captura en la fuente CARDER, no algo reconstruible desde
los archivos disponibles. Se dejó fuera de la capa por decisión explícita: solo entran
estaciones con histórico real. Si aparece un archivo con el histórico real de SUP-241, se
puede agregar como punto nuevo en `data/databases/Calidad_tributarios.geojson` y volver a
correr `src/build_calidad_trib.py`.

---

## 2. Estaciones hidrométricas (caudal)

Solo **2** estaciones de caudal reales para el Río Risaralda (con serie diaria propia,
`caudal.xlsx`); son las que carga `build_hydro_trib.py` y las que se agregaron al abscisado
en la revisión anterior:

| Estación | Latitud | Longitud | Estado | Años de datos | N días | Q prom. (m³/s) |
|---|---|---|---|---|---|---|
| Rio Risaralda EHT | 5.225670 | -75.804000 | Activa | 2025–2026 | 466 | 6,88 |
| Casa Maquinas | 5.188540 | -75.813400 | Activa | 2025–2026 | 443 | 25,51 |

Fuente: `data/hydrology/estaciones_hidro_trib.json` (coordenadas heredadas de
`data/databases/Estaciones_tributarios.geojson`).

> Los 9 puntos `SUP-*` del catálogo CARDER (8 en la capa + SUP-241) son estaciones de **calidad**, no de caudal — el
> propio catálogo las clasifica como "Monitoreo periodico". Aparecen en `estaciones_hidro.csv`
> porque ese archivo se usó también para posicionar los puntos de calidad de Risaralda a lo
> largo del eje (abscisado), no porque midan caudal.

---

## 3. Corregido: "Río Cauca - Antes río Risaralda" tenía coordenadas de SUP-241

El geovisor tenía un único punto con ese nombre, pero su coordenada original (4.893527,
-75.886642) no coincidía con SUP-105 —el código cuyo nombre sí calza ("Río Cauca, antes Río
Risaralda")— sino que estaba a solo 51 m de SUP-241 ("Río Risaralda, Desembocadura") y
snapeaba casi perfecto (0,6 m) sobre el eje digitalizado del Risaralda en vez del Cauca:

| | Latitud | Longitud | Distancia a la coordenada original del geovisor | Snapping sobre el eje del Risaralda* |
|---|---|---|---|---|
| **SUP-105** — "Río Cauca, antes Río Risaralda" (nombre igual) | 4.892604 | -75.888080 | 190 m | 189,7 m — `REVISAR_SNAPPING` |
| **SUP-241** — "Río Risaralda, Desembocadura" (nombre distinto) | 4.893119 | -75.886855 | 51 m | 0,6 m — perfecto |

*Snapping = distancia perpendicular al eje digitalizado del Río Risaralda, de `estaciones_hidro.csv`.

Esto era consistente con algo ya detectado en el análisis de tramos: esta estación se excluye
explícitamente por ser "una estación del Río Cauca clasificada bajo otro río".

**Corrección aplicada** en `data/databases/Calidad_tributarios.geojson` (fuente del pipeline
`src/build_calidad_trib.py`): las coordenadas de "Río Cauca - Antes río Risaralda" se
corrigieron a las de SUP-105 (4.892604, -75.888080) — el punto conserva su nombre e histórico
(47 muestras), solo se movió a su ubicación real. SUP-241 no se agregó como punto nuevo por
falta de histórico real (ver §1).

---

## 4. La "novena" estación cerca del Risaralda: no es parte de este conteo

Con las 8 estaciones de §1 en la capa, hay una estación más, **fuera de la capa de
tributarios**, que geográficamente cae junto al grupo de Risaralda y puede confundirse
visualmente con él en el mapa (y con SUP-241, que tampoco está en la capa — ver §1):

| Campo | Valor |
|---|---|
| Nombre | **La Virginia - Risaralda** |
| Capa | `Estaciones_Calidad_RC.geojson` — **Río Cauca**, no tributarios |
| `CORRIENTE_ORIG` (CVC) | `Rio Cauca` |
| Municipio | La Virginia (departamento de Risaralda) |
| Latitud | 4.884097 |
| Longitud | -75.869928 |
| Distancia al punto tributario más cercano | 2.128 m ("Río Cauca - Antes río Risaralda", §3) |

**"Risaralda" en el nombre se refiere al departamento/municipio, no al río** — el propio
registro de la CVC la clasifica explícitamente como corriente "Rio Cauca". Es una estación
real y correctamente ubicada; simplemente vive en otra capa del geovisor (círculos naranjas
`#FF6B35`, no verde-agua `#00BFA5` de tributarios) y su cercanía geográfica a la desembocadura
del Risaralda la hace fácil de confundir visualmente con el grupo de 8 estaciones tributarias.

**Cuentas distintas, para no confundirlas:**

| | Qué cuenta | Total |
|---|---|---|
| §1 (calidad, capa tributarios) | Estaciones con histórico real, ya en la capa | 8 |
| Catálogo CARDER completo | Las 8 de §1 + SUP-241 (sin histórico, fuera de la capa) | 9 |
| Este §4 (mapa, todas las capas) | Tributarios (8) + Río Cauca cercana (1) | 9 |

No se encontró nada equivalente en la capa hidrométrica del Río Cauca (`estaciones_hidro.json`,
16 estaciones): ninguna lleva "Risaralda" en el nombre ni cae dentro de 5 km del grupo.

---

## Fuentes

| Dato | Archivo |
|---|---|
| Estaciones de calidad, tributarios (geovisor, generado) | `Rio_Cauca_Baseline/data/geovisor/puntos_calidad_tributarios.geojson` |
| Estaciones de calidad, tributarios (fuente, coordenadas) | `Rio_Cauca_Baseline/data/databases/Calidad_tributarios.geojson` |
| Estaciones de calidad, tributarios (fuente, histórico de muestras) | `Rio_Cauca_Baseline/data/databases/Calidad_agua_completo_v12.xlsx`, hoja `CONSOLIDADO` |
| Script que cruza fuente → capa del geovisor | `Rio_Cauca_Baseline/src/build_calidad_trib.py` |
| Estaciones de calidad, Río Cauca (geovisor) | `Rio_Cauca_Baseline/data/databases/Estaciones_Calidad_RC.geojson` |
| Estaciones hidrométricas, tributarios (geovisor) | `Rio_Cauca_Baseline/data/hydrology/estaciones_hidro_trib.json` |
| Estaciones hidrométricas, Río Cauca (geovisor) | `Rio_Cauca_Baseline/data/hydrology/estaciones_hidro.json` |
| Catálogo CARDER (coordenadas SUP-*) | `Perfiles tributarios/Tributarios/RIO RISARALDA/PUNTOS_DE_MONITOREO.xlsx`, hoja `MONITOREO` |
| Catálogo CARDER (histórico por punto, con el error de SUP-241) | `Perfiles tributarios/Tributarios/RIO RISARALDA/PUNTOS_DE_MONITOREO.xlsx`, hoja `SUP-241` |
| Abscisado / snapping sobre el eje | `Perfiles tributarios/estaciones_hidro.csv` |
| Eje digitalizado del río | `Rio_Cauca_Baseline/data/cartografia/Tributarios_rios_cauca.geojson` |
