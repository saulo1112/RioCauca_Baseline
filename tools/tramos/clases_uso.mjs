/* clases_uso.mjs — Traducción de los códigos de cobertura de la CVC a grupos
 * legibles para el informe.
 *
 * La capa `Uso_del_suelo_ZP.geojson` trae 103 códigos `COD_COB25` distintos,
 * demasiados para una tabla. Aquí se agrupan en 17 clases siguiendo el modelo
 * «Grupo Uso Actual» de la CVC, con la caña separada por ser el objeto del
 * proyecto.
 *
 * Fuente de los nombres y de la jerarquía: «GeoCVC — Guía rápida temática:
 * Cobertura y uso del suelo, 2022», dominios Dom_Cob_CLC_CVC_25k (pp. 37–40) y
 * Dom_Cob_Int_Grupo_UA (p. 50).
 *
 * OJO: la capa NO trae campo de uso del suelo (`COD_USO25`), solo de cobertura.
 * Lo que aquí se llama «uso» es cobertura agrupada, que es como la propia CVC
 * infiere el uso (ver la Nota del submodelo 3 en la guía).
 */

/* ── Grupos ──────────────────────────────────────────────────────────── */

export const GRUPOS = {
  CANA: 'Caña de azúcar',
  CP:   'Cultivos permanentes',
  CSP:  'Cultivos semipermanentes',
  CT:   'Cultivos transitorios',
  CF:   'Café',
  PN:   'Pastos',
  /* Sin comas en los nombres: evita que el CSV tenga que entrecomillar. */
  MSC:  'Misceláneos de pastos / cultivos / espacios naturales',
  CSD:  'Cultivos cosechados o suelo desnudo',
  BN:   'Bosque natural',
  BP:   'Bosque plantado',
  RA:   'Rastrojo y vegetación secundaria',
  HN:   'Herbazales y vegetación natural herbácea',
  HU:   'Humedales y superficies pantanosas',
  AGUA: 'Aguas continentales',
  ZU:   'Zona urbana',
  INF:  'Infraestructura',
  MI:   'Minería',
  TE:   'Tierras eriales',
};

/* Orden de presentación en las tablas: primero lo agrícola, luego lo natural,
 * al final lo construido. */
export const ORDEN_GRUPOS = [
  'CANA', 'CP', 'CSP', 'CT', 'CF', 'PN', 'MSC', 'CSD',
  'BN', 'BP', 'RA', 'HN', 'HU', 'AGUA', 'TE', 'ZU', 'INF', 'MI',
];

/* ── COD_COB25 → [grupo, nombre de la clase] ─────────────────────────── */

