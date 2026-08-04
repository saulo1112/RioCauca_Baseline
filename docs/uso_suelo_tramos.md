# Uso del suelo por tramo — tributarios del Río Cauca

**Proyecto 890K | UAO × ASOCAÑA | Fase I — Corredor Biológico**  
*Generado el 2026-08-04 por `tools/tramos/build_uso_suelo_tramos.mjs`*

Composición de coberturas dentro del buffer de 700 m, desagregada por los mismos tramos
del análisis de caña. **35 tramos en 13 ríos.**

Datos: [uso_suelo_tramos.csv](uso_suelo_tramos.csv) (agrupado) y
[uso_suelo_tramos_detalle.csv](uso_suelo_tramos_detalle.csv) (103 códigos de 25k).

## 1. Advertencias antes de usar estas cifras

**La capa no cubre todo el corredor.** Es cartografía de la CVC, así que se detiene en el
límite del Valle del Cauca:

| Río | Cobertura del buffer | Tratamiento |
|---|---|---|
| Risaralda | 0 % | **excluido** — dept. de Risaralda, jurisdicción CARDER |
| Palo | 1,5 % | **excluido** — dept. del Cauca, jurisdicción CRC |
| Rio Desbaratado | 49,8 % | **parcial** — los porcentajes describen solo la fracción con datos |

**La caña no sale de esta capa.** La columna `area_ha` de la clase CANA es exactamente la
`cana_ha_normalizada` de [tramos_cana_tributarios.csv](tramos_cana_tributarios.csv), es decir
`Hectareas_CZ.geojson`, que tiene resuelto el solapamiento entre buffers vecinos. La capa de
uso del suelo por sí sola sobrestima la caña frente a ella (por vigencia distinta y por no
descontar el solape), así que **no se usa su propio número de caña en ningún lado**: las
demás clases se reescalan proporcionalmente para que cada tramo cierre en 100 % con la caña
ya sustituida.

**La vigencia es heterogénea.** Cada cuenca se levantó en un año distinto, entre 2014 y
2025, así que la comparación entre ríos mezcla fechas.

**Es cobertura, no uso.** La capa no trae el campo `COD_USO25`; lo que aquí se agrupa como
«uso» es cobertura del suelo, que es la misma base desde la que la CVC infiere el uso.

## 2. Composición por río

| Río | Cobertura | CANA | CP | CSP | CT | CF | PN | MSC | CSD | BN | BP | RA | HN | HU | AGUA | TE | ZU | INF |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rio Amaime | 100 % | 75,3 | 0,4 | — | 0,9 | — | 4,5 | 0,4 | 0,3 | 7,7 | — | 3,8 | 0,2 | 0,0 | 3,0 | 0,1 | 2,2 | 1,3 |
| Rio Bolo | 100 % | 77,2 | 0,3 | 0,2 | 2,7 | — | 3,0 | 0,6 | — | 2,7 | — | 1,6 | — | — | 5,0 | 0,1 | 4,2 | 2,5 |
| Rio Bugalagrande | 100 % | 32,6 | 3,1 | — | 1,7 | — | 29,2 | 1,6 | 3,0 | 7,5 | — | 6,1 | 0,0 | 0,1 | 5,1 | 2,5 | 5,6 | 2,0 |
| Rio Desbaratado | 50 % | 76,7 | 3,4 | 1,4 | 0,6 | — | 2,1 | 1,4 | 0,1 | 4,8 | — | 2,1 | 0,0 | 0,2 | 2,4 | 0,1 | 2,7 | 1,9 |
| Rio Fraile | 100 % | 78,7 | 0,8 | — | 0,8 | — | 5,5 | 0,4 | 0,0 | 0,8 | 0,2 | 2,5 | — | 0,0 | 3,2 | 0,3 | 4,4 | 2,3 |
| Rio Guabas | 100 % | 67,1 | 3,7 | 0,0 | 5,2 | — | 5,1 | 2,9 | 0,0 | 4,1 | 0,1 | 3,6 | — | — | 3,2 | 0,2 | 1,4 | 3,4 |
| Rio Guachal | 100 % | 40,4 | — | — | 0,6 | — | 18,1 | 2,3 | 2,2 | 0,9 | 0,8 | 4,3 | — | 1,1 | 19,3 | 0,1 | 0,9 | 9,1 |
| Rio Guadalajara | 100 % | 17,8 | 0,2 | 0,1 | 0,3 | — | 24,9 | 0,5 | 0,7 | 5,1 | — | 12,7 | — | 1,3 | 4,1 | 0,2 | 23,4 | 8,6 |
| Rio La Paila | 100 % | 25,2 | 0,4 | 0,0 | 0,3 | — | 40,6 | 3,5 | 1,0 | 19,1 | — | 4,9 | 0,2 | 0,1 | 1,7 | 1,5 | 0,9 | 0,7 |
| Rio Nima | 100 % | 63,4 | 0,5 | — | 2,1 | — | 3,7 | 0,7 | 1,9 | 7,4 | — | 8,1 | — | 0,0 | 2,0 | 0,2 | 3,9 | 6,2 |
| Rio Riofrio | 100 % | 21,1 | 0,4 | — | 0,1 | 3,5 | 33,2 | 2,4 | 0,8 | 11,6 | — | 11,1 | 5,6 | 0,2 | 3,6 | 1,7 | 3,8 | 1,1 |
| Rio Tulua | 100 % | 21,9 | 3,5 | 0,3 | 2,4 | — | 20,4 | 0,8 | 0,4 | 9,0 | 0,0 | 8,2 | 0,0 | 1,1 | 3,6 | 2,1 | 20,5 | 5,7 |
| Rio Zabaletas | 100 % | 70,3 | 1,9 | 0,0 | 0,6 | — | 9,7 | 0,3 | 1,7 | 9,0 | — | 1,0 | — | — | 1,6 | 0,2 | 0,7 | 3,0 |

