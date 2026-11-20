# Carga observada del río Amaime antes y después de 2022 y referencia teórica de la caña

Proyecto 890K, Fase I. Análisis acotado a los ríos Amaime y Nima, solo con la información que ya está en el repositorio.

## Contenido

| Archivo | Descripción |
|---|---|
| `analisis_amaime_nima.xlsx` | Libro con fórmulas vivas. Hojas: Parámetros, Datos, Clasificación, Carga por estación, Incremento por subtramo, Comparación y Bitácora de exclusiones. |
| `analisis_amaime_nima.py` | Script reproducible. Construye el libro y, con `--verificar`, compara el libro recalculado con un cálculo independiente en pandas. |

```bash
python analisis_amaime_nima/analisis_amaime_nima.py              # construye el libro
# recalcular con LibreOffice (por ejemplo, recalc.py de la guía xlsx)
python analisis_amaime_nima/analisis_amaime_nima.py --verificar  # control contra pandas
```

LibreOffice recalcula las 8.362 fórmulas sin errores. El control coincide en los umbrales, en las 40 filas de carga por estación, en las 80 filas de incremento y en las estimaciones teóricas. Al cambiar los parámetros, el libro responde: con Amaime como estación prioritaria los umbrales pasan a 2,53 y 11,08 m³/s, y con N total cambian los encabezados y las cargas.

## Insumos

- **Calidad del agua** (`data/calidad_agua/csv_por_punto`, CVC).
  - Amaime: 5 estaciones y 19 campañas entre el 2016-07-07 y el 2025-10-08.
  - Por periodo (hasta 2021 / 2022 / desde 2023): Auji 11/2/2 (sin muestras después del 2023-10-10), Tablones 11/2/5, El Placer, Antes del Nima y Antes del Cauca 11/2/6.
  - Nima: 3 estaciones (Tenjo 10/2/5, Acueducto Nima 10/2/6, Antes del Amaime 10/2/6), en fechas distintas de las del Amaime.
  - El N-NO3 y el P total están en todas las campañas. El N total existe en una sola campaña por estación antes de 2022 (2017-04-05) y en casi todas desde 2022.
  - La columna "Caudal (l/s)" está vacía en todas las estaciones.
- **Caudal** (`data/hidrologia/tributarios`, CVC).
  - Amaime (km 44,6): del 2015-01-01 al 2023-05-15, 2.865 días.
  - Los Ceibos (km 32,4): del 2015 al 2026-03-26, 2.106 días. Es continua solo desde mediados de 2021.
  - Las dos estaciones coinciden en 931 días, con correlación de 0,11 (0,39 entre 2022 y 2023).
- **Caña por subtramo** (`data/fuentes/priorizacion/Priorizacion_NP_subtramos.csv`, Tabla 5.2): 708,2, 83,5 y 2.684,2 ha en el Amaime y 896,6 ha en el Nima. Tablones queda dentro del subtramo 1.

## Supuestos

1. **Serie de referencia.** Se usa el caudal medio diario de Los Ceibos y se completan sus huecos con Amaime: 4.040 días. Con permanencias del 70 % y del 30 % (interpolación de `perfil_longitudinal_calidad.py`) da exactamente 3,12 y 10,91 m³/s. El repositorio no traía esta serie compuesta. La regla de `estudios-prediccion` (Amaime primero) da 2,53 y 11,08 m³/s y queda como opción en Parámetros.
2. **Caudal de las estaciones de calidad.** Ninguna tiene caudal propio. La regla del repositorio (`build_monitoreo_corredor.py`) asigna la estación hidrométrica más cercana sobre el eje, pero no es aplicable aquí: cada estación hidrométrica cubre un solo periodo. Por eso las cinco estaciones toman el caudal de la serie de referencia el día de la campaña.
3. **Caudal inconsistente.** Si las dos estaciones hidrométricas tienen dato el mismo día y una supera a la otra más de 10 veces, la campaña queda sin carga y sin condición. Solo ocurre el 2021-08-19: Los Ceibos 0,03 m³/s y Amaime 21,30 m³/s.
4. **Filtros de calidad reutilizados.**
   - `to_num` lee S/D como vacío, y el límite de detección entra con su propio valor.
   - Se aplica el límite físico de N-NO3 de 15 mg/L, que no anula ningún registro.
   - No hay exclusiones manuales para estos ríos.
5. **Carga y factores.** La carga se calcula como kg/d = Q × C × 86,4. Los factores salen de las Tablas 4.6 a 4.8, con la dosis de 138 kg N/ha/año. No se filtran por fecha.
   - N: bajo 2,20, medio 7,176 y alto 18,3126 kg/ha/año.
   - P: bajo 0,60, medio 1,3758 y alto 2,0517 kg/ha/año.
   - Reproducen 5.082, 599, 19.262 y 6.434 kg N/año en el escenario medio.

## Hallazgos (N-NO3 como parámetro de nitrógeno, todas las condiciones)

Los incrementos observados son carga total de todas las fuentes. La comparación con la caña se lee solo como orden de magnitud.

