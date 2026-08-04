# Hectáreas de caña de azúcar por tramo — tributarios del Río Cauca

**Proyecto 890K | UAO × ASOCAÑA | Fase I — Corredor Biológico**  
*Generado el 2026-08-03 por `tools/tramos/build_tramos_cana.mjs`*

Desagregación de las hectáreas de caña dentro del buffer de 700 m, por tramo entre
estaciones de calidad del agua. **46 tramos en 15 ríos, 25.092,55 ha.**
El Río Cauca queda fuera de este ejercicio.

El objetivo es alimentar el modelo de carga difusa
`Carga (kg/año) = Área_caña (ha) × Coef_exportación × (Escorrentía_mm / 1000)`,
cuyos resultados se contrastan contra las mediciones de calidad en cada estación.

## 1. El buffer de 700 m solo cubre la zona plana

El buffer **no envuelve el eje completo del río**: arranca donde termina la montaña y
empieza el valle. Se verificó muestreando cada eje cada 100 m; la extensión resultante
concuerda con el campo `LONGITUD_AJUSTADA_KM` de la capa de buffer en los 15 ríos (las
diferencias de décimas provienen del paso de muestreo).

Esto tiene una consecuencia que gobierna todo el ejercicio: **una estación situada aguas
arriba de la zona plana no puede usarse como punto de corte**, porque allí no hay polígono
que partir ni caña que repartir. De las 74 estaciones disponibles, solo 48 caen
dentro de la zona cañera.

| Río | Eje (km) | Buffer (km) | Arranca en km | % del eje | Estaciones | En zona cañera |
|---|---|---|---|---|---|---|
| Rio Bugalagrande | 99,4 | 29,4 | 70,0 | 30 % | 5 | 3 |
| Rio Tulua | 73,4 | 22,1 | 51,2 | 30 % | 5 | 4 |
| Rio Nima | 39,6 | 12,5 | 27,0 | 32 % | 3 | **1** |
| Rio Palo | 83,1 | 27,5 | 55,6 | 33 % | 9 | 8 |
| Rio Riofrio | 43,7 | 18,0 | 25,6 | 41 % | 6 | 4 |
| Rio Guadalajara | 26,2 | 11,2 | 14,9 | 43 % | 6 | 3 |
| Rio Guabas | 42,2 | 21,2 | 21,0 | 50 % | 5 | **1** |
| Rio Risaralda | 107,8 | 55,5 | 52,3 | 51 % | 7 | 3 |
| Rio Desbaratado | 65,4 | 37,4 | 27,9 | 57 % | 3 | 2 |
| Rio Amaime | 86,3 | 50,4 | 35,8 | 58 % | 5 | 3 |
| Rio Fraile | 80,6 | 55,8 | 24,8 | 69 % | 4 | 3 |
| Rio Zabaletas | 43,4 | 30,8 | 12,5 | 71 % | 5 | 3 |
| Rio La Paila | 66,5 | 55,8 | 10,6 | 84 % | 4 | 4 |
| Rio Bolo | 48,0 | 40,9 | 7,1 | 85 % | 4 | 3 |
| Rio Guachal | 11,0 | 10,9 | 0,0 | 99 % | 3 | 3 |

*Ordenado por cobertura ascendente. En negrita, los ríos con una sola estación en la*
*zona cañera: no admiten ningún corte intermedio.*

## 2. Metodología

1. **Orientación del eje** aguas arriba → aguas abajo: el extremo más cercano al Río Cauca
   es la desembocadura.
2. **Proyección de estaciones** sobre el eje (`nearestPointOnLine`) para obtener su km
   acumulado. Todo el ordenamiento usa esta coordenada, nunca el orden del archivo.
3. **Depuración**: se descartan estaciones mal clasificadas y se deduplican los puntos
   físicos registrados dos veces (§4).
