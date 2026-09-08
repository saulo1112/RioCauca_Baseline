# Paleta de colores por río (geovisor)

Desde esta actualización, el geovisor diferencia las estaciones por **forma**
(tipo de estación) y por **color** (río), replicando la simbología típica de
un proyecto SIG (ver captura de referencia en ArcGIS Pro):

- **● Círculo** = estación de calidad del agua
- **▲ Triángulo** (con halo blanco, igual que el borde blanco de los
  círculos) = estación hidrométrica

El color identifica el río en ambos tipos de estación — una misma paleta
compartida entre `puntos_calidad_tributarios.geojson` y
`estaciones_hidro_trib.json`, aplicada vía `src/layers/riverColors.js`.

## Por qué el color es un apoyo, no el único identificador

Se generó y validó la paleta con el método OKLab/CVD de la skill `dataviz`
(`node scripts/validate_palette.js --pairs all --mode light`, simulación de
protanopia/deuteranopia + techo de visión normal). La propia guía documenta
que, bajo la prueba estricta "todas las parejas" (la que aplica a un mapa,
donde cualquier par de puntos puede terminar uno junto al otro en pantalla),
un set de 8 matices ya solo garantiza distinción total en sus **primeros 3
slots** — pasado ese punto, la recomendación es recortar a menos categorías
o agrupar en "Otros".

Con 16 ríos tributarios reales que nombrar, esa opción no aplicaba. Se
optimizó (búsqueda voraz *maximin* + ajuste local en OKLab, bajo simulación
de daltonismo) para el mejor peor-caso alcanzable a 16 colores simultáneos:

```
node scripts/validate_palette.js \
  "#2a78d6,#6ec52a,#576d07,#00c7f5,#009c90,#864886,#4bc39f,#00a0f9,\
   #009a3f,#00b2c2,#0091c6,#8d2ead,#f24e73,#b4065f,#3153d3,#55ab00" \
  --mode light --pairs all
```

Resultado:

| Chequeo | Resultado |
|---|---|
| Banda de luminosidad (OKLCH L) | ✅ los 16 dentro de 0.43–0.77 |
| Piso de croma (OKLCH C ≥ 0.10) | ✅ los 16 |
| Separación CVD (peor pareja, protan/deutan) | ⚠️ ΔE 6.6 (zona de aviso 6–8, no la meta de 8) |
| Piso de visión normal (peor pareja) | ❌ ΔE 7.8 (bajo el piso de 15) |
| Contraste vs. fondo claro | ⚠️ 6 de 16 colores bajo 3:1 |

**Conclusión honesta:** a 16 categorías simultáneas, el color por sí solo no
alcanza el estándar de seguridad para daltonismo que sí es alcanzable con 3–8
categorías. Por eso, en el geovisor el color **nunca** es la única forma de
identificar un río — siempre va acompañado de:

1. La **etiqueta de texto** junto al punto (nombre de la estación/río),
   visible desde zoom 10–11.
2. El **nombre del río en el popup** al hacer clic.
3. La **leyenda del panel lateral**, que lista los 16 ríos con su color
   (generada dinámicamente desde `RIVER_COLORS` — ver
   `populateRiverLegend()` en `riverColors.js`, para que la leyenda nunca se
   desincronice de la paleta real).
4. La **forma** (círculo/triángulo), que ya distingue el tipo de estación
   independientemente del color.

## Paleta

| Río | Color |
|---|---|
| Amaime | `#2a78d6` |
| Bolo | `#6ec52a` |
| Bugalagrande | `#576d07` |
| Desbaratado | `#00c7f5` |
| Fraile | `#009c90` |
| Guabas | `#864886` |
| Guachal | `#4bc39f` |
| Guadalajara | `#00a0f9` |
| La Paila | `#009a3f` |
| Nima | `#00b2c2` |
| Palo | `#0091c6` |
| Parraga | `#8d2ead` |
| Riofrío | `#f24e73` |
| Risaralda | `#b4065f` |
| Sabaletas | `#3153d3` |
| Tuluá | `#55ab00` |

Río Cauca (capas `estaciones-cauca` / `estaciones-hidro`) no usa esta paleta:
al ser un solo río por capa, conserva sus colores fijos originales (naranja
`#FF6B35` para calidad, azul `#003F88` para hidrometría).

## Normalización de nombres

Las dos fuentes nombran los ríos de forma distinta ("Rio Amaime" con
prefijo vs. "Amaime" sin prefijo en el catálogo hidrométrico; "Rio Frayle"
vs. "Rio Fraile", dos grafías del mismo río). `normalizeRio()` en
`riverColors.js` resuelve ambas fuentes a la misma clave (sin tildes, sin
prefijo "rio ", con un alias para Frayle→Fraile) para que un río tenga el
mismo color en ambas capas.

## Si dos ríos vecinos en el mapa quedan visualmente muy parecidos

Es el costo esperado de intentar 16 categorías por color (ver tabla de
arriba). La forma más simple de mejorar un caso puntual es reasignar manos
qué color de `RIVER_COLORS` le toca a qué río en `riverColors.js` — dos
colores que chocan pero pertenecen a ríos geográficamente lejanos en el
mapa (p. ej. uno al norte cerca de Risaralda y otro al sur cerca de Cali)
no generan confusión real aunque el ΔE numérico sea bajo.