Códigos: **CANA** Caña de azúcar · **CP** Cultivos permanentes · **CSP** Cultivos semipermanentes · **CT** Cultivos transitorios · **CF** Café · **PN** Pastos · **MSC** Misceláneos de pastos / cultivos / espacios naturales · **CSD** Cultivos cosechados o suelo desnudo · **BN** Bosque natural · **BP** Bosque plantado · **RA** Rastrojo y vegetación secundaria · **HN** Herbazales y vegetación natural herbácea · **HU** Humedales y superficies pantanosas · **AGUA** Aguas continentales · **TE** Tierras eriales · **ZU** Zona urbana · **INF** Infraestructura.

## 3. Detalle por tramo

### Rio Amaime

**Tramo 1** — Despues Caserio Auji → Antes Caserio el Placer · km 0,0–43,9 · 953 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 708,20 | 74,3 |
| Cultivos permanentes | 7,52 | 0,8 |
| Cultivos transitorios | 27,88 | 2,9 |
| Pastos | 30,31 | 3,2 |
| Misceláneos de pastos / cultivos / espacios naturales | 13,76 | 1,4 |
| Cultivos cosechados o suelo desnudo | 3,27 | 0,3 |
| Bosque natural | 75,97 | 8,0 |
| Rastrojo y vegetación secundaria | 36,02 | 3,8 |
| Humedales y superficies pantanosas | 0,40 | 0,0 |
| Aguas continentales | 24,29 | 2,5 |
| Tierras eriales | 1,13 | 0,1 |
| Zona urbana | 7,87 | 0,8 |
| Infraestructura | 16,83 | 1,8 |

**Tramo 2** — Antes Caserio el Placer → Antes desembocadura de Rio Nima · km 43,9–46,1 · 253 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 83,49 | 33,0 |
| Cultivos permanentes | 3,18 | 1,3 |
| Cultivos transitorios | 12,03 | 4,8 |
| Pastos | 18,16 | 7,2 |
| Misceláneos de pastos / cultivos / espacios naturales | 1,17 | 0,5 |
| Cultivos cosechados o suelo desnudo | 7,90 | 3,1 |
| Bosque natural | 18,66 | 7,4 |
| Rastrojo y vegetación secundaria | 11,33 | 4,5 |
| Aguas continentales | 3,21 | 1,3 |
| Tierras eriales | 0,01 | 0,0 |
| Zona urbana | 88,89 | 35,1 |
| Infraestructura | 4,91 | 1,9 |

**Tramo 3** — Antes desembocadura de Rio Nima → antes Desembocadura a Rio Cauca · km 46,1–86,3 · 3.409 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 2.684,17 | 78,7 |
| Cultivos permanentes | 8,19 | 0,2 |
| Cultivos transitorios | 0,40 | 0,0 |
| Pastos | 159,31 | 4,7 |
| Misceláneos de pastos / cultivos / espacios naturales | 2,45 | 0,1 |
| Cultivos cosechados o suelo desnudo | 4,60 | 0,1 |
| Bosque natural | 263,03 | 7,7 |
| Rastrojo y vegetación secundaria | 127,78 | 3,7 |
| Herbazales y vegetación natural herbácea | 6,92 | 0,2 |
| Humedales y superficies pantanosas | 0,63 | 0,0 |
| Aguas continentales | 109,23 | 3,2 |
| Tierras eriales | 3,03 | 0,1 |
| Zona urbana | 3,37 | 0,1 |
| Infraestructura | 36,36 | 1,1 |