4. **Selección de cortes**: se descartan la primera y la última estación —son los extremos
   naturales del tramo— y de las intermedias se conservan solo las que caen dentro de la
   zona cañera. `n` estaciones útiles producen `n−1` tramos.
5. **Corte**: perpendicular local al eje en cada estación, materializada como una ranura de
   0,5 m que se resta del polígono. Se corta **secuencialmente**, verificando que cada corte
   separó de verdad el trozo.

   El rumbo del cauce se mide sobre una base de 250 m. No puede ser más corta: los ejes
   traen un vértice cada 13–24 m, así que con una base menor el rumbo lo domina el zigzag
   de digitalización y la "perpendicular" sale girada, recortando un lóbulo lateral en vez
   de cruzar el corredor. Si un corte no separa, se reintenta con bases de 500, 1.000 y
   2.000 m y líneas de 4 a 16 km.
6. **Asignación**: cada trozo resultante se adjudica al tramo cuya franja de km contiene la
   mediana de sus vértices proyectados sobre el eje. Al usar el sistema de coordenadas del
   propio cauce, el método es inmune a los meandros.
7. **Área**: `turf.area`, geodésica sobre el esferoide WGS84 — nunca planimetría sobre
   grados.

### Cortes preservados de Bolo y Fraile

Los 4 cortes de Bolo y Fraile ya estaban versionados en `data/cortes_tramos.geojson` y sus
cifras publicadas, así que **se reutilizan tal cual en vez de regenerarlos**. No es un
detalle menor: el corte del Fraile en Puente Vía a Miranda es oblicuo al eje, y sustituirlo
por la perpendicular movía su tramo 1 de 78,56 a 92,77 ha. Los 13 ríos restantes usan
cortes perpendiculares generados automáticamente.

### Columna cruda y columna normalizada

`turf.area` es geodésica y ArcGIS calculó en MAGNA-Sirgas, así que difieren en torno al
0,26 %. Se reportan ambas: la **cruda** es el cálculo directo y la **normalizada** aplica
`factor = SUM_AREA_HA / suma repartida entre los tramos`, de modo que los tramos suman
exactamente el total oficial publicado de cada río. El divisor es la suma repartida y no el
área total del río para que el factor absorba también la fracción que se lleva la ranura de
corte; esa pérdida queda visible por separado en el cierre geométrico.

### Cierre geométrico

Métrica de control: suma de los tramos ÷ total del río. Debe dar 100 %. Un valor por debajo
indica área perdida y por encima, doble conteo.

| Río | Cierre caña | Cierre buffer |
|---|---|---|
| Rio Amaime | 99,99 % | 99,99 % |
| Rio Bolo | 100,00 % | 99,99 % |
| Rio Bugalagrande | 100,00 % | 99,99 % |
| Rio Desbaratado | 100,00 % | 100,00 % |
| Rio Fraile | 100,00 % | 99,99 % |
| Rio Guabas | 100,00 % | 100,00 % |
| Rio Guachal | 99,99 % | 99,99 % |
| Rio Guadalajara | 100,00 % | 99,98 % |
| Rio La Paila | 100,00 % | 99,99 % |
| Rio Nima | 100,00 % | 100,00 % |
| Rio Palo | 99,85 % | 99,96 % |
| Rio Riofrio | 99,99 % | 99,98 % |
| Rio Risaralda | 99,99 % | 100,00 % |
| Rio Tulua | 100,00 % | 99,98 % |
| Rio Zabaletas | 99,99 % | 99,99 % |

## 3. Resumen por río

