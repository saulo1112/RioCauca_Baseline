# Longitud total vs. longitud en zona plana — 15 tributarios

Comparación entre la longitud total de cada tributario y su longitud dentro
de la zona plana (capa `Tributarios_ZP` de ArcGIS Pro), a partir de las dos
tablas de atributos que compartiste.

**Tarea puramente investigativa — no se tocó el geovisor ni ningún dato del
proyecto.**

## El hallazgo antes de la tabla — por qué las dos capas mostraban el mismo número

En tus dos capturas, la columna **"Longitud en kilometros"** trae el mismo
valor en ambas capas, río por río (Amaime 86,563 en las dos, Bugalagrande
99,798 en las dos, etc.). Verifiqué esos valores contra nuestro propio
`data/cartografia/Tributarios_rios_cauca.geojson` (campo `LONGITUD_KM`) y
**coinciden exactamente, uno a uno** — es el mismo dato de origen (la capa
completa, sin recortar).

Eso confirma lo que sospeché al verlas iguales: **"Longitud en kilometros"
es un campo calculado antes del recorte a zona plana, y no se volvió a
calcular después de recortar la geometría de `Tributarios_ZP`.** En cambio,
**`Shape_Length`** sí es un campo que ArcGIS recalcula automáticamente cada
vez que cambia la geometría — así que ese es el que refleja la longitud
real *dentro* de la zona plana, una vez recortada la línea.

Por eso la tabla de abajo usa:
- **Longitud total (km)** = "Longitud en kilometros" (= `LONGITUD_KM` de
  nuestra base, verificado idéntico en ambas capas).
- **Longitud en zona plana (km)** = `Shape_Length` de `Tributarios_ZP`,
  convertido de metros a km.

**Antes de dar esto por bueno**, confírmame que `Tributarios_ZP` es
efectivamente la línea ya recortada al polígono de zona plana (y no al
revés, que sea `Shape_Length` el campo desactualizado) — lo infiero de que
el patrón encaja perfectamente (Guachal, el único río sin tramo de montaña,
da 100,0 %; Bugalagrande, el más largo y con cabecera en la cordillera, da
el porcentaje más bajo), pero no tengo forma de verificar la geometría de
tu proyecto de ArcGIS directamente.

## Tabla — 15 tributarios, ordenados por % en zona plana

| Río | Longitud total (km) | Longitud en zona plana (km) | % en zona plana |
|---|---|---|---|
| Guachal | 11,02 | 11,02 | 100,0 % |
| Bolo | 48,15 | 41,08 | 85,3 % |
| La Paila | 66,73 | 56,12 | 84,1 % |
| Zabaletas | 43,49 | 31,04 | 71,4 % |
| Fraile | 80,85 | 56,04 | 69,3 % |
| Amaime | 86,56 | 50,69 | 58,6 % |
| Desbaratado | 65,56 | 37,60 | 57,4 % |
| Risaralda | 108,41 | 55,90 | 51,6 % |
| Guabas | 42,37 | 21,32 | 50,3 % |
| Guadalajara | 26,27 | 11,34 | 43,2 % |
| Riofrío | 43,85 | 18,25 | 41,6 % |
| Palo | 83,32 | 27,67 | 33,2 % |
| Nima | 39,69 | 12,62 | 31,8 % |
| Tuluá | 73,62 | 22,29 | 30,3 % |
| Bugalagrande | 99,80 | 29,55 | 29,6 % |

## Notas

- **Guachal en 100,0 %**: su longitud en zona plana coincide exactamente
  con su longitud total (11,017 km en ambos campos) — es decir, todo su
  cauce nace ya en terreno plano, sin tramo de montaña. Coincide con lo que
  ya sabíamos de este río en el resto del proyecto (100 % de cobertura de
  buffer, sin estaciones de montaña descartadas).
- **Rio Palmira y Rio Parraga** aparecen en tus dos capturas pero no forman
  parte de los 15 tributarios oficiales del proyecto (no tienen buffer ni
  corredor propio en el análisis), así que los dejé fuera de la tabla.
  Si los necesitas: Palmira — total 32,971 km, ZP 0,944 km (2,9 %); Parraga
  — total 46,023 km, ZP 3,967 km (8,6 %) — con la misma advertencia sobre
  el campo "Longitud en kilometros" desactualizado.