### Rio Bolo

**Tramo 1** — Limnígrafo CVC - Los Minchos → Puente Pradera - Palmira · km 0,0–10,9 · 491 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 295,62 | 60,3 |
| Pastos | 12,64 | 2,6 |
| Bosque natural | 1,47 | 0,3 |
| Rastrojo y vegetación secundaria | 23,79 | 4,8 |
| Aguas continentales | 19,27 | 3,9 |
| Zona urbana | 132,14 | 26,9 |
| Infraestructura | 5,71 | 1,2 |

**Tramo 2** — Puente Pradera - Palmira → Puente Bolo - San Isidro - vía a Candelaria · km 10,9–30,0 · 1.997 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 1.614,77 | 80,9 |
| Cultivos permanentes | 6,18 | 0,3 |
| Cultivos transitorios | 99,79 | 5,0 |
| Pastos | 34,82 | 1,7 |
| Misceláneos de pastos / cultivos / espacios naturales | 22,47 | 1,1 |
| Bosque natural | 100,65 | 5,0 |
| Rastrojo y vegetación secundaria | 24,20 | 1,2 |
| Aguas continentales | 46,44 | 2,3 |
| Tierras eriales | 2,53 | 0,1 |
| Zona urbana | 27,27 | 1,4 |
| Infraestructura | 17,88 | 0,9 |

**Tramo 3** — Puente Bolo - San Isidro - vía a Candelaria → Antes desembocadura a Frayle en puente Recta Cali - Palmira · km 30,0–48,0 · 2.426 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 1.884,46 | 77,7 |
| Cultivos permanentes | 10,82 | 0,4 |
| Cultivos semipermanentes | 7,38 | 0,3 |
| Cultivos transitorios | 31,41 | 1,3 |
| Pastos | 97,61 | 4,0 |
| Misceláneos de pastos / cultivos / espacios naturales | 9,34 | 0,4 |
| Bosque natural | 28,18 | 1,2 |
| Rastrojo y vegetación secundaria | 31,95 | 1,3 |
| Aguas continentales | 179,50 | 7,4 |
| Tierras eriales | 1,06 | 0,0 |
| Zona urbana | 47,27 | 1,9 |
| Infraestructura | 96,85 | 4,0 |

### Rio Bugalagrande

**Tramo 1** — Puente antes Caserio San Rafael. → Conciviles - Andalucía · km 0,0–81,6 · 1.518 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 80,47 | 5,3 |
| Cultivos permanentes | 86,18 | 5,7 |
| Cultivos transitorios | 0,21 | 0,0 |
| Pastos | 660,66 | 43,5 |
| Misceláneos de pastos / cultivos / espacios naturales | 49,82 | 3,3 |
| Cultivos cosechados o suelo desnudo | 85,51 | 5,6 |
| Bosque natural | 200,26 | 13,2 |
| Rastrojo y vegetación secundaria | 139,83 | 9,2 |
| Herbazales y vegetación natural herbácea | 1,21 | 0,1 |
| Humedales y superficies pantanosas | 2,71 | 0,2 |
| Aguas continentales | 95,58 | 6,3 |
| Tierras eriales | 96,30 | 6,3 |
| Zona urbana | 2,47 | 0,2 |
| Infraestructura | 17,06 | 1,1 |

**Tramo 2** — Conciviles - Andalucía → Puente Variante Bugalagrande · km 81,6–85,1 · 426 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 33,39 | 7,8 |
| Cultivos permanentes | 6,12 | 1,4 |
| Cultivos transitorios | 7,97 | 1,9 |
| Pastos | 215,01 | 50,5 |
| Misceláneos de pastos / cultivos / espacios naturales | 1,26 | 0,3 |
| Cultivos cosechados o suelo desnudo | 4,56 | 1,1 |
| Bosque natural | 44,18 | 10,4 |
| Rastrojo y vegetación secundaria | 42,41 | 10,0 |
| Aguas continentales | 18,74 | 4,4 |
| Tierras eriales | 2,28 | 0,5 |
| Zona urbana | 33,05 | 7,8 |
| Infraestructura | 16,93 | 4,0 |

**Tramo 3** — Puente Variante Bugalagrande → antes desembocadura a Río Cauca - Hacienda El Guayabo · km 85,1–99,4 · 1.988 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 1.168,72 | 58,8 |
| Cultivos permanentes | 30,66 | 1,5 |
| Cultivos transitorios | 58,95 | 3,0 |
| Pastos | 271,43 | 13,7 |
| Misceláneos de pastos / cultivos / espacios naturales | 11,71 | 0,6 |
| Cultivos cosechados o suelo desnudo | 26,79 | 1,3 |
| Bosque natural | 49,74 | 2,5 |
| Rastrojo y vegetación secundaria | 56,26 | 2,8 |
| Aguas continentales | 85,12 | 4,3 |
| Tierras eriales | 1,06 | 0,1 |
| Zona urbana | 183,98 | 9,3 |
| Infraestructura | 43,81 | 2,2 |