| Río | Estaciones | En zona cañera | Cortes | Tramos | Buffer (ha) | Caña (ha) | % del buffer |
|---|---|---|---|---|---|---|---|
| Rio Fraile | 4 | 3 | 2 | 3 | 6.343 | **4.990,00** | 78,7 % |
| Rio Bolo | 4 | 3 | 2 | 3 | 4.914 | **3.794,85** | 77,2 % |
| Rio Amaime | 5 | 3 | 2 | 3 | 4.616 | **3.475,86** | 75,3 % |
| Rio Zabaletas | 5 | 3 | 2 | 3 | 3.595 | **2.526,97** | 70,3 % |
| Rio Guabas | 5 | 1 | 0 | 1 | 2.720 | **1.825,85** | 67,1 % |
| Rio Desbaratado | 3 | 2 | 1 | 2 | 4.225 | **1.613,65** | 38,2 % |
| Rio La Paila | 4 | 4 | 2 | 3 | 5.717 | **1.438,91** | 25,2 % |
| Rio Bugalagrande | 5 | 3 | 2 | 3 | 3.933 | **1.282,58** | 32,6 % |
| Rio Nima | 3 | 1 | 0 | 1 | 1.415 | **896,63** | 63,4 % |
| Rio Risaralda | 7 | 3 | 2 | 3 | 6.227 | **678,41** | 10,9 % |
| Rio Guachal | 3 | 3 | 1 | 2 | 1.621 | **654,74** | 40,4 % |
| Rio Tulua | 5 | 4 | 3 | 4 | 2.888 | **631,30** | 21,9 % |
| Rio Palo | 9 | 8 | 7 | 8 | 3.259 | **511,13** | 15,7 % |
| Rio Riofrio | 6 | 4 | 3 | 4 | 2.392 | **504,77** | 21,1 % |
| Rio Guadalajara | 6 | 3 | 2 | 3 | 1.496 | **266,90** | 17,8 % |
| **TOTAL** | | | | **46** | | **25.092,55** | |

## 4. Detalle por tramo

El campo *zona* indica si la estación que abre el tramo está dentro de la zona cañera. Un
`no` significa que el tramo arranca en realidad donde el buffer entra al valle, aguas abajo
de esa estación de montaña.

### Rio Amaime

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Despues Caserio Auji (n=15) → Antes Caserio el Placer (n=19) | 0,0–43,9 | 43,9 | 953 | 710,03 | **708,20** | 20,4 % | no |
| 2 | Antes Caserio el Placer (n=19) → Antes desembocadura de Rio Nima (n=19) | 43,9–46,1 | 2,2 | 253 | 83,70 | **83,49** | 2,4 % | sí |
| 3 | Antes desembocadura de Rio Nima (n=19) → antes Desembocadura a Rio Cauca (n=19) | 46,1–86,3 | 40,2 | 3.409 | 2.691,11 | **2.684,17** | 77,2 % | sí |
| | **Total** | | | **4.616** | | **3.475,86** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Despues Caserio Auji (km 23,0); Antes Caserio Tablones - Balneario Puerto Amor (km 32,9).

### Rio Bolo

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Limnígrafo CVC - Los Minchos (n=15) → Puente Pradera - Palmira (n=16) | 0,0–10,9 | 10,9 | 491 | 296,39 | **295,62** | 7,8 % | no |
| 2 | Puente Pradera - Palmira (n=16) → Puente Bolo - San Isidro - vía a Candelaria (n=16) | 10,9–30,0 | 19,1 | 1.997 | 1.618,95 | **1.614,77** | 42,6 % | sí |
| 3 | Puente Bolo - San Isidro - vía a Candelaria (n=16) → Antes desembocadura a Frayle en puente Recta Cali - Palmira (n=16) | 30,0–48,0 | 18,0 | 2.426 | 1.889,34 | **1.884,46** | 49,7 % | sí |
| | **Total** | | | **4.914** | | **3.794,85** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Limnígrafo CVC - Los Minchos (km 1,1).