| Subtramo | Incremento promedio hasta 2021 (kg/d, pares) | Incremento promedio desde 2023 (kg/d, pares) | Estimación teórica de la caña, N bajo / medio / alto (kg/d) |
|---|---|---|---|
| 1 (Auji → El Placer) | −138,9 (10; 7 negativos) | −1,7 (2) | 4,3 / 13,9 / 35,5 |
| 2 (El Placer → Antes del Nima) | −4,6 (10) | 5,8 (6) | 0,5 / 1,6 / 4,2 |
| 3 (Antes del Nima → Antes del Cauca) | 49,7 (10) | 55,5 (6) | 16,2 / 52,8 / 134,7 |
| 3 + Nima | igual que el 3 | igual que el 3 | 21,6 / 70,4 / 179,6 |

- **Subtramo 3.** Es el único con un incremento de N-NO3 positivo y estable. En los dos periodos queda en el mismo orden de magnitud que la estimación teórica media, tanto solo como sumando el Nima. Entre periodos no se aprecia un cambio de la carga observada.
- **Subtramo 1.** Los incrementos son negativos: Auji tiene el N-NO3 promedio más alto de la cuenca hasta 2021 (0,62 mg/L).
- **Subtramo 2.** Tiene tan poca caña que cualquier diferencia entre estaciones lo supera en uno o dos órdenes de magnitud.
- **Fósforo total.**
  - Subtramo 3: el incremento pasa de 50,1 kg/d hasta 2021 a −46,5 kg/d desde 2023 (3 de 6 pares negativos), frente a 10,1 kg/d teóricos (13,5 con el Nima).
  - Subtramo 2: de 5,7 a 52,8 kg/d, frente a 0,31 kg/d teóricos.
  - Subtramo 1: el incremento desde 2023 es nulo, porque los valores están en el límite de detección.
  - Los cambios dependen de pocas campañas, en especial la del 2025-04-23, con P total entre 0,79 y 1,18 mg/L.
- **Condición hidrológica.**
  - Hasta 2021 hay 10 campañas con caudal: 4 de verano, 4 de transición y 2 de invierno.
  - Desde 2023 hay 6: ninguna de verano, 4 de transición y 2 de invierno.
  - El caudal promedio de las campañas sube de 6,3 a 11,6 m³/s.
- **Nima.**
  - Antes del Amaime: N-NO3 promedio de 0,84 mg/L (10 campañas) hasta 2021 y de 1,97 mg/L (6) desde 2023; P total de 0,33 y 0,69 mg/L.
  - El valor de 2023 en adelante depende de la campaña del 2024-10-03: N-NO3 de 6,82 mg/L y N total de 7,87 mg/L.
  - En Tenjo y Acueducto, el promedio de N-NO3 hasta 2021 (1,36 y 1,31 mg/L) depende del 2017-08-24, con 9,54 y 8,67 mg/L.
  - Estimación teórica de la caña: 5,4 / 17,6 / 45,0 kg N/d y 1,5 / 3,4 / 5,0 kg P/d.
- **N total.** Tiene 1 par por subtramo hasta 2021, así que no sirve para comparar periodos (ver la hoja Carga por estación).

## Limitaciones

- **Un mismo caudal para las cinco estaciones.** Con un solo caudal por campaña, el incremento equivale a Q × ΔC × 86,4. No representa captaciones, retornos ni el aporte del Nima, que entra entre Antes del Nima y Antes del Cauca. El caudal real de Antes del Cauca es mayor que el de referencia, así que su carga, y el incremento del subtramo 3, quedan subestimados.
- **Cambio de estación hidrométrica entre periodos.** El periodo 1 usa el caudal de Amaime y el periodo 2 el de Los Ceibos. Entre 2022 y 2023 Amaime registró, en mediana, 1,31 veces el caudal de Los Ceibos. Parte de cualquier diferencia entre periodos puede venir de este cambio y no del río.
- **Datos erráticos en Los Ceibos.** En 2021 Los Ceibos tiene 123 días con 0,05 m³/s o menos, junto con crecientes de hasta 563 m³/s. Se conservan para reproducir los umbrales y solo afectan a la campaña excluida.
- **Pocas campañas.** Hay 10 y 6 pares por subtramo, y solo 2 en el subtramo 1 desde 2023. Los promedios por condición se apoyan en 0 a 4 pares.
- **Límites de detección.** Hay valores repetidos de P total (0,051 a 0,096 mg/L) y de N-NO3 (0,201 a 0,303 mg/L) que parecen límites de detección y cambian con el tiempo. Hay 22 casos de un mismo valor en 3 o más estaciones de una campaña. Entre esas estaciones el incremento es cero por construcción.
- **Escalas distintas.** La carga observada es instantánea, de una muestra diurna. La estimación teórica es una media anual. El factor de N representa nitrógeno total perdido, mientras que el N-NO3 es solo una fracción.
- **Sin atribución.** La carga observada integra todas las fuentes (vertimientos, otros usos del suelo, aguas subterráneas). No se atribuye a la caña ni a predios.
- **Nima.** No tiene estación de caudal: no se calcula su carga ni se clasifica por condición, y no se extrapola su caudal.