### Rio Desbaratado

> **Cobertura parcial (49,8 %).** Los porcentajes describen
> únicamente la parte del buffer con datos de la CVC.

**Tramo 1** — Antes de bocatoma cabecera Miranda → Antes de porcícola (Pte. Jordán) · km 0,0–40,9 · 1.352 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 450,63 | 70,0 |
| Cultivos permanentes | 32,87 | 5,1 |
| Cultivos semipermanentes | 24,00 | 3,7 |
| Cultivos transitorios | 6,14 | 1,0 |
| Pastos | 16,69 | 2,6 |
| Misceláneos de pastos / cultivos / espacios naturales | 14,23 | 2,2 |
| Cultivos cosechados o suelo desnudo | 3,11 | 0,5 |
| Bosque natural | 31,62 | 4,9 |
| Rastrojo y vegetación secundaria | 16,02 | 2,5 |
| Herbazales y vegetación natural herbácea | 0,24 | 0,0 |
| Humedales y superficies pantanosas | 3,24 | 0,5 |
| Aguas continentales | 13,62 | 2,1 |
| Zona urbana | 13,82 | 2,1 |
| Infraestructura | 17,59 | 2,7 |

**Tramo 2** — Antes de porcícola (Pte. Jordán) → Puente Ortigal · km 40,9–65,4 · 2.873 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 1.163,02 | 79,7 |
| Cultivos permanentes | 38,36 | 2,6 |
| Cultivos semipermanentes | 5,71 | 0,4 |
| Cultivos transitorios | 7,17 | 0,5 |
| Pastos | 27,26 | 1,9 |
| Misceláneos de pastos / cultivos / espacios naturales | 15,45 | 1,1 |
| Bosque natural | 68,72 | 4,7 |
| Rastrojo y vegetación secundaria | 29,17 | 2,0 |
| Aguas continentales | 36,97 | 2,5 |
| Tierras eriales | 3,00 | 0,2 |
| Zona urbana | 42,00 | 2,9 |
| Infraestructura | 23,32 | 1,6 |

### Rio Fraile

**Tramo 1** — Nacimiento El Pedregal → Puente Vía a Miranda · km 0,0–28,9 · 474 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 78,53 | 16,6 |
| Cultivos permanentes | 40,29 | 8,5 |
| Cultivos transitorios | 35,09 | 7,4 |
| Pastos | 111,65 | 23,5 |
| Misceláneos de pastos / cultivos / espacios naturales | 11,97 | 2,5 |
| Cultivos cosechados o suelo desnudo | 1,97 | 0,4 |
| Bosque natural | 24,76 | 5,2 |
| Bosque plantado | 14,52 | 3,1 |
| Rastrojo y vegetación secundaria | 21,52 | 4,5 |
| Aguas continentales | 10,16 | 2,1 |
| Tierras eriales | 2,56 | 0,5 |
| Zona urbana | 109,84 | 23,2 |
| Infraestructura | 11,35 | 2,4 |

**Tramo 2** — Puente Vía a Miranda → Limnigrafo CVC - caserio Brisas de Frayle · km 28,9–52,1 · 2.336 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 1.960,56 | 83,9 |
| Cultivos permanentes | 0,15 | 0,0 |
| Pastos | 115,45 | 4,9 |
| Bosque natural | 18,70 | 0,8 |
| Rastrojo y vegetación secundaria | 72,99 | 3,1 |
| Aguas continentales | 73,52 | 3,1 |
| Zona urbana | 64,28 | 2,8 |
| Infraestructura | 30,40 | 1,3 |

**Tramo 3** — Limnigrafo CVC - caserio Brisas de Frayle → Antes Desembocadura a rio Guachal Recta Cali Palmira · km 52,1–80,6 · 3.532 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 2.950,90 | 83,5 |
| Cultivos permanentes | 9,68 | 0,3 |
| Cultivos transitorios | 15,52 | 0,4 |
| Pastos | 121,98 | 3,5 |
| Misceláneos de pastos / cultivos / espacios naturales | 10,57 | 0,3 |
| Bosque natural | 9,31 | 0,3 |
| Rastrojo y vegetación secundaria | 62,01 | 1,8 |
| Humedales y superficies pantanosas | 2,89 | 0,1 |
| Aguas continentales | 121,05 | 3,4 |
| Tierras eriales | 17,87 | 0,5 |
| Zona urbana | 106,27 | 3,0 |
| Infraestructura | 103,89 | 2,9 |