### Rio Bugalagrande

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Puente antes Caserio San Rafael. (n=14) → Conciviles - Andalucía (n=18) | 0,0–81,6 | 81,6 | 1.518 | 80,71 | **80,47** | 6,3 % | no |
| 2 | Conciviles - Andalucía (n=18) → Puente Variante Bugalagrande (n=18) | 81,6–85,1 | 3,5 | 426 | 33,48 | **33,39** | 2,6 % | sí |
| 3 | Puente Variante Bugalagrande (n=18) → antes desembocadura a Río Cauca - Hacienda El Guayabo (n=18) | 85,1–99,4 | 14,3 | 1.988 | 1.172,14 | **1.168,72** | 91,1 % | sí |
| | **Total** | | | **3.933** | | **1.282,58** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Puente antes Caserio San Rafael. (km 61,6); Puente Colgante El Placer (km 67,9).

### Rio Desbaratado

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Antes de bocatoma cabecera Miranda (n=18) → Antes de porcícola (Pte. Jordán) (n=18) | 0,0–40,9 | 40,9 | 1.352 | 451,78 | **450,63** | 27,9 % | no |
| 2 | Antes de porcícola (Pte. Jordán) (n=18) → Puente Ortigal (n=18) | 40,9–65,4 | 24,4 | 2.873 | 1.166,00 | **1.163,02** | 72,1 % | sí |
| | **Total** | | | **4.225** | | **1.613,65** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Antes de bocatoma cabecera Miranda (km 26,0).

### Rio Fraile

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Nacimiento El Pedregal (n=16) → Puente Vía a Miranda (n=16) | 0,0–28,9 | 28,9 | 474 | 78,73 | **78,53** | 1,6 % | no |
| 2 | Puente Vía a Miranda (n=16) → Limnigrafo CVC - caserio Brisas de Frayle (n=16) | 28,9–52,1 | 23,3 | 2.336 | 1.965,52 | **1.960,56** | 39,3 % | sí |
| 3 | Limnigrafo CVC - caserio Brisas de Frayle (n=16) → Antes Desembocadura a rio Guachal Recta Cali Palmira (n=15) | 52,1–80,6 | 28,5 | 3.532 | 2.958,36 | **2.950,90** | 59,1 % | sí |
| | **Total** | | | **6.343** | | **4.990,00** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Nacimiento El Pedregal (km 24,6).

### Rio Guabas

> **Sin desagregar.** Solo hay una estación dentro de la zona cañera, así que no existe
> ningún punto de corte intermedio. Es un vacío de monitoreo, no un error de cálculo.

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Antes Mina La Victoria (n=17) → Antes desembocadura a Río Cauca (n=17) | 0,0–42,2 | 42,2 | 2.720 | 1.830,69 | **1.825,85** | 100,0 % | no |
| | **Total** | | | **2.720** | | **1.825,85** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Antes Mina La Victoria (km 10,7); Puente despues Mina La Victoria (km 13,9); Quebrada Los Lulos - Antes desembocadura a rio Guabas (km 17,5); Puente Rojo - Bocatoma Acueducto de Ginebra (km 18,9).

*Estaciones descartadas:* despues Mina La Victoria — duplicada en km 13.91.

### Rio Guachal

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | GG1 - Después Confluencia Ríos Fraile Y Bolo (n=0) → GG2 - Puente vía Yumbo-Aeropuerto (n=0) | 0,0–6,0 | 6,0 | 882 | 442,42 | **441,40** | 67,4 % | sí |
| 2 | GG2 - Puente vía Yumbo-Aeropuerto (n=0) → GG3 - Rio Guachal - Antes Desembocadura a Rio Cauca (n=16) | 6,0–11,0 | 5,0 | 739 | 213,84 | **213,34** | 32,6 % | sí |
| | **Total** | | | **1.621** | | **654,74** | 100,0 % | |