export const CLASES = {
  /* 1xxxx — Superficies construidas */
  11111: ['ZU',   'Zonas urbanas continuas'],
  11211: ['ZU',   'Zonas urbanas discontinuas'],
  12111: ['INF',  'Otras superficies artificiales con construcción'],
  12211: ['INF',  'Otras superficies artificiales sin construcción'],

  /* 21xxx — Cultivos arbóreos plantados */
  21110: ['CP',   'Otros cultivos arbóreos plantados densos'],
  21111: ['BP',   'Teca'],
  21112: ['CP',   'Aguacate'],
  21113: ['CP',   'Guanábano'],
  21114: ['CP',   'Guayabo'],
  21115: ['CP',   'Zapote'],
  21116: ['CP',   'Mango'],
  21120: ['BP',   'Eucalipto'],
  21130: ['BP',   'Pino'],
  21131: ['BP',   'Pino cosechado'],
  21142: ['CF',   'Café-Otros arbóreos'],
  21210: ['CP',   'Otros cultivos arbóreos plantados abiertos'],
  21211: ['CP',   'Mirto'],
  21221: ['CP',   'Misceláneo de árboles frutales'],
  21230: ['CP',   'Misceláneo de cítricos'],
  21231: ['CP',   'Limón'],
  21232: ['CP',   'Naranjo'],

  /* 22xxx — Cultivos arbustivos plantados */
  22113: ['CSP',  'Plátano'],
  22122: ['CF',   'Café-Plátano'],
  22131: ['CP',   'Cacao'],
  22132: ['CP',   'Cacao-Otros cultivos'],
  22141: ['CSP',  'Papayo'],
  22151: ['CP',   'Vid'],
  22171: ['CANA', 'Caña de azúcar'],
  22172: ['CANA', 'Caña panelera'],
  22181: ['CT',   'Maíz'],
  22191: ['CT',   'Algodón'],
  22210: ['CP',   'Otros cultivos arbustivos plantados abiertos'],
  22212: ['CSP',  'Yuca'],

  /* 23xxx — Cultivos herbáceos plantados y pastos */
  23110: ['CT',   'Otros cultivos herbáceos plantados densos'],
  23111: ['CT',   'Ají'],
  23114: ['CT',   'Melón'],
  23115: ['CSP',  'Piña'],
  23119: ['CT',   'Tabaco'],
  23121: ['CT',   'Arroz'],
  23131: ['CT',   'Sorgo'],
  23141: ['CT',   'Soya'],
  23161: ['PN',   'Pasto de corte'],
  23162: ['PN',   'Pasto de corte arbolado'],
  23170: ['PN',   'Pasto cultivado'],
  23171: ['PN',   'Pasto cultivado arbolado'],
  23172: ['PN',   'Pasto cultivado enmalezado'],
  23216: ['CT',   'Pimentón'],
  23218: ['CT',   'Tomate'],
  23219: ['CT',   'Zapallo'],
  23221: ['CT',   'Habichuela'],
  23231: ['CSP',  'Maracuyá'],
  23241: ['CT',   'Frijol'],
  23251: ['CT',   'Pepino'],
  23312: ['PN',   'Pastos inundados'],
  23411: ['CT',   'Otros cultivos confinados'],
  23413: ['CT',   'Cultivos ornamentales en invernadero'],

  /* 24xxx — Misceláneos y asociaciones */
  24110: ['CT',   'Otras asociaciones de cultivos'],
  24111: ['CT',   'Hortalizas'],
  24112: ['CT',   'Tomate-Frijol'],
  24113: ['CT',   'Tomate-Habichuela'],
  24122: ['CP',   'Cítricos-Plátano'],
  24130: ['MSC',  'Misceláneo de pastos y cultivos'],
  24140: ['MSC',  'Misceláneo de cultivos y espacios naturales'],
  24150: ['MSC',  'Misceláneo de pastos y espacios naturales'],

  /* 25xxx — Áreas cultivadas sin o con poca vegetación */
  25210: ['CSD',  'Áreas de cultivo con suelo desnudo'],

  /* 31xxx — Bosques naturales */
  31111: ['BN',   'Bosque mixto denso alto de tierra firme'],
  31112: ['BN',   'Bosque mixto denso bajo de tierra firme'],
  31211: ['BN',   'Bosque mixto abierto alto de tierra firme'],
  31212: ['BN',   'Bosque mixto abierto bajo de tierra firme'],
  31311: ['BN',   'Bosque mixto fragmentado con pastos y cultivos'],
  31331: ['BN',   'Bosque mixto fragmentado con vegetación natural'],
  31351: ['BN',   'Bosque mixto relictual'],
  31352: ['BN',   'Bosque de guadua'],
  31411: ['BN',   'Otras palmeras naturales de tierra firme'],

  /* 32xxx — Arbustales y matorrales (rastrojo en el modelo interno CVC) */
  32110: ['RA',   'Arbustal y matorral denso alto de tierra firme'],
  32111: ['RA',   'Arbustal y matorral denso bajo de tierra firme'],
  32120: ['RA',   'Arbustal y matorral denso alto inundable'],
  32121: ['RA',   'Arbustal y matorral denso bajo inundable (caña brava)'],
  32210: ['RA',   'Arbustal y matorral abierto alto de tierra firme'],
  32211: ['RA',   'Arbustal y matorral abierto bajo de tierra firme'],
  32220: ['RA',   'Arbustal y matorral abierto alto inundable'],
  32221: ['RA',   'Arbustal y matorral abierto bajo inundable'],
  32231: ['RA',   'Arbustal y matorral abierto bajo esclerófilo'],
  32310: ['RA',   'Vegetación secundaria o transición'],

  /* 33xxx — Herbazales naturales */
  33121: ['HN',   'Herbazal natural denso inundable arbolado'],
  33130: ['HN',   'Helechal'],
  33220: ['HN',   'Herbazal natural abierto arenoso'],
  33230: ['HN',   'Herbazal natural abierto subxerofítico'],

  /* 35xxx — Áreas naturales abiertas sin o con poca vegetación */
  35210: ['TE',   'Áreas quemadas'],
  35221: ['TE',   'Áreas naturales desnudas'],

  /* 41xxx — Aguas continentales */
  41110: ['AGUA', 'Otros cuerpos de agua'],
  41120: ['AGUA', 'Ríos'],
  41130: ['AGUA', 'Lagunas'],
  41141: ['AGUA', 'Meandro abandonado'],
  41142: ['HU',   'Humedales y ciénagas'],
  41144: ['HU',   'Otras superficies pantanosas'],
  41220: ['AGUA', 'Estanques artificiales / reservorios'],
  41221: ['AGUA', 'Canal'],
  41310: ['HU',   'Superficies de inundación temporal'],
  41410: ['TE',   'Arenal'],
  41420: ['TE',   'Isla'],

  /* 42xxx — Códigos marítimos que aparecen en la capa continental.
   * Son 48 polígonos con códigos internos AREN e ISLA, idénticos a los de
   * 41410 y 41420: casi con seguridad un desliz de codificación en la fuente.
   * Se agrupan igual que sus equivalentes continentales. */
  42340: ['TE',   'Arenal (código marítimo en capa continental)'],
  42350: ['TE',   'Isla (código marítimo en capa continental)'],
};

/* Códigos internos (`COD_INT_CVC`) que corresponden a minería. Se usan para
 * separar la minería de la infraestructura dentro de las clases 12111 y 12211
 * («otras superficies artificiales»), que en el modelo de cobertura mezclan
 * canteras con vías y edificaciones. */
const MINEROS = new Set(['CN', 'OMIA', 'ORA', 'CBCA', 'CBS', 'SIL', 'MS', 'BX', 'ARC', 'CAL', 'OMIS', 'OR']);

/* Devuelve { grupo, clase } para un polígono. */
export function clasificar(props) {
  const cod = String(props.COD_COB25);
  const hit = CLASES[cod];
  if (!hit) return null;                       // el llamador debe abortar

  let [grupo, clase] = hit;
  if ((cod === '12111' || cod === '12211') && MINEROS.has(props.COD_INT_CVC)) {
    grupo = 'MI';
  }
  return { grupo, clase, cod };
}

/* Comprobación de arranque: que todos los códigos presentes tengan grupo. */
export function codigosSinMapear(features) {
  const faltan = new Map();
  for (const f of features) {
    const cod = String(f.properties.COD_COB25);
    if (!CLASES[cod]) faltan.set(cod, (faltan.get(cod) ?? 0) + 1);
  }
  return faltan;
}