### Rio Guabas

**Tramo 1** — Antes Mina La Victoria → Antes desembocadura a Río Cauca · km 0,0–42,2 · 2.720 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 1.825,85 | 67,1 |
| Cultivos permanentes | 99,56 | 3,7 |
| Cultivos semipermanentes | 0,78 | 0,0 |
| Cultivos transitorios | 141,47 | 5,2 |
| Pastos | 139,98 | 5,1 |
| Misceláneos de pastos / cultivos / espacios naturales | 77,62 | 2,9 |
| Cultivos cosechados o suelo desnudo | 1,18 | 0,0 |
| Bosque natural | 112,85 | 4,1 |
| Bosque plantado | 1,85 | 0,1 |
| Rastrojo y vegetación secundaria | 98,88 | 3,6 |
| Aguas continentales | 85,77 | 3,2 |
| Tierras eriales | 5,02 | 0,2 |
| Zona urbana | 37,52 | 1,4 |
| Infraestructura | 91,93 | 3,4 |

### Rio Guachal

**Tramo 1** — GG1 - Después Confluencia Ríos Fraile Y Bolo → GG2 - Puente vía Yumbo-Aeropuerto · km 0,0–6,0 · 882 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 441,40 | 50,0 |
| Cultivos transitorios | 9,80 | 1,1 |
| Pastos | 183,39 | 20,8 |
| Misceláneos de pastos / cultivos / espacios naturales | 22,40 | 2,5 |
| Bosque plantado | 10,62 | 1,2 |
| Rastrojo y vegetación secundaria | 18,80 | 2,1 |
| Aguas continentales | 169,26 | 19,2 |
| Zona urbana | 5,82 | 0,7 |
| Infraestructura | 20,68 | 2,3 |

**Tramo 2** — GG2 - Puente vía Yumbo-Aeropuerto → GG3 - Rio Guachal - Antes Desembocadura a Rio Cauca · km 6,0–11,0 · 739 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 213,34 | 28,9 |
| Pastos | 109,88 | 14,9 |
| Misceláneos de pastos / cultivos / espacios naturales | 14,35 | 1,9 |
| Cultivos cosechados o suelo desnudo | 35,27 | 4,8 |
| Bosque natural | 15,05 | 2,0 |
| Bosque plantado | 1,82 | 0,2 |
| Rastrojo y vegetación secundaria | 50,60 | 6,8 |
| Humedales y superficies pantanosas | 17,68 | 2,4 |
| Aguas continentales | 143,00 | 19,4 |
| Tierras eriales | 2,36 | 0,3 |
| Zona urbana | 8,91 | 1,2 |
| Infraestructura | 126,59 | 17,1 |

### Rio Guadalajara

**Tramo 1** — La Piscina - Vía a Alaska → Bocatoma Acueducto Buga · km 0,0–17,0 · 188 ha

| Grupo | ha | % |
|---|---|---|
| Cultivos permanentes | 0,28 | 0,2 |
| Pastos | 129,40 | 68,8 |
| Misceláneos de pastos / cultivos / espacios naturales | 2,28 | 1,2 |
| Bosque natural | 18,96 | 10,1 |
| Rastrojo y vegetación secundaria | 26,12 | 13,9 |
| Aguas continentales | 4,76 | 2,5 |
| Tierras eriales | 1,59 | 0,8 |
| Zona urbana | 3,78 | 2,0 |
| Infraestructura | 0,84 | 0,4 |

**Tramo 2** — Bocatoma Acueducto Buga → Puente Frente vía Ferrea · km 17,0–21,7 · 620 ha

| Grupo | ha | % |
|---|---|---|
| Pastos | 117,17 | 18,9 |
| Bosque natural | 30,33 | 4,9 |
| Rastrojo y vegetación secundaria | 139,52 | 22,5 |
| Aguas continentales | 11,49 | 1,9 |
| Tierras eriales | 1,15 | 0,2 |
| Zona urbana | 298,11 | 48,0 |
| Infraestructura | 22,65 | 3,7 |

**Tramo 3** — Puente Frente vía Ferrea → antes desembocadura a Rio Cauca (El Porvenir) · km 21,7–26,2 · 687 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 266,90 | 38,8 |
| Cultivos permanentes | 3,09 | 0,4 |
| Cultivos semipermanentes | 1,58 | 0,2 |
| Cultivos transitorios | 4,93 | 0,7 |
| Pastos | 125,94 | 18,3 |
| Misceláneos de pastos / cultivos / espacios naturales | 5,86 | 0,9 |
| Cultivos cosechados o suelo desnudo | 11,03 | 1,6 |
| Bosque natural | 26,87 | 3,9 |
| Rastrojo y vegetación secundaria | 24,28 | 3,5 |
| Humedales y superficies pantanosas | 19,83 | 2,9 |
| Aguas continentales | 44,36 | 6,5 |
| Tierras eriales | 0,10 | 0,0 |
| Zona urbana | 48,21 | 7,0 |
| Infraestructura | 104,45 | 15,2 |