### Rio Guadalajara

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | La Piscina - Vía a Alaska (n=19) → Bocatoma Acueducto Buga (n=19) | 0,0–17,0 | 17,0 | 188 | 0,00 | **0,00** | 0,0 % | no |
| 2 | Bocatoma Acueducto Buga (n=19) → Puente Frente vía Ferrea (n=19) | 17,0–21,7 | 4,7 | 620 | 0,00 | **0,00** | 0,0 % | sí |
| 3 | Puente Frente vía Ferrea (n=19) → antes desembocadura a Rio Cauca (El Porvenir) (n=19) | 21,7–26,2 | 4,5 | 687 | 267,61 | **266,90** | 100,0 % | sí |
| | **Total** | | | **1.496** | | **266,90** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* La Piscina - Vía a Alaska (km 3,2); Antes desembocadura de Quebrada La Magdalena - puente Colgante (km 6,5); Puente Balneario los Guaduales (km 11,7).

### Rio La Paila

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Puente Paila arriba - vía a Sevilla (n=18) → antes desembocadura del rio Totoro (n=19) | 0,0–38,3 | 38,3 | 2.629 | 54,38 | **54,21** | 3,8 % | sí |
| 2 | antes desembocadura del rio Totoro (n=19) → Planta Acuavalle (n=18) | 38,3–41,7 | 3,5 | 341 | 3,41 | **3,40** | 0,2 % | sí |
| 3 | Planta Acuavalle (n=18) → Antes desembocadura a Rio Cauca (n=17) | 41,7–66,5 | 24,7 | 2.747 | 1.385,55 | **1.381,30** | 96,0 % | sí |
| | **Total** | | | **5.717** | | **1.438,91** | 100,0 % | |

### Rio Nima

> **Sin desagregar.** Solo hay una estación dentro de la zona cañera, así que no existe
> ningún punto de corte intermedio. Es un vacío de monitoreo, no un error de cálculo.

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Antes Caserio de tenjo (n=17) → Antes desembocadura a rio Amaime (n=18) | 0,0–39,6 | 39,6 | 1.415 | 899,17 | **896,63** | 100,0 % | no |
| | **Total** | | | **1.415** | | **896,63** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Antes Caserio de tenjo (km 15,7); Acueducto Nima (km 18,9).

### Rio Palo

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Bocatoma corregimiento El Palo (n=20) → Antes de PTAR Guachené (n=25) | 0,0–56,3 | 56,3 | 85 | 0,20 | **0,20** | 0,0 % | no |
| 2 | Antes de PTAR Guachené (n=25) → Después de PTAR Guachené (n=22) | 56,3–57,9 | 1,6 | 193 | 12,95 | **12,94** | 2,5 % | sí |
| 3 | Después de PTAR Guachené (n=22) → Puente del Maíz (n=22) | 57,9–65,2 | 7,3 | 719 | 193,23 | **193,04** | 37,8 % | sí |
| 4 | Puente del Maíz (n=22) → Antes Bocatoma Propal (n=8) | 65,2–68,7 | 3,5 | 405 | 3,21 | **3,21** | 0,6 % | sí |
| 5 | Antes Bocatoma Propal (n=8) → Puente PICC (n=22) | 68,7–71,5 | 2,8 | 359 | 0,00 | **0,00** | 0,0 % | sí |
| 6 | Puente PICC (n=22) → Puente Perico Negro (n=25) | 71,5–73,3 | 1,8 | 240 | 45,91 | **45,86** | 9,0 % | sí |
| 7 | Puente Perico Negro (n=25) → Puente Puerto Tejada (n=22) | 73,3–75,4 | 2,1 | 251 | 73,80 | **73,73** | 14,4 % | sí |
| 8 | Puente Puerto Tejada (n=22) → Desembocadura a río Cauca (n=25) | 75,4–83,1 | 7,7 | 1.006 | 182,32 | **182,15** | 35,6 % | sí |
| | **Total** | | | **3.259** | | **511,13** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Bocatoma corregimiento El Palo (km 44,2).

