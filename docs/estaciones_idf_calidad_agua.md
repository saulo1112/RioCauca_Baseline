# Estaciones IDF → estación de calidad de agua más cercana

Cruce geográfico (distancia geodésica) entre las 13 estaciones IDEAM donde se
determinó un grupo de curvas IDF y el listado maestro de estaciones de
calidad del agua del proyecto (`docs/estaciones_calidad_agua.csv`, 98
estaciones: Río Cauca + 15 tributarios). Para cada estación IDF se buscó la
estación de calidad de agua más cercana en línea recta (fórmula de
haversine) y se reporta su río asociado.

**Tarea puramente investigativa — no se tocó el geovisor ni ningún dato del
proyecto.**

## Tabla

| Estación IDF | Código | Río asociado | Estación de calidad más cercana | Distancia | Confiabilidad |
|---|---|---|---|---|---|
| Cent Admo La Union | 26115040 | Río Cauca | La Victoria | 1,9 km | Alta |
| Aeropuerto Farfán | 26105160 | Río Tuluá | Puente Nuevo (Barrio 7 de Agosto) | 3,3 km | Alta |
| ICA-Balboa | 26095110 | Río Guadalajara | Puente Frente vía Férrea | 4,1 km | Alta |
| Palmira ICA | 26075010 | Río Bolo | Puente Bolo - San Isidro - vía a Candelaria | 6,4 km | Alta |
| Aeropuerto Matecaña | 26135040 | Río Cauca | La Virginia - Risaralda | 16,1 km | Media |
| Cumbarco | 26125130 | Río La Paila | Puente Paila arriba - vía a Sevilla | 23,5 km | Media |
| Veracruz | 26135110 | Río Cauca | La Virginia - Risaralda | 26,6 km | Media |
| Aeropuerto Guillermo León Valencia | 26035030 | Río Cauca | Antes Suárez | 56,6 km | Baja |
| Bajo Calima | 54075020 | Río Cauca | Vijes | 69,2 km | Baja |
| Paletara | 26015020 | Río Cauca | Antes Suárez | 87,7 km | Baja |
| Santa Leticia | 21055030 | Río Palo | Bocatoma corregimiento El Palo | 93,8 km | Baja |
| Misión La | 54075040 | Río Riofrío | Río Valcanes | 100,3 km | Baja |
| Mercaderes | 52025030 | Río Cauca | Antes Suárez | 142,0 km | Baja |

CSV completo (con coordenadas de ambas estaciones): `docs/estaciones_idf_calidad_agua.csv`.

## Cómo leer la columna "Confiabilidad"

La distancia importa — "más cercana" no siempre significa "asociada de
verdad". Las agrupé en 3 bandas:

- **Alta (< 10 km):** 4 estaciones. Estas sí caen dentro o junto al
  corredor de estudio; el emparejamiento es creíble como asociación real.
- **Media (10-30 km):** 3 estaciones. Todavía dentro de la región del
  proyecto, pero ya a una distancia donde el "más cercana" es una
  aproximación regional, no un punto prácticamente coincidente.
- **Baja (> 30 km):** 6 estaciones. Acá el emparejamiento pierde sentido
  físico. **Mercaderes, Paletara, Aeropuerto Guillermo León Valencia y Santa
  Leticia** están en el departamento del Cauca, al sur de Popayán —
  bien fuera del corredor Río Cauca (Antes Suárez → La Virginia) que cubre
  este proyecto, por eso las 3 primeras "empatan" con la misma estación
  límite sur del dataset (**Antes Suárez**, el extremo del corredor): no es
  que estén asociadas a ella, es que es el punto más cercano que existe en
  todo el listado. **Misión La** y **Bajo Calima** están del lado del
  Pacífico (Buenaventura), en la cuenca del río Calima/San Juan, no en la
  del Cauca — tampoco tienen una asociación real con ninguna estación de
  este proyecto.

En resumen: de las 13, solo 4-7 (según qué tan estricto se quiera ser) están
genuinamente dentro del área que cubre la red de calidad de agua del
proyecto. Las demás son estaciones IDEAM de zonas vecinas o completamente
distintas (Pacífico, sur del Cauca) que no tienen una estación de calidad de
agua real cerca dentro de este dataset — el "más cercana" reportado es
matemáticamente correcto pero no debe leerse como una asociación
hidrológica.

## Fuente y método

- **Estaciones IDF:** las 13 listadas en la solicitud, con código IDEAM y
  coordenadas (lon, lat) tal como se proporcionaron.
- **Estaciones de calidad de agua:** `docs/estaciones_calidad_agua.csv`
  (98 filas — 19 Río Cauca + 79 tributarios, ya excluye estaciones sin datos
  reales de calidad como GG1/GG2 del Guachal o SUP-241 del Cauca).
- **Distancia:** geodésica (haversine), línea recta — no distancia sobre el
  cauce ni sobre vías.