### Rio La Paila

**Tramo 1** — Puente Paila arriba - vía a Sevilla → antes desembocadura del rio Totoro · km 0,0–38,3 · 2.629 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 54,21 | 2,1 |
| Cultivos permanentes | 11,50 | 0,4 |
| Cultivos semipermanentes | 1,66 | 0,1 |
| Cultivos transitorios | 16,18 | 0,6 |
| Pastos | 1.585,06 | 60,3 |
| Misceláneos de pastos / cultivos / espacios naturales | 164,61 | 6,3 |
| Cultivos cosechados o suelo desnudo | 46,76 | 1,8 |
| Bosque natural | 559,64 | 21,3 |
| Rastrojo y vegetación secundaria | 110,32 | 4,2 |
| Herbazales y vegetación natural herbácea | 0,81 | 0,0 |
| Aguas continentales | 2,66 | 0,1 |
| Tierras eriales | 66,42 | 2,5 |
| Zona urbana | 8,83 | 0,3 |

**Tramo 2** — antes desembocadura del rio Totoro → Planta Acuavalle · km 38,3–41,7 · 341 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 3,40 | 1,0 |
| Cultivos permanentes | 2,49 | 0,7 |
| Cultivos semipermanentes | 0,30 | 0,1 |
| Pastos | 186,20 | 54,6 |
| Misceláneos de pastos / cultivos / espacios naturales | 11,77 | 3,5 |
| Bosque natural | 84,99 | 24,9 |
| Rastrojo y vegetación secundaria | 41,19 | 12,1 |
| Tierras eriales | 10,01 | 2,9 |
| Infraestructura | 0,40 | 0,1 |

**Tramo 3** — Planta Acuavalle → Antes desembocadura a Rio Cauca · km 41,7–66,5 · 2.747 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 1.381,30 | 50,3 |
| Cultivos permanentes | 7,53 | 0,3 |
| Cultivos transitorios | 2,74 | 0,1 |
| Pastos | 548,67 | 20,0 |
| Misceláneos de pastos / cultivos / espacios naturales | 21,58 | 0,8 |
| Cultivos cosechados o suelo desnudo | 8,81 | 0,3 |
| Bosque natural | 449,28 | 16,4 |
| Rastrojo y vegetación secundaria | 126,10 | 4,6 |
| Herbazales y vegetación natural herbácea | 12,05 | 0,4 |
| Humedales y superficies pantanosas | 4,74 | 0,2 |
| Aguas continentales | 94,29 | 3,4 |
| Tierras eriales | 8,99 | 0,3 |
| Zona urbana | 42,19 | 1,5 |
| Infraestructura | 38,85 | 1,4 |

### Rio Nima

**Tramo 1** — Antes Caserio de tenjo → Antes desembocadura a rio Amaime · km 0,0–39,6 · 1.415 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 896,63 | 63,4 |
| Cultivos permanentes | 7,40 | 0,5 |
| Cultivos transitorios | 30,04 | 2,1 |
| Pastos | 52,46 | 3,7 |
| Misceláneos de pastos / cultivos / espacios naturales | 10,07 | 0,7 |
| Cultivos cosechados o suelo desnudo | 26,80 | 1,9 |
| Bosque natural | 104,04 | 7,4 |
| Rastrojo y vegetación secundaria | 114,34 | 8,1 |
| Humedales y superficies pantanosas | 0,61 | 0,0 |
| Aguas continentales | 27,83 | 2,0 |
| Tierras eriales | 2,49 | 0,2 |
| Zona urbana | 54,65 | 3,9 |
| Infraestructura | 87,86 | 6,2 |

### Rio Riofrio

**Tramo 1** — Rio Guayabal → puente despues Salonica - limnigrafo CVC · km 0,0–25,6 · 7 ha

| Grupo | ha | % |
|---|---|---|
| Café | 1,23 | 18,4 |
| Pastos | 3,56 | 53,2 |
| Bosque natural | 1,15 | 17,1 |
| Rastrojo y vegetación secundaria | 0,11 | 1,7 |
| Aguas continentales | 0,16 | 2,4 |
| Tierras eriales | 0,01 | 0,2 |
| Zona urbana | 0,47 | 7,0 |

**Tramo 2** — puente despues Salonica - limnigrafo CVC → Bocatoma Acueducto de Riofrio · km 25,6–33,2 · 930 ha