### Rio Riofrio

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Rio Guayabal (n=18) → puente despues Salonica - limnigrafo CVC (n=18) | 0,0–25,6 | 25,6 | 7 | 0,00 | **0,00** | 0,0 % | no |
| 2 | puente despues Salonica - limnigrafo CVC (n=18) → Bocatoma Acueducto de Riofrio (n=18) | 25,6–33,2 | 7,6 | 930 | 0,00 | **0,00** | 0,0 % | sí |
| 3 | Bocatoma Acueducto de Riofrio (n=18) → Antes Municipio Riofrio (n=18) | 33,2–38,1 | 4,9 | 632 | 119,32 | **119,01** | 23,6 % | sí |
| 4 | Antes Municipio Riofrio (n=18) → Antes desembocadura a Río Cauca (n=16) | 38,1–43,7 | 5,5 | 822 | 386,76 | **385,76** | 76,4 % | sí |
| | **Total** | | | **2.392** | | **504,77** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Rio Guayabal (km 24,3); Rio Valcanes (km 24,7).

### Rio Risaralda

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Antes Descarga Municipio Mistrató (n=37) → Las Palmeras (n=61) | 0,0–64,8 | 64,8 | 1.605 | 78,57 | **78,31** | 11,5 % | no |
| 2 | Las Palmeras (n=61) → Quebrada Chapata - Desembocadura (n=50) | 64,8–65,1 | 0,2 | 34 | 15,14 | **15,09** | 2,2 % | sí |
| 3 | Quebrada Chapata - Desembocadura (n=50) → Puente Negro (n=50) | 65,1–107,8 | 42,8 | 4.588 | 587,00 | **585,01** | 86,2 % | sí |
| | **Total** | | | **6.227** | | **678,41** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Antes Descarga Municipio Mistrató (km 28,4); Después Descarga Municipio Mistrató (km 30,3); Puente Umbría (km 40,3); Desembocadura río Risaralda (km 45,5).

*Estaciones descartadas:* Antes río Risaralda — estación del Río Cauca clasificada bajo otro río.

### Rio Tulua

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Antes Jardin Botanico (limnigrafo CVC) (n=19) → Puente Ferrocarril Barrio La Trinidad (n=19) | 0,0–61,5 | 61,5 | 1.370 | 60,36 | **60,19** | 9,5 % | no |
| 2 | Puente Ferrocarril Barrio La Trinidad (n=19) → Puente Nuevo (Barrio 7 de Agosto) (n=19) | 61,5–62,7 | 1,2 | 166 | 0,10 | **0,10** | 0,0 % | sí |
| 3 | Puente Nuevo (Barrio 7 de Agosto) (n=19) → Despues Urbanizacion Maracaibo (n=19) | 62,7–64,0 | 1,3 | 166 | 0,01 | **0,01** | 0,0 % | sí |
| 4 | Despues Urbanizacion Maracaibo (n=19) → antes desembocadura a Río Cauca (vereda El Salto) (n=13) | 64,0–73,4 | 9,4 | 1.186 | 572,63 | **571,00** | 90,4 % | sí |
| | **Total** | | | **2.888** | | **631,30** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Antes Jardin Botanico (limnigrafo CVC) (km 50,2).

*Estaciones descartadas:* Antes desembocadura a Río Cauca — duplicada en km 67.68.

### Rio Zabaletas

| # | Tramo | km | Long. (km) | Buffer (ha) | Caña cruda (ha) | Caña norm. (ha) | % río | Zona |
|---|---|---|---|---|---|---|---|---|
| 1 | Antes caserío Los Medios (n=16) → Cruce sector vía La Novillera (n=16) | 0,0–14,9 | 14,9 | 253 | 44,83 | **44,72** | 1,8 % | no |
| 2 | Cruce sector vía La Novillera (n=16) → Puente vía Santa Elena-Ginebra (n=16) | 14,9–20,1 | 5,2 | 591 | 343,74 | **342,85** | 13,6 % | sí |
| 3 | Puente vía Santa Elena-Ginebra (n=16) → Antes desembocadura a Rio Cauca (n=16) | 20,1–43,4 | 23,3 | 2.751 | 2.144,92 | **2.139,40** | 84,7 % | sí |
| | **Total** | | | **3.595** | | **2.526,97** | 100,0 % | |

