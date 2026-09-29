# Estación IDF más cercana a cada pour point de tributario

Segunda versión del cruce IDF, con el conjunto de puntos correcto — ver
`docs/estaciones_idf_calidad_agua.md` para la versión anterior (98
estaciones de calidad de agua completas), que queda sin tocar para poder
comparar.

Esta vez el cruce es: **15 pour points oficiales de tributarios** (los
mismos que usa el proyecto para delimitación de cuencas y cálculo de área
aportante) contra **6 estaciones IDF** ya validadas como representativas del
clima del corredor Valle del Cauca / Risaralda norte. No se calculó
distancia hacia ninguna otra estación IDF del dataset completo — las del
sur de Popayán (Mercaderes, Paletara, Aeropuerto Guillermo León Valencia,
Santa Leticia) y las de vertiente Pacífico (Bajo Calima, Misión La) quedaron
fuera del cálculo, no solo del resultado.

**Tarea puramente investigativa — no se tocó el geovisor ni ningún dato del
proyecto.**

## Verificación de los pour points (antes de cruzar)

Antes de calcular nada, verifiqué los 15 pour points contra
`docs/estaciones_calidad_agua.csv`: **los 15 coinciden en 0,000 km** con la
estación de calidad de agua más cercana a la desembocadura de cada
tributario al río Cauca (la última estación aguas abajo de cada río). Por
ejemplo, el pour point de Amaime (3.665939, -76.408735) es exactamente
"Rio Amaime - antes Desembocadura a Rio Cauca"; el de Risaralda
(4.892604, -75.888080) es exactamente "Río Cauca - Antes río Risaralda"
(SUP-105). Confirma lo que dijiste: son, en efecto, las estaciones de
calidad más cercanas a la desembocadura de cada tributario.

## Tabla — estación IDF asignada por tributario

| Tributario | Estación IDF asignada | Código | Distancia | Nota |
|---|---|---|---|---|
| Amaime | Palmira ICA | 26075010 | 19,94 km | |
| Bolo | Palmira ICA | 26075010 | 14,84 km | |
| Bugalagrande | Aeropuerto Farfán | 26105160 | 19,80 km | |
| Desbaratado | Palmira ICA | 26075010 | 25,72 km | ⚠️ > 25 km |
| Fraile | Palmira ICA | 26075010 | 15,67 km | |
| Guabas | ICA-Balboa | 26095110 | 19,99 km | |
| Guachal | Palmira ICA | 26075010 | 17,39 km | |
| Guadalajara | ICA-Balboa | 26095110 | 5,81 km | |
| La Paila | Cent Admo La Unión | 26115040 | 22,48 km | |
| Nima | Palmira ICA | 26075010 | 10,86 km | |
| Palo | Palmira ICA | 26075010 | 32,42 km | ⚠️ > 25 km |
| Riofrío | Aeropuerto Farfán | 26105160 | 8,74 km | |
| Risaralda | Aeropuerto Matecaña | 26135040 | 18,29 km | |
| Tuluá | Aeropuerto Farfán | 26105160 | 4,51 km | |
| Zabaletas | ICA-Balboa | 26095110 | 22,91 km | |

## Las dos asignaciones débiles (> 25 km)

- **Palo → Palmira ICA, 32,42 km.** Es el tributario más al sur del
  corredor (pour point en 3,259°N); Palmira ICA es la estación IDF más
  cercana de las 6 permitidas, pero sigue estando a más de 30 km. De las 6
  estaciones, ninguna está realmente cerca de Palo — habría que evaluar si
  conviene una estación IDF adicional al sur (fuera de las 6 validadas) para
  este tributario específicamente.
- **Desbaratado → Palmira ICA, 25,72 km.** Apenas cruza el umbral. Misma
  zona sur del corredor que Palo, un poco menos extrema.

Ambas comparten la misma causa: las 6 estaciones IDF validadas se
concentran en el centro-norte del corredor (Palmira hasta Pereira); no hay
ninguna en el extremo sur (zona Cali-Jamundí-Palo), que es donde caen estos
dos tributarios.

## Método

- **Distancia:** geodésica (haversine), línea recta — no distancia sobre el
  cauce ni sobre vías, igual que en el cruce anterior.
- **Pour points:** los 15 exactos de la tabla proporcionada, sin buscar
  alternativas en el dataset de calidad de agua.
- **Estaciones IDF:** únicamente las 6 de la tabla proporcionada. Ninguna
  otra estación IDF del dataset original de 13 participó en el cálculo.