| Grupo | ha | % |
|---|---|---|
| Cultivos permanentes | 6,46 | 0,7 |
| Café | 82,26 | 8,8 |
| Pastos | 419,87 | 45,1 |
| Misceláneos de pastos / cultivos / espacios naturales | 46,52 | 5,0 |
| Cultivos cosechados o suelo desnudo | 20,11 | 2,2 |
| Bosque natural | 147,21 | 15,8 |
| Rastrojo y vegetación secundaria | 135,22 | 14,5 |
| Herbazales y vegetación natural herbácea | 41,53 | 4,5 |
| Aguas continentales | 16,31 | 1,8 |
| Tierras eriales | 5,19 | 0,6 |
| Zona urbana | 2,34 | 0,3 |
| Infraestructura | 6,91 | 0,7 |

**Tramo 3** — Bocatoma Acueducto de Riofrio → Antes Municipio Riofrio · km 33,2–38,1 · 632 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 119,01 | 18,8 |
| Cultivos permanentes | 2,38 | 0,4 |
| Cultivos transitorios | 1,86 | 0,3 |
| Pastos | 245,41 | 38,8 |
| Misceláneos de pastos / cultivos / espacios naturales | 0,58 | 0,1 |
| Bosque natural | 52,69 | 8,3 |
| Rastrojo y vegetación secundaria | 69,53 | 11,0 |
| Herbazales y vegetación natural herbácea | 87,44 | 13,8 |
| Aguas continentales | 14,37 | 2,3 |
| Tierras eriales | 24,41 | 3,9 |
| Zona urbana | 0,78 | 0,1 |
| Infraestructura | 13,78 | 2,2 |

**Tramo 4** — Antes Municipio Riofrio → Antes desembocadura a Río Cauca · km 38,1–43,7 · 822 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 385,76 | 46,9 |
| Pastos | 125,29 | 15,2 |
| Misceláneos de pastos / cultivos / espacios naturales | 9,90 | 1,2 |
| Bosque natural | 76,26 | 9,3 |
| Rastrojo y vegetación secundaria | 60,38 | 7,3 |
| Herbazales y vegetación natural herbácea | 4,11 | 0,5 |
| Humedales y superficies pantanosas | 3,78 | 0,5 |
| Aguas continentales | 54,27 | 6,6 |
| Tierras eriales | 9,91 | 1,2 |
| Zona urbana | 87,36 | 10,6 |
| Infraestructura | 5,28 | 0,6 |

### Rio Tulua

**Tramo 1** — Antes Jardin Botanico (limnigrafo CVC) → Puente Ferrocarril Barrio La Trinidad · km 0,0–61,5 · 1.370 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 60,19 | 4,4 |
| Cultivos permanentes | 30,22 | 2,2 |
| Cultivos transitorios | 10,80 | 0,8 |
| Pastos | 444,35 | 32,4 |
| Misceláneos de pastos / cultivos / espacios naturales | 1,94 | 0,1 |
| Cultivos cosechados o suelo desnudo | 0,79 | 0,1 |
| Bosque natural | 183,41 | 13,4 |
| Rastrojo y vegetación secundaria | 105,63 | 7,7 |
| Aguas continentales | 37,26 | 2,7 |
| Tierras eriales | 44,06 | 3,2 |
| Zona urbana | 347,59 | 25,4 |
| Infraestructura | 103,39 | 7,5 |

**Tramo 2** — Puente Ferrocarril Barrio La Trinidad → Puente Nuevo (Barrio 7 de Agosto) · km 61,5–62,7 · 166 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 0,10 | 0,1 |
| Cultivos transitorios | 1,40 | 0,8 |
| Pastos | 8,14 | 4,9 |
| Misceláneos de pastos / cultivos / espacios naturales | 0,67 | 0,4 |
| Bosque natural | 8,86 | 5,3 |
| Rastrojo y vegetación secundaria | 1,24 | 0,7 |
| Aguas continentales | 7,72 | 4,7 |
| Zona urbana | 126,48 | 76,3 |
| Infraestructura | 11,08 | 6,7 |

**Tramo 3** — Puente Nuevo (Barrio 7 de Agosto) → Despues Urbanizacion Maracaibo · km 62,7–64,0 · 166 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 0,01 | 0,0 |
| Cultivos permanentes | 8,14 | 4,9 |
| Cultivos semipermanentes | 1,82 | 1,1 |
| Cultivos transitorios | 1,55 | 0,9 |
| Pastos | 20,48 | 12,3 |
| Misceláneos de pastos / cultivos / espacios naturales | 4,76 | 2,9 |
| Cultivos cosechados o suelo desnudo | 0,40 | 0,2 |
| Bosque natural | 26,30 | 15,8 |
| Rastrojo y vegetación secundaria | 1,81 | 1,1 |
| Aguas continentales | 3,09 | 1,9 |
| Tierras eriales | 2,14 | 1,3 |
| Zona urbana | 82,48 | 49,6 |
| Infraestructura | 13,40 | 8,1 |