*Estaciones fuera de la zona cañera (no utilizables como corte):* Antes caserío Los Medios (km 3,8); Bocatoma Acuavalle Santa Elena (km 5,0).

*Estaciones descartadas:* Puente después caserío Los Medios — duplicada en km 5.10.

## 5. Anomalías de datos detectadas

Se documentan para que puedan corregirse en la fuente; el análisis las maneja pero conviene
resolverlas en el Excel y el GeoJSON de origen.

- **Grafías divergentes entre capas.** La cartografía escribe `Rio Fraile` y `Rio Zabaletas`;
  los puntos de calidad, `Rio Frayle` y `Rio Sabaletas`. Se unifican mediante una tabla de
  alias en `src/tramos/stations.js`. Sin ella, Zabaletas se queda sin estaciones y sus
  2.526,97 ha no se desagregan.
- **Puntos físicos duplicados.** Guabas registra "Puente después Mina La Victoria" (n=10) y
  "después Mina La Victoria" (n=7) en la misma coordenada; Tuluá hace lo propio en su
  desembocadura. Se conserva el registro con más muestras.
- **Estación mal clasificada.** `"Río Cauca - Antes río Risaralda"` figura bajo Río
  Risaralda; se excluye por decisión explícita.
- **Estaciones sobre subafluentes.** Valcanes (a 389 m del eje del Riofrío), Quebrada Los
  Lulos (147 m del Guabas), Río Guatica y Quebrada Chapata (88 m del Risaralda) miden
  cuerpos de agua distintos al cauce principal. Solo Chapata cae dentro de la zona cañera y
  se conserva como corte por decisión explícita, al marcar la confluencia de un afluente.
- **Río Parraga** tiene eje propio (46 km) y 3 estaciones, pero **ni buffer ni caña**
  asignada, por lo que queda fuera del alcance. Conviene confirmar que es lo esperado.
- **Guachal GG1 y GG2** aún no tienen datos de calidad (`N_Registros = 0`). Se incluyen para
  dejar la geometría lista, pero sus tramos no admiten contraste con mediciones todavía.

## 6. Limitaciones y advertencias

- **Vacíos de monitoreo.** Guabas (1.825,85 ha) y Nima (896,63 ha) tienen una sola estación
  dentro de la zona cañera y quedan sin desagregar. Si la fase siguiente necesita resolución
  por tramo en esos ríos, hay que instalar estaciones intermedias.
- **Tramos altos con poca o ninguna caña.** Guadalajara y Tuluá presentan tramos con ~0 ha.
  Es correcto: están en el piedemonte, aguas arriba del cultivo.
- **El geovisor no coincide con este reporte.** La herramienta interactiva
  (`src/controls/CutLineTool.js`) sigue usando el método de semiplano infinito, que sobrestima
  por doble conteo en ríos meandriformes (el Palo cerraba en 112,38 %). **Las cifras válidas
  son las de este reporte.** Portar el método nuevo al visor está pendiente.
- **Precisión.** La ranura de corte consume entre 0,06 y 0,59 ha por río (< 0,02 %),
  absorbida por la normalización. La diferencia entre el área geodésica y la de ArcGIS es del
  orden del 0,26 % y también queda absorbida.

---

## Fuentes

| Capa | Archivo |
|---|---|
| Buffer 700 m | `data/cartografia/Buffer_Zona_de_Estudio.geojson` |
| Caña de azúcar | `data/cartografia/Hectareas_CZ.geojson` (campo `SUM_AREA_HA`) |
| Ejes de tributarios | `data/cartografia/Tributarios_rios_cauca.geojson` |
| Río Cauca (orientación) | `data/cartografia/Rio_cauca.geojson` |
| Estaciones de calidad | `data/geovisor/puntos_calidad_tributarios.geojson` |

Todas en WGS84 (EPSG:4326). Datos tabulares en `docs/tramos_cana_tributarios.csv`.