**Tramo 4** — Despues Urbanizacion Maracaibo → antes desembocadura a Río Cauca (vereda El Salto) · km 64,0–73,4 · 1.186 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 571,00 | 48,2 |
| Cultivos permanentes | 62,43 | 5,3 |
| Cultivos semipermanentes | 6,72 | 0,6 |
| Cultivos transitorios | 56,18 | 4,7 |
| Pastos | 114,89 | 9,7 |
| Misceláneos de pastos / cultivos / espacios naturales | 15,96 | 1,3 |
| Cultivos cosechados o suelo desnudo | 9,79 | 0,8 |
| Bosque natural | 42,50 | 3,6 |
| Bosque plantado | 0,81 | 0,1 |
| Rastrojo y vegetación secundaria | 129,49 | 10,9 |
| Herbazales y vegetación natural herbácea | 1,05 | 0,1 |
| Humedales y superficies pantanosas | 32,59 | 2,7 |
| Aguas continentales | 55,02 | 4,6 |
| Tierras eriales | 15,66 | 1,3 |
| Zona urbana | 34,15 | 2,9 |
| Infraestructura | 37,63 | 3,2 |

### Rio Zabaletas

**Tramo 1** — Antes caserío Los Medios → Cruce sector vía La Novillera · km 0,0–14,9 · 253 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 44,72 | 17,6 |
| Cultivos permanentes | 35,05 | 13,8 |
| Cultivos transitorios | 9,56 | 3,8 |
| Pastos | 111,15 | 43,9 |
| Cultivos cosechados o suelo desnudo | 0,51 | 0,2 |
| Bosque natural | 19,00 | 7,5 |
| Rastrojo y vegetación secundaria | 14,06 | 5,5 |
| Aguas continentales | 5,89 | 2,3 |
| Tierras eriales | 5,77 | 2,3 |
| Zona urbana | 1,01 | 0,4 |
| Infraestructura | 6,70 | 2,6 |

**Tramo 2** — Cruce sector vía La Novillera → Puente vía Santa Elena-Ginebra · km 14,9–20,1 · 591 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 342,85 | 58,1 |
| Cultivos permanentes | 31,51 | 5,3 |
| Cultivos semipermanentes | 1,45 | 0,2 |
| Cultivos transitorios | 0,69 | 0,1 |
| Pastos | 93,75 | 15,9 |
| Misceláneos de pastos / cultivos / espacios naturales | 3,90 | 0,7 |
| Bosque natural | 54,62 | 9,2 |
| Rastrojo y vegetación secundaria | 6,62 | 1,1 |
| Aguas continentales | 15,42 | 2,6 |
| Zona urbana | 6,11 | 1,0 |
| Infraestructura | 33,63 | 5,7 |

**Tramo 3** — Puente vía Santa Elena-Ginebra → Antes desembocadura a Rio Cauca · km 20,1–43,4 · 2.751 ha

| Grupo | ha | % |
|---|---|---|
| Caña de azúcar | 2.139,40 | 77,8 |
| Cultivos permanentes | 2,88 | 0,1 |
| Cultivos transitorios | 11,55 | 0,4 |
| Pastos | 145,04 | 5,3 |
| Misceláneos de pastos / cultivos / espacios naturales | 6,44 | 0,2 |
| Cultivos cosechados o suelo desnudo | 59,98 | 2,2 |
| Bosque natural | 249,33 | 9,1 |
| Rastrojo y vegetación secundaria | 16,69 | 0,6 |
| Aguas continentales | 35,74 | 1,3 |
| Zona urbana | 16,43 | 0,6 |
| Infraestructura | 67,68 | 2,5 |

---

## Fuentes

| Capa | Archivo |
|---|---|
| Cobertura y uso del suelo | `data/databases/Uso_del_suelo_ZP.geojson` (CVC, 1:25.000) |
| Buffer 700 m | `data/cartografia/Buffer_Zona_de_Estudio.geojson` |
| Caña (autoritativa) | `data/cartografia/Hectareas_CZ.geojson` |
| Cortes de tramo | `data/cortes_tramos.geojson` |

Clasificación según «GeoCVC — Guía rápida temática: Cobertura y uso del suelo, 2022»,
dominios `Dom_Cob_CLC_CVC_25k` y `Dom_Cob_Int_Grupo_UA`. La tabla código → grupo está en
`tools/tramos/clases_uso.mjs`.
