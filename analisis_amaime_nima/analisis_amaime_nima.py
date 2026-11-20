# -*- coding: utf-8 -*-
"""analisis_amaime_nima.py — Carga observada del río Amaime antes y después de
2022 y contraste, como orden de magnitud, con la estimación teórica de la caña
(método de factores de emisión de la Fase 1). El Nima solo se describe con
concentraciones promedio.

Uso, desde la raíz del repositorio:

    python analisis_amaime_nima/analisis_amaime_nima.py            # construye el libro
    python analisis_amaime_nima/analisis_amaime_nima.py --verificar # compara el libro
                                                                     # recalculado con pandas

Insumos (solo lectura, ya presentes en el repositorio):
    data/calidad_agua/csv_por_punto/Rio_Amaime_*.csv, Rio_Nima_*.csv  (CVC, por estación)
    data/calidad_agua/puntos_calidad_tributarios.geojson              (punto → CSV)
    data/hidrologia/tributarios/{Los Ceibos,Amaime}/caudal_diario.csv (CVC, caudal diario)
    data/fuentes/priorizacion/Priorizacion_NP_subtramos.csv           (áreas y cargas de referencia)
    docs/tramos_cana_tributarios.csv                                  (estaciones límite de subtramo)

Lógica reutilizada del repositorio:
    - Lectura de valores: to_num() de scripts/build_calidad_trib.py (S/D → vacío, "<X" → X,
      el límite de detección entra con su propio valor).
    - Límite físico de N-NO3 de 15 mg/L: scripts/perfil_longitudinal_calidad.py.
    - Umbrales por permanencia 70 % / 30 % con interpolación lineal sobre la curva de duración
      (perm_i = i / n × 100 con la serie en orden descendente): perfil_longitudinal_calidad.py.
    - Clasificación: verano Q ≤ umbral de verano; invierno Q ≥ umbral de invierno; transición
      entre ambos.
    - Carga: kg/d = Q (m³/s) × C (mg/L) × 86,4 (build_monitoreo_corredor.py).
    - Factores de emisión: Informe Fase 1, Tablas 4.6 a 4.8 (dosis 138 kg N/ha/año).

Produce, en esta misma carpeta:
    analisis_amaime_nima.xlsx   (fórmulas vivas; se recalcula con LibreOffice)
"""

import argparse
import csv
import datetime as dt
import json
import math
import os
import sys
from collections import Counter, defaultdict

import numpy as np
import pandas as pd
from openpyxl import Workbook, load_workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

try:
    sys.stdout.reconfigure(encoding='utf-8')
except (AttributeError, ValueError):
    pass

AQUI = os.path.dirname(os.path.abspath(__file__))
PROYECTO = os.path.dirname(AQUI)
sys.path.insert(0, os.path.join(PROYECTO, 'scripts'))
from build_calidad_trib import to_num  # noqa: E402  — mismo criterio que estadisticas_puntos.csv


def ruta(*p):
    return os.path.join(PROYECTO, *p)


CSV_POR_PUNTO = ruta('data', 'calidad_agua', 'csv_por_punto')
PUNTOS_GEOJSON = ruta('data', 'calidad_agua', 'puntos_calidad_tributarios.geojson')
SERIES_DIR = ruta('data', 'hidrologia', 'tributarios')
PRIORIZACION_CSV = ruta('data', 'fuentes', 'priorizacion', 'Priorizacion_NP_subtramos.csv')
TRAMOS_CSV = ruta('docs', 'tramos_cana_tributarios.csv')
XLSX_OUT = os.path.join(AQUI, 'analisis_amaime_nima.xlsx')

# ── Parámetros por defecto (los mismos que la hoja Parámetros) ─────────
P = {
    'p1_nombre': 'Hasta 2021', 'p1_ini': 1990, 'p1_fin': 2021,
    'p2_nombre': 'Desde 2023', 'p2_ini': 2023, 'p2_fin': 2100,
    'perm_v': 70, 'perm_i': 30,
    'prioridad': 'Los Ceibos',
    'umbral_v_ref': 3.12, 'umbral_i_ref': 10.91,
    'cociente_max': 10, 'aplicar_excl': 'Sí',
    'param_n': 'N-NO3',
    'lim_no3': 15.0, 'lim_nt': None, 'lim_pt': None,
    'conv': 86.4,
    'dosis_n': 138.0, 'frac_n_medio': 0.052, 'frac_n_alto': 0.1327, 'f_n_bajo': 2.20,
    'dosis_p2o5': 46.0, 'conv_p2o5_p': 0.436, 'frac_p_medio': 0.0686, 'frac_p_alto': 0.1023,
    'f_p_bajo': 0.60,
    'dias': 365,
}
FACTORES_REF = {'N': (2.20, 7.176, 18.3126), 'P': (0.60, 1.3758, 2.0517)}  # valores del encargo
SIN_PERIODO = 'Fuera de periodo'
SIN_CLASIF = 'Sin clasificar'
CONDICIONES = ['Todas', 'Verano', 'Transición', 'Invierno']

AMAIME = [  # orden aguas abajo, nombre corto, punto de monitoreo de la CVC
    (1, 'Auji', 'Rio Amaime - Despues Caserio Auji'),
    (2, 'Tablones', 'Rio Amaime - Antes Caserio Tablones - Balneario Puerto Amor'),
    (3, 'El Placer', 'Rio Amaime - Antes Caserio el Placer'),
    (4, 'Antes del Nima', 'Rio Amaime - Antes desembocadura de Rio Nima'),
    (5, 'Antes del Cauca', 'Rio Amaime - antes Desembocadura a Rio Cauca'),
]
NIMA = [
    (1, 'Tenjo', 'Rio Nima - Antes Caserio de tenjo'),
    (2, 'Acueducto Nima', 'Rio Nima - Acueducto Nima'),
    (3, 'Antes del Amaime', 'Rio Nima - Antes desembocadura a rio Amaime'),
]
COL_NO3 = 'Nitratos (mg N-NO3/l)'
COL_NT = 'Nitrógeno Total (mg N/l)'
COL_PT = 'Fósforo Total (mg P/l)'

# Tramos de incremento: clave, estación aguas arriba, estación aguas abajo
TRAMOS = [
    ('Auji → Tablones', 'Auji', 'Tablones'),
    ('Tablones → El Placer', 'Tablones', 'El Placer'),
    ('Subtramo 1', 'Auji', 'El Placer'),
    ('Subtramo 2', 'El Placer', 'Antes del Nima'),
    ('Subtramo 3', 'Antes del Nima', 'Antes del Cauca'),
]
TRAMO_DESC = {
    'Auji → Tablones': 'Auji → Tablones (parcial del subtramo 1)',
    'Tablones → El Placer': 'Tablones → El Placer (parcial del subtramo 1)',
    'Subtramo 1': 'Subtramo 1 (Auji → El Placer)',
    'Subtramo 2': 'Subtramo 2 (El Placer → Antes del Nima)',
    'Subtramo 3': 'Subtramo 3 (Antes del Nima → Antes del Cauca)',
}

# ── Estilo del proyecto: dos colores, Arial, bordes finos negros ───────
AZUL_PETROLEO, AZUL_CLARO = '1F4E5F', 'DCE6EA'
F_BASE = Font(name='Arial', size=10)
F_BOLD = Font(name='Arial', size=10, bold=True)
F_TIT = Font(name='Arial', size=12, bold=True)
F_HDR = Font(name='Arial', size=10, bold=True, color='FFFFFF')
F_NOTA = Font(name='Arial', size=9, italic=True)
FILL_HDR = PatternFill('solid', fgColor=AZUL_PETROLEO)
FILL_IN = PatternFill('solid', fgColor=AZUL_CLARO)
_f = Side(style='thin', color='000000')
BORDE = Border(left=_f, right=_f, top=_f, bottom=_f)
WRAP = Alignment(wrap_text=True, vertical='top')
CENTRO = Alignment(horizontal='center', vertical='center', wrap_text=True)
FMT_Q, FMT_C, FMT_KG, FMT_KGA, FMT_R = '0.00', '0.000', '#,##0.0', '#,##0', '0.00'
FMT_FECHA = 'yyyy-mm-dd'


# ══════════════════════════════════════════════════════════════════════
# 1. Lectura de insumos
# ══════════════════════════════════════════════════════════════════════
def parse_fecha(s):
    s = str(s or '').strip()
    for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    raise ValueError(f'Fecha no reconocida: {s!r}')


def leer_calidad():
    with open(PUNTOS_GEOJSON, encoding='utf-8') as fh:
        csv_de = {f['properties']['Punto_Monitoreo']: f['properties']['csv_filename']
                  for f in json.load(fh)['features']}
    filas = []
    for rio, estaciones in (('Rio Amaime', AMAIME), ('Rio Nima', NIMA)):
        for orden, corto, punto in estaciones:
            with open(os.path.join(CSV_POR_PUNTO, csv_de[punto]), encoding='utf-8-sig', newline='') as fh:
                regs = list(csv.DictReader(fh))
            fechas = Counter(parse_fecha(r['Fecha Muestreo']) for r in regs)
            dup = [f for f, n in fechas.items() if n > 1]
            if dup:
                raise SystemExit(f'{punto}: fechas repetidas {dup}; definir criterio antes de seguir')
            for r in regs:
                filas.append({
                    'rio': rio, 'estacion': corto, 'orden': orden, 'punto': punto,
                    'fecha': parse_fecha(r['Fecha Muestreo']),
                    'no3': to_num(r.get(COL_NO3)), 'nt': to_num(r.get(COL_NT)),
                    'pt': to_num(r.get(COL_PT)),
                    'no3_txt': r.get(COL_NO3), 'nt_txt': r.get(COL_NT), 'pt_txt': r.get(COL_PT),
                })
    filas.sort(key=lambda f: (f['rio'] != 'Rio Amaime', f['orden'], f['fecha']))
    return filas


def leer_serie(nombre):
    s = pd.read_csv(os.path.join(SERIES_DIR, nombre, 'caudal_diario.csv'), parse_dates=['FECHA'])
    s = s.dropna(subset=['FECHA', 'CAUDAL_M3S'])
    if s['FECHA'].duplicated().any():
        raise SystemExit(f'{nombre}: fechas repetidas en la serie de caudal')
    return s.set_index('FECHA')['CAUDAL_M3S']


def leer_caudal():
    c = leer_serie('Los Ceibos').rename('ceibos')
    a = leer_serie('Amaime').rename('amaime')
    df = pd.concat([c, a], axis=1).sort_index()
    df.index = df.index.date
    return df


def leer_tramos():
    prior = {}
    with open(PRIORIZACION_CSV, encoding='utf-8-sig', newline='') as fh:
        for r in csv.DictReader(fh):
            if r['rio'] in ('Rio Amaime', 'Rio Nima'):
                prior[(r['rio'], int(r['tramo']))] = r
    limites = {}
    with open(TRAMOS_CSV, encoding='utf-8-sig', newline='') as fh:
        for r in csv.DictReader(fh):
            if r['rio'] in ('Rio Amaime', 'Rio Nima') and r['tramo'].isdigit():
                limites[(r['rio'], int(r['tramo']))] = (r['estacion_aguas_arriba'], r['estacion_aguas_abajo'])
    # Control: los subtramos del Amaime usan Auji, El Placer, Antes del Nima y Antes del Cauca
    esperado = {1: (AMAIME[0][2], AMAIME[2][2]), 2: (AMAIME[2][2], AMAIME[3][2]),
                3: (AMAIME[3][2], AMAIME[4][2])}
    for t, par in esperado.items():
        if limites[('Rio Amaime', t)] != par:
            raise SystemExit(f'Límites del subtramo {t} distintos de los esperados: {limites[("Rio Amaime", t)]}')
    return prior, limites


# ══════════════════════════════════════════════════════════════════════
# 2. Cálculo de control con pandas (mismos parámetros por defecto)
# ══════════════════════════════════════════════════════════════════════
def umbral_permanencia(q, perm):
    datos = np.sort(np.asarray(q, dtype=float))[::-1]
    p = np.arange(1, len(datos) + 1) / len(datos) * 100
    return float(np.interp(perm, p, datos))


def periodo(anio, prm=P):
    if prm['p1_ini'] <= anio <= prm['p1_fin']:
        return prm['p1_nombre']
    if prm['p2_ini'] <= anio <= prm['p2_fin']:
        return prm['p2_nombre']
    return SIN_PERIODO


def serie_referencia(caudal, prm=P):
    a, b = ('ceibos', 'amaime') if prm['prioridad'] == 'Los Ceibos' else ('amaime', 'ceibos')
    return caudal[a].fillna(caudal[b]).dropna()


def calcular(calidad, caudal, prm=P):
    ref = serie_referencia(caudal, prm)
    uv, ui = umbral_permanencia(ref, prm['perm_v']), umbral_permanencia(ref, prm['perm_i'])
    q = pd.DataFrame([f for f in calidad])
    q['anio'] = [f.year for f in q['fecha']]
    q['periodo'] = q['anio'].map(lambda y: periodo(y, prm))

    def valido(v, lim):
        return np.nan if v is None or (isinstance(v, float) and math.isnan(v)) or (lim is not None and v > lim) else v
    q['no3_v'] = [valido(v, prm['lim_no3']) for v in q['no3']]
    q['nt_v'] = [valido(v, prm['lim_nt']) for v in q['nt']]
    q['pt_v'] = [valido(v, prm['lim_pt']) for v in q['pt']]

    am = q[q['rio'] == 'Rio Amaime'].copy()
    camp = pd.DataFrame({'fecha': sorted(am['fecha'].unique())})
    camp['ceibos'] = camp['fecha'].map(caudal['ceibos'])
    camp['amaime'] = camp['fecha'].map(caudal['amaime'])
    camp['qref'] = camp['fecha'].map(ref)
    ambos = camp['ceibos'].notna() & camp['amaime'].notna()
    camp['cociente'] = np.where(ambos, camp[['ceibos', 'amaime']].max(axis=1)
                                / camp[['ceibos', 'amaime']].min(axis=1).clip(lower=1e-9), np.nan)
    camp['inconsistente'] = camp['cociente'] > prm['cociente_max']
    camp['qusado'] = np.where(camp['inconsistente'] & (prm['aplicar_excl'] == 'Sí'), np.nan, camp['qref'])
    camp['condicion'] = [SIN_CLASIF if pd.isna(x) else 'Verano' if x <= uv else 'Invierno' if x >= ui
                         else 'Transición' for x in camp['qusado']]
    camp['periodo'] = [periodo(f.year, prm) for f in camp['fecha']]

    am = am.merge(camp[['fecha', 'qusado', 'condicion']], on='fecha', how='left')
    cn = am['no3_v'] if prm['param_n'] == 'N-NO3' else am['nt_v']
    am['carga_n'] = am['qusado'] * cn * prm['conv']
    am['carga_p'] = am['qusado'] * am['pt_v'] * prm['conv']
    am['conc_n'] = cn

    # Incrementos pareados por fecha
    inc = {}
    for var in ('carga_n', 'carga_p'):
        piv = am.pivot(index='fecha', columns='estacion', values=var)
        d = pd.DataFrame(index=piv.index)
        for clave, up, dn in TRAMOS:
            d[clave] = piv.get(dn) - piv.get(up)
        d = d.join(camp.set_index('fecha')[['periodo', 'condicion']])
        inc[var] = d
    return {'uv': uv, 'ui': ui, 'ref': ref, 'camp': camp, 'am': am, 'inc': inc, 'q': q}


def resumen_carga(res, prm=P):
    am, out = res['am'], {}
    for _, est, _ in AMAIME:
        for per in (prm['p1_nombre'], prm['p2_nombre']):
            for cond in CONDICIONES:
                m = (am['estacion'] == est) & (am['periodo'] == per)
                m &= (am['condicion'] != SIN_CLASIF) if cond == 'Todas' else (am['condicion'] == cond)
                for var in ('carga_n', 'carga_p'):
                    v = am.loc[m, var].dropna()
                    out[(est, per, cond, var)] = (len(v), v.mean() if len(v) else None)
    return out


def resumen_incremento(res, prm=P):
    out = {}
    for var, d in res['inc'].items():
        for clave, _, _ in TRAMOS:
            for per in (prm['p1_nombre'], prm['p2_nombre']):
                for cond in CONDICIONES:
                    m = d['periodo'] == per
                    m &= (d['condicion'] != SIN_CLASIF) if cond == 'Todas' else (d['condicion'] == cond)
                    v = d.loc[m, clave].dropna()
                    out[(var, clave, per, cond)] = (len(v), v.mean() if len(v) else None, int((v < 0).sum()))
    return out


def factores(prm=P):
    n = (prm['f_n_bajo'], prm['dosis_n'] * prm['frac_n_medio'], prm['dosis_n'] * prm['frac_n_alto'])
    pp = prm['dosis_p2o5'] * prm['conv_p2o5_p']
    p = (prm['f_p_bajo'], pp * prm['frac_p_medio'], pp * prm['frac_p_alto'])
    return {'N': n, 'P': p}


# ══════════════════════════════════════════════════════════════════════
# 3. Utilidades de escritura
# ══════════════════════════════════════════════════════════════════════
def celda(ws, ref, valor=None, fmt=None, fill=None, font=None, align=None, borde=True):
    c = ws[ref]
    c.value = valor
    c.font = font or F_BASE
    if fmt:
        c.number_format = fmt
    if fill:
        c.fill = fill
    c.alignment = align or Alignment(vertical='top', wrap_text=isinstance(valor, str) and len(valor) > 40)
    if borde:
        c.border = BORDE
    return c


def encabezado(ws, fila, col, textos, alto=None):
    for i, t in enumerate(textos):
        c = ws.cell(row=fila, column=col + i, value=t)
        c.font, c.fill, c.alignment, c.border = F_HDR, FILL_HDR, CENTRO, BORDE
    if alto:
        ws.row_dimensions[fila].height = alto


def titulo(ws, texto, nota=None):
    ws['A1'].value, ws['A1'].font = texto, F_TIT
    if nota:
        ws['A2'].value, ws['A2'].font = nota, F_NOTA
        ws['A2'].alignment = Alignment(wrap_text=False, vertical='top')


def nota(ws, ref, texto):
    ws[ref].value, ws[ref].font = texto, F_NOTA
    ws[ref].alignment = Alignment(vertical='top')


def anchos(ws, dic):
    for col, w in dic.items():
        ws.column_dimensions[col].width = w


def nombre(wb, n, hoja, ref):
    abs_ref = '$' + ''.join(ch for ch in ref if ch.isalpha()) + '$' + ''.join(ch for ch in ref if ch.isdigit())
    wb.defined_names[n] = DefinedName(name=n, attr_text=f"'{hoja}'!{abs_ref}")


def L(c):
    return get_column_letter(c)


# ══════════════════════════════════════════════════════════════════════
# 4. Construcción del libro
# ══════════════════════════════════════════════════════════════════════
def construir(calidad, caudal, prior, limites, res):
    wb = Workbook()
    ws_p = wb.active
    ws_p.title = 'Parámetros'
    ws_d = wb.create_sheet('Datos')
    ws_c = wb.create_sheet('Clasificación')
    ws_l = wb.create_sheet('Carga por estación')
    ws_i = wb.create_sheet('Incremento por subtramo')
    ws_x = wb.create_sheet('Comparación')
    ws_b = wb.create_sheet('Bitácora de exclusiones')

    # ── Parámetros ────────────────────────────────────────────────────
    titulo(ws_p, 'Parámetros del análisis de carga observada — ríos Amaime y Nima',
           'Las celdas en azul claro son editables; el resto del libro se recalcula a partir de ellas. '
           'Proyecto 890K, Fase I.')
    encabezado(ws_p, 4, 1, ['Parámetro', 'Valor', 'Unidad', 'Fuente o nota'])
    fila = [5]

    def seccion(texto):
        r = fila[0]
        for col in 'ABCD':
            celda(ws_p, f'{col}{r}', texto if col == 'A' else None, font=F_BOLD, fill=FILL_IN if False else None)
        fila[0] += 1

    def prm(etiqueta, valor, unidad, fuente, nombre_def=None, fmt=None, editable=True):
        r = fila[0]
        celda(ws_p, f'A{r}', etiqueta)
        celda(ws_p, f'B{r}', valor, fmt=fmt, fill=FILL_IN if editable else None)
        celda(ws_p, f'C{r}', unidad)
        celda(ws_p, f'D{r}', fuente, align=WRAP)
        if nombre_def:
            nombre(wb, nombre_def, 'Parámetros', f'B{r}')
        fila[0] += 1
        return f'B{r}'

    seccion('Periodos de comparación de la carga observada')
    prm('Nombre del periodo 1', P['p1_nombre'], '—', 'Etiqueta usada en todas las hojas.', 'p_p1_nombre')
    prm('Año inicial del periodo 1', P['p1_ini'], 'año', 'Anterior al primer registro (2016): incluye toda la serie previa.', 'p_p1_ini', '0')
    prm('Año final del periodo 1', P['p1_fin'], 'año', 'Encargo: hasta 2021.', 'p_p1_fin', '0')
    prm('Nombre del periodo 2', P['p2_nombre'], '—', 'Etiqueta usada en todas las hojas.', 'p_p2_nombre')
    prm('Año inicial del periodo 2', P['p2_ini'], 'año', 'Encargo: desde 2023. El año 2022 queda fuera de ambos periodos.', 'p_p2_ini', '0')
    prm('Año final del periodo 2', P['p2_fin'], 'año', 'Posterior al último registro (2025).', 'p_p2_fin', '0')

    seccion('Condición hidrológica (curva de duración de la serie de referencia)')
    prm('Permanencia del umbral de verano', P['perm_v'], '%', 'perfil_longitudinal_calidad.py (PERM_VERANO).', 'p_perm_v', '0')
    prm('Permanencia del umbral de invierno', P['perm_i'], '%', 'perfil_longitudinal_calidad.py (PERM_INVIERNO).', 'p_perm_i', '0')
    r_prio = prm('Estación prioritaria de la serie de referencia', P['prioridad'], '—',
                 'Serie de referencia = caudal medio diario de la estación prioritaria; los días sin dato se '
                 'completan con la otra. Los Ceibos primero reproduce los umbrales de referencia (3,12 y 10,91 m³/s). '
                 'Amaime primero es la regla de estudios-prediccion/docs/preregistro.md.', 'p_prioridad')
    r_uvc = prm('Umbral de verano calculado', "='Clasificación'!C8", 'm³/s', 'Caudal con permanencia del 70 %; fórmula en Clasificación.', fmt=FMT_Q, editable=False)
    r_uvr = prm('Umbral de verano de referencia', P['umbral_v_ref'], 'm³/s', 'Valor del encargo, para verificación.', fmt=FMT_Q)
    prm('Verificación del umbral de verano', f'=IF(ROUND({r_uvc},2)=ROUND({r_uvr},2),"Coincide","Difiere")', '—', 'Comparación a dos decimales.', editable=False)
    r_uic = prm('Umbral de invierno calculado', "='Clasificación'!C11", 'm³/s', 'Caudal con permanencia del 30 %; fórmula en Clasificación.', fmt=FMT_Q, editable=False)
    r_uir = prm('Umbral de invierno de referencia', P['umbral_i_ref'], 'm³/s', 'Valor del encargo, para verificación.', fmt=FMT_Q)
    prm('Verificación del umbral de invierno', f'=IF(ROUND({r_uic},2)=ROUND({r_uir},2),"Coincide","Difiere")', '—', 'Comparación a dos decimales.', editable=False)
    prm('Cociente máximo admisible entre estaciones hidrométricas el mismo día', P['cociente_max'], 'veces',
        'Si Los Ceibos y Amaime tienen dato el día de la campaña y uno supera al otro en más de este '
        'cociente, el caudal de la campaña se considera inconsistente (criterio de este análisis).', 'p_cociente_max', '0')
    r_excl = prm('Excluir el caudal de las campañas inconsistentes', P['aplicar_excl'], '—',
                 'Sí: la campaña queda sin carga y sin condición. No: se usa la serie de referencia tal cual.', 'p_aplicar_excl')

    seccion('Calidad del agua y carga observada')
    r_param = prm('Parámetro de nitrógeno', P['param_n'], '—',
                  'N-NO3 (principal) o N total. En el Amaime el N total casi no existe antes de 2022: '
                  'ver la disponibilidad en Carga por estación.', 'p_param_n')
    prm('Límite físico de N-NO3', P['lim_no3'], 'mg/L', 'perfil_longitudinal_calidad.py (LIMITES_FISICOS). Valores mayores se anulan.', 'p_lim_no3', '0.0')
    prm('Límite físico de N total', P['lim_nt'], 'mg/L', 'Sin límite definido en el repositorio (vacío = sin límite).', 'p_lim_nt', '0.0')
    prm('Límite físico de P total', P['lim_pt'], 'mg/L', 'Sin límite definido en el repositorio (vacío = sin límite).', 'p_lim_pt', '0.0')
    prm('Conversión de carga', P['conv'], '(kg/d)/(m³/s·mg/L)', 'kg/d = Q × C × 86,4 (build_monitoreo_corredor.py, CONV_Q).', 'p_conv', '0.0')

    seccion('Factores de emisión de la caña (Informe Fase 1, Tablas 4.6 a 4.8); no dependen del periodo')
    r_dn = prm('Dosis de nitrógeno', P['dosis_n'], 'kg N/ha/año', 'Tabla 4.6 (versión del informe de 2026-10).', fmt='0.0')
    r_fnm = prm('Fracción de pérdida de N, escenario medio', P['frac_n_medio'], 'fracción', 'Tabla 4.7 (Scarpare et al., 2023).', fmt='0.00%')
    r_fna = prm('Fracción de pérdida de N, escenario alto', P['frac_n_alto'], 'fracción', 'Tabla 4.7 (Scarpare et al., 2023).', fmt='0.00%')
    r_fnb = prm('Factor de N, escenario bajo', P['f_n_bajo'], 'kg N/ha/año', 'Tabla 4.7 (Kwong et al., 2002); valor observado, no derivado de la dosis.', fmt='0.00')
    r_dp = prm('Dosis de P2O5', P['dosis_p2o5'], 'kg P2O5/ha/año', 'Tabla 4.6.', fmt='0.0')
    r_cp = prm('Conversión de P2O5 a P', P['conv_p2o5_p'], 'fracción', 'Tabla 4.6 (2 × 30,97 / 141,94).', fmt='0.000')
    r_fpm = prm('Fracción de pérdida de P, escenario medio', P['frac_p_medio'], 'fracción', 'Tabla 4.8 (Jeong et al., 2011).', fmt='0.00%')
    r_fpa = prm('Fracción de pérdida de P, escenario alto', P['frac_p_alto'], 'fracción', 'Tabla 4.8 (Jeong et al., 2011).', fmt='0.00%')
    r_fpb = prm('Factor de P, escenario bajo', P['f_p_bajo'], 'kg P/ha/año', 'Tabla 4.8 (Kwong et al., 2002); valor observado.', fmt='0.00')
    prm('Días por año', P['dias'], 'd', 'Conversión de kg/año a kg/d.', 'p_dias', '0')

    fila[0] += 1
    r0 = fila[0]
    encabezado(ws_p, r0, 1, ['Factor de emisión (kg/ha/año)', 'Bajo', 'Medio', 'Alto'])
    filas_f = [
        ('Nitrógeno (calculado)', f'={r_fnb}', f'={r_dn}*{r_fnm}', f'={r_dn}*{r_fna}'),
        ('Fósforo (calculado)', f'={r_fpb}', f'={r_dp}*{r_cp}*{r_fpm}', f'={r_dp}*{r_cp}*{r_fpa}'),
        ('Nitrógeno (referencia del encargo)', *FACTORES_REF['N']),
        ('Fósforo (referencia del encargo)', *FACTORES_REF['P']),
    ]
    for k, (et, b, m, a) in enumerate(filas_f):
        r = r0 + 1 + k
        celda(ws_p, f'A{r}', et)
        for col, v in zip('BCD', (b, m, a)):
            celda(ws_p, f'{col}{r}', v, fmt='0.0000', fill=FILL_IN if k >= 2 else None)
    for k, et in enumerate(('Verificación nitrógeno (4 decimales)', 'Verificación fósforo (4 decimales)')):
        r = r0 + 5 + k
        celda(ws_p, f'A{r}', et)
        for col in 'BCD':
            celda(ws_p, f'{col}{r}', f'=IF(ROUND({col}{r0 + 1 + k},4)=ROUND({col}{r0 + 3 + k},4),"Coincide","Difiere")')
    for k, esc in enumerate(('bajo', 'medio', 'alto')):
        col = 'BCD'[k]
        nombre(wb, f'p_fN_{esc}', 'Parámetros', f'{col}{r0 + 1}')
        nombre(wb, f'p_fP_{esc}', 'Parámetros', f'{col}{r0 + 2}')
    fila[0] = r0 + 8

    seccion('Áreas de caña por subtramo (caña normalizada)')
    areas = {
        'S1': (prior[('Rio Amaime', 1)], 'Subtramo 1 del Amaime (Auji → El Placer; Tablones queda dentro)'),
        'S2': (prior[('Rio Amaime', 2)], 'Subtramo 2 del Amaime (El Placer → Antes del Nima)'),
        'S3': (prior[('Rio Amaime', 3)], 'Subtramo 3 del Amaime (Antes del Nima → Antes del Cauca)'),
        'Nima': (prior[('Rio Nima', 1)], 'Río Nima (Tenjo → Antes del Amaime); desemboca en el subtramo 3'),
    }
    for clave, (r, et) in areas.items():
        prm(et, float(r['area_cana_tabla_ha']), 'ha',
            'data/fuentes/priorizacion/Priorizacion_NP_subtramos.csv (Informe Fase 1, Tabla 5.2).',
            f'p_area_{clave}', '#,##0.0')
    anchos(ws_p, {'A': 58, 'B': 16, 'C': 18, 'D': 90})
    for r_ in (r_prio, r_excl):
        dv = DataValidation(type='list', formula1='"Los Ceibos,Amaime"' if r_ == r_prio else '"Sí,No"', allow_blank=False)
        ws_p.add_data_validation(dv)
        dv.add(r_)
    dv = DataValidation(type='list', formula1='"N-NO3,N total"', allow_blank=False)
    ws_p.add_data_validation(dv)
    dv.add(r_param)
    ws_p.freeze_panes = 'A5'

    # ── Datos ─────────────────────────────────────────────────────────
    titulo(ws_d, 'Datos de entrada: calidad del agua por campaña y caudal medio diario',
           'Valores tal como los reporta la CVC (S/D queda vacío; el límite de detección entra con su propio valor). '
           'Columnas K a M y R: fórmulas.')
    encabezado(ws_d, 4, 1, ['Río', 'Estación', 'Orden aguas abajo', 'Punto de monitoreo (CVC)', 'Fecha de campaña',
                            'Año', 'Periodo', 'N-NO3 reportado (mg/L)', 'N total reportado (mg/L)',
                            'P total reportado (mg/L)', 'N-NO3 válido (mg/L)', 'N total válido (mg/L)',
                            'P total válido (mg/L)'], alto=42)
    n_cal = len(calidad)
    R0 = 5
    R1 = R0 + n_cal - 1
    for k, f in enumerate(calidad):
        r = R0 + k
        celda(ws_d, f'A{r}', f['rio'])
        celda(ws_d, f'B{r}', f['estacion'])
        celda(ws_d, f'C{r}', f['orden'], fmt='0')
        celda(ws_d, f'D{r}', f['punto'])
        celda(ws_d, f'E{r}', f['fecha'], fmt=FMT_FECHA)
        celda(ws_d, f'F{r}', f'=YEAR(E{r})', fmt='0')
        celda(ws_d, f'G{r}', f'=IF(AND(F{r}>=p_p1_ini,F{r}<=p_p1_fin),p_p1_nombre,'
                             f'IF(AND(F{r}>=p_p2_ini,F{r}<=p_p2_fin),p_p2_nombre,"{SIN_PERIODO}"))')
        for col, key in (('H', 'no3'), ('I', 'nt'), ('J', 'pt')):
            celda(ws_d, f'{col}{r}', f[key], fmt=FMT_C, fill=FILL_IN)
        for col, src, lim in (('K', 'H', 'p_lim_no3'), ('L', 'I', 'p_lim_nt'), ('M', 'J', 'p_lim_pt')):
            celda(ws_d, f'{col}{r}', f'=IF(NOT(ISNUMBER({src}{r})),"",IF(AND(ISNUMBER({lim}),{src}{r}>{lim}),"",{src}{r}))', fmt=FMT_C)
    filas_amaime = [R0 + k for k, f in enumerate(calidad) if f['rio'] == 'Rio Amaime']

    encabezado(ws_d, 4, 15, ['Fecha', 'Caudal medio diario Los Ceibos (m³/s)', 'Caudal medio diario Amaime (m³/s)',
                             'Caudal de referencia (m³/s)'], alto=42)
    Q0 = 5
    Q1 = Q0 + len(caudal) - 1
    for k, (fecha, row) in enumerate(caudal.iterrows()):
        r = Q0 + k
        celda(ws_d, f'O{r}', fecha, fmt=FMT_FECHA)
        celda(ws_d, f'P{r}', None if pd.isna(row['ceibos']) else float(row['ceibos']), fmt=FMT_Q, fill=FILL_IN)
        celda(ws_d, f'Q{r}', None if pd.isna(row['amaime']) else float(row['amaime']), fmt=FMT_Q, fill=FILL_IN)
        celda(ws_d, f'R{r}', f'=IF(p_prioridad="Los Ceibos",IF(ISNUMBER(P{r}),P{r},IF(ISNUMBER(Q{r}),Q{r},"")),'
                             f'IF(ISNUMBER(Q{r}),Q{r},IF(ISNUMBER(P{r}),P{r},"")))', fmt=FMT_Q)
    nota(ws_d, 'O3', 'Fuente: data/hidrologia/tributarios/{Los Ceibos,Amaime}/caudal_diario.csv (CVC).')
    nota(ws_d, 'D3', 'Fuente: data/calidad_agua/csv_por_punto (CVC, Calidad_agua_completo_v12.xlsx).')
    anchos(ws_d, {'A': 12, 'B': 16, 'C': 9, 'D': 52, 'E': 12, 'F': 7, 'G': 15, 'H': 11, 'I': 11, 'J': 11,
                  'K': 11, 'L': 11, 'M': 11, 'N': 3, 'O': 12, 'P': 15, 'Q': 15, 'R': 15})
    ws_d.freeze_panes = 'A5'

    rng = lambda col, a=R0, b=R1: f"Datos!${col}${a}:${col}${b}"  # noqa: E731
    qrng = lambda col: f"Datos!${col}${Q0}:${col}${Q1}"  # noqa: E731

    # ── Clasificación ─────────────────────────────────────────────────
    titulo(ws_c, 'Clasificación hidrológica de las campañas del río Amaime',
           'Umbrales por permanencia sobre la serie de referencia (interpolación lineal, perm = i/n × 100 en orden '
           'descendente). Verano Q ≤ umbral de verano; invierno Q ≥ umbral de invierno; transición entre ambos.')
    encabezado(ws_c, 4, 1, ['Cálculo de umbrales', 'Fórmula', 'Valor'])
    qr = qrng('R')
    filas_u = [
        ('Días con caudal de referencia', 'COUNT', f'=COUNT({qr})', '#,##0'),
        ('Permanencia de verano (%)', 'Parámetros', '=p_perm_v', '0'),
        ('Posición k de verano', 'n × permanencia / 100', '=C6/100*C5', '0.00'),
        ('Umbral de verano (m³/s)', 'interpolación entre k y k+1', None, FMT_Q),
        ('Permanencia de invierno (%)', 'Parámetros', '=p_perm_i', '0'),
        ('Posición k de invierno', 'n × permanencia / 100', '=C9/100*C5', '0.00'),
        ('Umbral de invierno (m³/s)', 'interpolación entre k y k+1', None, FMT_Q),
        ('Primera fecha de la serie de referencia', 'MIN', f'=MIN({qrng("O")})', FMT_FECHA),
        ('Última fecha de la serie de referencia', 'MAX', f'=MAX({qrng("O")})', FMT_FECHA),
    ]
    for k, (et, fx, v, fmt) in enumerate(filas_u):
        r = 5 + k
        celda(ws_c, f'A{r}', et)
        celda(ws_c, f'B{r}', fx)
        celda(ws_c, f'C{r}', v, fmt=fmt)
    for r, kref in ((8, 'C7'), (11, 'C10')):
        ws_c[f'C{r}'].value = (f'=LARGE({qr},INT({kref}))+({kref}-INT({kref}))*'
                               f'(LARGE({qr},MIN(INT({kref})+1,$C$5))-LARGE({qr},INT({kref})))')
    nombre(wb, 'p_umbral_v', 'Clasificación', 'C8')
    nombre(wb, 'p_umbral_i', 'Clasificación', 'C11')

    fechas_am = sorted({f['fecha'] for f in calidad if f['rio'] == 'Rio Amaime'})
    C0 = 17
    C1 = C0 + len(fechas_am) - 1
    encabezado(ws_c, 16, 1, ['Fecha de campaña', 'Año', 'Periodo', 'Caudal medio diario Los Ceibos (m³/s)',
                             'Caudal medio diario Amaime (m³/s)', 'Caudal de referencia (m³/s)',
                             'Estación de origen del caudal', 'Cociente entre estaciones (mismo día)',
                             'Caudal inconsistente', 'Caudal usado (m³/s)', 'Condición hidrológica',
                             'Estaciones de calidad con muestra'], alto=54)

    def buscar(col_val, fecha_ref):
        idx = f'MATCH({fecha_ref},{qrng("O")},0)'
        return (f'=IFERROR(IF(ISNUMBER(INDEX({qrng(col_val)},{idx})),INDEX({qrng(col_val)},{idx}),""),"")')
    for k, fecha in enumerate(fechas_am):
        r = C0 + k
        celda(ws_c, f'A{r}', fecha, fmt=FMT_FECHA, fill=FILL_IN)
        celda(ws_c, f'B{r}', f'=YEAR(A{r})', fmt='0')
        celda(ws_c, f'C{r}', f'=IF(AND(B{r}>=p_p1_ini,B{r}<=p_p1_fin),p_p1_nombre,'
                             f'IF(AND(B{r}>=p_p2_ini,B{r}<=p_p2_fin),p_p2_nombre,"{SIN_PERIODO}"))')
        celda(ws_c, f'D{r}', buscar('P', f'A{r}'), fmt=FMT_Q)
        celda(ws_c, f'E{r}', buscar('Q', f'A{r}'), fmt=FMT_Q)
        celda(ws_c, f'F{r}', buscar('R', f'A{r}'), fmt=FMT_Q)
        celda(ws_c, f'G{r}', f'=IF(NOT(ISNUMBER(F{r})),"Sin dato",IF(p_prioridad="Los Ceibos",'
                             f'IF(ISNUMBER(D{r}),"Los Ceibos","Amaime"),IF(ISNUMBER(E{r}),"Amaime","Los Ceibos")))')
        celda(ws_c, f'H{r}', f'=IF(AND(ISNUMBER(D{r}),ISNUMBER(E{r})),MAX(D{r},E{r})/MAX(MIN(D{r},E{r}),0.000000001),"")', fmt='#,##0.0')
        celda(ws_c, f'I{r}', f'=IF(AND(ISNUMBER(H{r}),H{r}>p_cociente_max),"Sí","No")')
        celda(ws_c, f'J{r}', f'=IF(AND(I{r}="Sí",p_aplicar_excl="Sí"),"",F{r})', fmt=FMT_Q)
        celda(ws_c, f'K{r}', f'=IF(NOT(ISNUMBER(J{r})),"{SIN_CLASIF}",IF(J{r}<=p_umbral_v,"Verano",'
                             f'IF(J{r}>=p_umbral_i,"Invierno","Transición")))')
        celda(ws_c, f'L{r}', f'=COUNTIFS({rng("A")},"Rio Amaime",{rng("E")},A{r})', fmt='0')
    nota(ws_c, f'A{C1 + 2}', 'Las campañas de 2022 se conservan a la vista, pero no entran en ningún periodo. '
                             'El Nima no se clasifica: no tiene estación de caudal.')

    # Resumen de campañas por periodo y condición
    encabezado(ws_c, 16, 14, ['Periodo', 'Verano', 'Transición', 'Invierno', 'Sin clasificar', 'Total',
                              'Caudal de Los Ceibos', 'Caudal de Amaime'], alto=54)
    for k, per in enumerate(('=p_p1_nombre', '=p_p2_nombre', SIN_PERIODO)):
        r = 17 + k
        celda(ws_c, f'N{r}', per)
        for col, cond in zip('OPQR', ('Verano', 'Transición', 'Invierno', SIN_CLASIF)):
            celda(ws_c, f'{col}{r}', f'=COUNTIFS($C${C0}:$C${C1},$N{r},$K${C0}:$K${C1},"{cond}")', fmt='0')
        celda(ws_c, f'S{r}', f'=COUNTIFS($C${C0}:$C${C1},$N{r})', fmt='0')
        celda(ws_c, f'T{r}', f'=COUNTIFS($C${C0}:$C${C1},$N{r},$G${C0}:$G${C1},"Los Ceibos",$J${C0}:$J${C1},">=0")', fmt='0')
        celda(ws_c, f'U{r}', f'=COUNTIFS($C${C0}:$C${C1},$N{r},$G${C0}:$G${C1},"Amaime",$J${C0}:$J${C1},">=0")', fmt='0')
    nota(ws_c, 'N21', 'Las dos últimas columnas cuentan campañas con caudal usado según la estación que lo aporta: '
                      'el periodo 1 depende de Amaime y el periodo 2 de Los Ceibos.')
    anchos(ws_c, {'A': 36, 'B': 26, 'C': 16, 'D': 14, 'E': 14, 'F': 14, 'G': 14, 'H': 14, 'I': 13, 'J': 12,
                  'K': 14, 'L': 13, 'M': 3, 'N': 16, 'O': 10, 'P': 11, 'Q': 10, 'R': 11, 'S': 8, 'T': 12, 'U': 12})
    ws_c.freeze_panes = 'A17'

    # ── Carga por estación ────────────────────────────────────────────
    titulo(ws_l, 'Carga observada por estación — río Amaime (kg/d = Q × C × 86,4)',
           'Carga total de todas las fuentes que pasan por la estación, no carga de la caña. Q = caudal medio diario '
           'de la serie de referencia el día de la campaña, igual para las cinco estaciones.')
    encabezado(ws_l, 4, 1, ['Estación', 'Orden aguas abajo', 'Fecha de campaña', 'Periodo', 'Condición hidrológica',
                            'Caudal medio diario de la campaña (m³/s)', '="Concentración de "&p_param_n&" de la muestra (mg/L)"',
                            'Concentración de P total de la muestra (mg/L)', '="Carga observada de "&p_param_n&" (kg/d)"',
                            'Carga observada de P total (kg/d)', 'Con carga de N (1/0)', 'Con carga de P (1/0)'], alto=66)
    L0 = 5
    L1 = L0 + len(filas_amaime) - 1
    cref = f"'Clasificación'!$A${C0}:$A${C1}"
    for k, rd in enumerate(filas_amaime):
        r = L0 + k
        celda(ws_l, f'A{r}', f'=Datos!B{rd}')
        celda(ws_l, f'B{r}', f'=Datos!C{rd}', fmt='0')
        celda(ws_l, f'C{r}', f'=Datos!E{rd}', fmt=FMT_FECHA)
        celda(ws_l, f'D{r}', f'=Datos!G{rd}')
        celda(ws_l, f'E{r}', f"=IFERROR(INDEX('Clasificación'!$K${C0}:$K${C1},MATCH(C{r},{cref},0)),\"{SIN_CLASIF}\")")
        idx = f'MATCH(C{r},{cref},0)'
        celda(ws_l, f'F{r}', f"=IFERROR(IF(ISNUMBER(INDEX('Clasificación'!$J${C0}:$J${C1},{idx})),"
                             f"INDEX('Clasificación'!$J${C0}:$J${C1},{idx}),\"\"),\"\")", fmt=FMT_Q)
        celda(ws_l, f'G{r}', f'=IF(p_param_n="N-NO3",Datos!K{rd},Datos!L{rd})', fmt=FMT_C)
        celda(ws_l, f'H{r}', f'=Datos!M{rd}', fmt=FMT_C)
        celda(ws_l, f'I{r}', f'=IF(AND(ISNUMBER(F{r}),ISNUMBER(G{r})),F{r}*G{r}*p_conv,"")', fmt=FMT_KG)
        celda(ws_l, f'J{r}', f'=IF(AND(ISNUMBER(F{r}),ISNUMBER(H{r})),F{r}*H{r}*p_conv,"")', fmt=FMT_KG)
        celda(ws_l, f'K{r}', f'=IF(ISNUMBER(I{r}),1,0)', fmt='0')
        celda(ws_l, f'M{r}', None, borde=False)
        celda(ws_l, f'L{r}', f'=IF(ISNUMBER(J{r}),1,0)', fmt='0')
    lr = lambda col: f'${col}${L0}:${col}${L1}'  # noqa: E731

    encabezado(ws_l, 4, 14, ['Estación', 'Periodo', 'Condición hidrológica', 'Campañas con carga de N',
                             '="Carga observada promedio de "&p_param_n&" (kg/d)"',
                             '="Concentración promedio de "&p_param_n&" (mg/L)"',
                             'Caudal promedio de las campañas con carga de N (m³/s)', 'Campañas con carga de P total',
                             'Carga observada promedio de P total (kg/d)', 'Concentración promedio de P total (mg/L)',
                             'Caudal promedio de las campañas con carga de P (m³/s)'], alto=80)
    S0 = 5
    r = S0
    filas_resumen_carga = {}
    for _, est, _ in AMAIME:
        for per_ref in ('=p_p1_nombre', '=p_p2_nombre'):
            for cond in CONDICIONES:
                celda(ws_l, f'N{r}', est)
                celda(ws_l, f'O{r}', per_ref)
                celda(ws_l, f'P{r}', cond)
                crit = f'IF($P{r}="Todas","<>{SIN_CLASIF}",$P{r})'
                base = f'{lr("A")},$N{r},{lr("D")},$O{r},{lr("E")},{crit}'
                celda(ws_l, f'Q{r}', f'=SUMIFS({lr("K")},{base})', fmt='0')
                celda(ws_l, f'R{r}', f'=IF(Q{r}>0,SUMIFS({lr("I")},{base})/Q{r},"")', fmt=FMT_KG)
                celda(ws_l, f'S{r}', f'=IF(Q{r}>0,SUMIFS({lr("G")},{base},{lr("K")},1)/Q{r},"")', fmt=FMT_C)
                celda(ws_l, f'T{r}', f'=IF(Q{r}>0,SUMIFS({lr("F")},{base},{lr("K")},1)/Q{r},"")', fmt=FMT_Q)
                celda(ws_l, f'U{r}', f'=SUMIFS({lr("L")},{base})', fmt='0')
                celda(ws_l, f'V{r}', f'=IF(U{r}>0,SUMIFS({lr("J")},{base})/U{r},"")', fmt=FMT_KG)
                celda(ws_l, f'W{r}', f'=IF(U{r}>0,SUMIFS({lr("H")},{base},{lr("L")},1)/U{r},"")', fmt=FMT_C)
                celda(ws_l, f'X{r}', f'=IF(U{r}>0,SUMIFS({lr("F")},{base},{lr("L")},1)/U{r},"")', fmt=FMT_Q)
                filas_resumen_carga[(est, per_ref, cond)] = r
                r += 1
    # Disponibilidad de registros por periodo
    D0 = r + 2
    celda(ws_l, f'N{D0 - 1}', 'Disponibilidad de registros por estación y periodo (río Amaime)', font=F_BOLD, borde=False)
    encabezado(ws_l, D0, 14, ['Estación', 'Periodo', 'Campañas', 'Registros de N-NO3', 'Registros de N total',
                              'Registros de P total', 'Fecha de la primera campaña', 'Fecha de la última campaña'], alto=40)
    r = D0 + 1
    for _, est, _ in AMAIME:
        for per_ref in ('=p_p1_nombre', '=p_p2_nombre', SIN_PERIODO):
            celda(ws_l, f'N{r}', est)
            celda(ws_l, f'O{r}', per_ref)
            base = f'{rng("A")},"Rio Amaime",{rng("B")},$N{r},{rng("G")},$O{r}'
            celda(ws_l, f'P{r}', f'=COUNTIFS({base})', fmt='0')
            celda(ws_l, f'Q{r}', f'=COUNTIFS({base},{rng("H")},">=0")', fmt='0')
            celda(ws_l, f'R{r}', f'=COUNTIFS({base},{rng("I")},">=0")', fmt='0')
            celda(ws_l, f'S{r}', f'=COUNTIFS({base},{rng("J")},">=0")', fmt='0')
            celda(ws_l, f'T{r}', f'=IF(P{r}>0,_xlfn.MINIFS({rng("E")},{base}),"")', fmt=FMT_FECHA)
            celda(ws_l, f'U{r}', f'=IF(P{r}>0,_xlfn.MAXIFS({rng("E")},{base}),"")', fmt=FMT_FECHA)
            r += 1
    anchos(ws_l, {'A': 16, 'B': 9, 'C': 12, 'D': 15, 'E': 14, 'F': 14, 'G': 15, 'H': 15, 'I': 14, 'J': 14,
                  'K': 9, 'L': 9, 'M': 3, 'N': 16, 'O': 15, 'P': 14, 'Q': 12, 'R': 14, 'S': 14, 'T': 14,
                  'U': 12, 'V': 14, 'W': 14, 'X': 14})
    ws_l.freeze_panes = 'A5'

    # ── Incremento por subtramo ───────────────────────────────────────
    titulo(ws_i, 'Incremento de carga observada entre estaciones consecutivas, pareado por fecha — río Amaime',
           'Incremento = carga aguas abajo − carga aguas arriba, solo en fechas con muestra en ambas estaciones. '
           'Los incrementos negativos se conservan y se marcan.')
    tramo_col = {'Auji → Tablones': 'I', 'Tablones → El Placer': 'J', 'Subtramo 1': 'K',
                 'Subtramo 2': 'L', 'Subtramo 3': 'M'}
    est_col = {'Auji': 'D', 'Tablones': 'E', 'El Placer': 'F', 'Antes del Nima': 'G', 'Antes del Cauca': 'H'}
    bloques = {}
    inicio = 4
    for var, colcarga, colflag, etiqueta in (('N', 'I', 'K', '="Carga observada de "&p_param_n'),
                                             ('P', 'J', 'L', 'Carga observada de P total')):
        celda(ws_i, f'A{inicio}', etiqueta, font=F_BOLD, borde=False)
        h = inicio + 1
        encabezado(ws_i, h, 1, ['Fecha de campaña', 'Periodo', 'Condición hidrológica']
                   + [f'Carga {e} (kg/d)' for e in est_col]
                   + [f'Incremento {TRAMO_DESC[t]} (kg/d)' for t in tramo_col] + ['Incrementos negativos'], alto=80)
        a0 = h + 1
        a1 = a0 + len(fechas_am) - 1
        for k in range(len(fechas_am)):
            r = a0 + k
            cr = C0 + k
            celda(ws_i, f'A{r}', f"='Clasificación'!A{cr}", fmt=FMT_FECHA)
            celda(ws_i, f'B{r}', f"='Clasificación'!C{cr}")
            celda(ws_i, f'C{r}', f"='Clasificación'!K{cr}")
            for est, col in est_col.items():
                cond = f"'Carga por estación'!{lr('A')},\"{est}\",'Carga por estación'!{lr('C')},$A{r}"
                celda(ws_i, f'{col}{r}',
                      f"=IF(SUMIFS('Carga por estación'!{lr(colflag)},{cond})=1,"
                      f"SUMIFS('Carga por estación'!{lr(colcarga)},{cond}),\"\")", fmt=FMT_KG)
            for clave, up, dn in TRAMOS:
                cu, cd, ct = est_col[up], est_col[dn], tramo_col[clave]
                celda(ws_i, f'{ct}{r}', f'=IF(AND(ISNUMBER({cd}{r}),ISNUMBER({cu}{r})),{cd}{r}-{cu}{r},"")', fmt=FMT_KG)
            partes = [f'IF(AND(ISNUMBER({tramo_col[t]}{r}),{tramo_col[t]}{r}<0),"{t}; ","")' for t in tramo_col]
            celda(ws_i, f'N{r}', '=' + '&'.join(partes))
        bloques[var] = (a0, a1)
        inicio = a1 + 3

    # Resumen por tramo, periodo y condición
    encabezado(ws_i, 5, 16, ['Variable', 'Tramo', 'Periodo', 'Condición hidrológica', 'Pares de campañas',
                             'Incremento observado promedio (kg/d)', 'Pares con incremento negativo', 'Marca'], alto=80)
    r = 6
    filas_resumen_inc = {}
    for var in ('N', 'P'):
        a0, a1 = bloques[var]
        for clave in tramo_col:
            for per_ref in ('=p_p1_nombre', '=p_p2_nombre'):
                for cond in CONDICIONES:
                    ct = tramo_col[clave]
                    celda(ws_i, f'P{r}', '=p_param_n' if var == 'N' else 'P total')
                    celda(ws_i, f'Q{r}', clave)
                    celda(ws_i, f'R{r}', per_ref)
                    celda(ws_i, f'S{r}', cond)
                    crit = f'IF($S{r}="Todas","<>{SIN_CLASIF}",$S{r})'
                    base = f'$B${a0}:$B${a1},$R{r},$C${a0}:$C${a1},{crit}'
                    celda(ws_i, f'T{r}', f'=COUNTIFS(${ct}${a0}:${ct}${a1},">=-1E+300",{base})', fmt='0')
                    celda(ws_i, f'U{r}', f'=IF(T{r}>0,SUMIFS(${ct}${a0}:${ct}${a1},{base})/T{r},"")', fmt=FMT_KG)
                    celda(ws_i, f'V{r}', f'=COUNTIFS(${ct}${a0}:${ct}${a1},"<0",{base})', fmt='0')
                    celda(ws_i, f'W{r}', f'=IF(AND(ISNUMBER(U{r}),U{r}<0),"Promedio negativo",'
                                         f'IF(V{r}>0,"Incluye pares negativos",""))')
                    filas_resumen_inc[(var, clave, per_ref, cond)] = r
                    r += 1
    inc_fin = r - 1
    anchos(ws_i, {'A': 12, 'B': 15, 'C': 14, 'D': 12, 'E': 12, 'F': 12, 'G': 12, 'H': 12, 'I': 15, 'J': 15,
                  'K': 15, 'L': 15, 'M': 16, 'N': 30, 'O': 3, 'P': 11, 'Q': 20, 'R': 14, 'S': 14, 'T': 10,
                  'U': 15, 'V': 12, 'W': 22})
    ws_i.freeze_panes = 'D6'

    # ── Comparación ───────────────────────────────────────────────────
    titulo(ws_x, 'Comparación, como orden de magnitud, entre el incremento observado y la estimación teórica de la caña',
           'El incremento observado es carga total de todas las fuentes; la estimación teórica de la caña es una carga media '
           'anual por subtramo (kg/año ÷ 365). El cociente indica orden de magnitud, no atribución.')
    encabezado(ws_x, 4, 1, ['Unidad', 'Área de caña (ha)',
                            'Estimación teórica de la caña, N bajo (kg/año)', 'N medio (kg/año)', 'N alto (kg/año)',
                            'N bajo (kg/d)', 'N medio (kg/d)', 'N alto (kg/d)',
                            'Estimación teórica de la caña, P bajo (kg/año)', 'P medio (kg/año)', 'P alto (kg/año)',
                            'P bajo (kg/d)', 'P medio (kg/d)', 'P alto (kg/d)',
                            'Referencia N medio (kg/año)', 'Verificación N medio', 'Referencia P medio (kg/año)',
                            'Verificación P medio'], alto=80)
    unidades = [('Subtramo 1', 'p_area_S1', ('Rio Amaime', 1)), ('Subtramo 2', 'p_area_S2', ('Rio Amaime', 2)),
                ('Subtramo 3', 'p_area_S3', ('Rio Amaime', 3)), ('Río Nima', 'p_area_Nima', ('Rio Nima', 1)),
                ('Subtramo 3 + Nima', None, None)]
    fila_teo = {}
    for k, (et, area, clave_p) in enumerate(unidades):
        r = 5 + k
        fila_teo[et] = r
        celda(ws_x, f'A{r}', et)
        if area:
            celda(ws_x, f'B{r}', f'={area}', fmt='#,##0.0')
            for j, esc in enumerate(('bajo', 'medio', 'alto')):
                ca, cd = L(3 + j), L(6 + j)
                pa, pd_ = L(9 + j), L(12 + j)
                celda(ws_x, f'{ca}{r}', f'=$B{r}*p_fN_{esc}', fmt=FMT_KGA)
                celda(ws_x, f'{cd}{r}', f'={ca}{r}/p_dias', fmt=FMT_KG)
                celda(ws_x, f'{pa}{r}', f'=$B{r}*p_fP_{esc}', fmt=FMT_KGA)
                celda(ws_x, f'{pd_}{r}', f'={pa}{r}/p_dias', fmt=FMT_KG)
            pr = prior[clave_p]
            celda(ws_x, f'O{r}', float(pr['n_kg_ano']), fmt=FMT_KGA, fill=FILL_IN)
            celda(ws_x, f'P{r}', f'=IF(ROUND(D{r},0)=O{r},"Coincide","Difiere")')
            celda(ws_x, f'Q{r}', float(pr['p_kg_ano']), fmt=FMT_KGA, fill=FILL_IN)
            celda(ws_x, f'R{r}', f'=IF(ROUND(J{r},0)=Q{r},"Coincide","Difiere")')
        else:
            r3, rn = fila_teo['Subtramo 3'], fila_teo['Río Nima']
            for j in range(2, 15):
                c = L(j)
                celda(ws_x, f'{c}{r}', f'={c}{r3}+{c}{rn}', fmt='#,##0.0' if j == 2 else (FMT_KGA if j in (3, 4, 5, 9, 10, 11) else FMT_KG))
            for c in 'OPQR':
                celda(ws_x, f'{c}{r}', '—')
    nota(ws_x, 'A10', 'Referencias: data/fuentes/priorizacion/Priorizacion_NP_subtramos.csv (Tabla 5.2, escenario medio). '
                      'Factores en Parámetros. Las estimaciones teóricas no dependen del periodo.')

    def bloque_comparacion(fila0, var):
        etiqueta = '="Incremento observado de "&p_param_n&" frente a la estimación teórica de N de la caña"' if var == 'N' \
            else 'Incremento observado de P total frente a la estimación teórica de P de la caña'
        celda(ws_x, f'A{fila0}', etiqueta, font=F_BOLD, borde=False)
        encabezado(ws_x, fila0 + 1, 1, ['Subtramo', 'Periodo', 'Condición hidrológica', 'Pares de campañas',
                                        'Incremento observado promedio (kg/d)',
                                        'Estimación teórica de la caña, bajo (kg/d)', 'Estimación teórica, medio (kg/d)',
                                        'Estimación teórica, alto (kg/d)', 'Cociente observado / bajo',
                                        'Cociente observado / medio', 'Cociente observado / alto',
                                        'Orden de magnitud frente al escenario medio', 'Observación'], alto=66)
        r = fila0 + 2
        filas = {}
        col_teo = ('F', 'G', 'H') if var == 'N' else ('L', 'M', 'N')
        for sub, obs in (('Subtramo 1', 'Subtramo 1'), ('Subtramo 2', 'Subtramo 2'),
                         ('Subtramo 3', 'Subtramo 3'), ('Subtramo 3 + Nima', 'Subtramo 3')):
            for per_ref in ('=p_p1_nombre', '=p_p2_nombre'):
                for cond in CONDICIONES:
                    fr = filas_resumen_inc[(var, obs, per_ref, cond)]
                    celda(ws_x, f'A{r}', sub)
                    celda(ws_x, f'B{r}', per_ref)
                    celda(ws_x, f'C{r}', cond)
                    celda(ws_x, f'D{r}', f"='Incremento por subtramo'!T{fr}", fmt='0')
                    celda(ws_x, f'E{r}', f"='Incremento por subtramo'!U{fr}", fmt=FMT_KG)
                    tr = fila_teo[sub]
                    for c_dst, c_src in zip('FGH', col_teo):
                        celda(ws_x, f'{c_dst}{r}', f'=${c_src}${tr}', fmt=FMT_KG)
                    for c_dst, c_teo in zip('IJK', 'FGH'):
                        celda(ws_x, f'{c_dst}{r}', f'=IF(AND(ISNUMBER(E{r}),{c_teo}{r}>0),E{r}/{c_teo}{r},"")', fmt=FMT_R)
                    celda(ws_x, f'L{r}', f'=IF(NOT(ISNUMBER(E{r})),"Sin pares",IF(E{r}<0,"Incremento promedio negativo",'
                                         f'IF(E{r}=0,"Incremento promedio nulo",')
                    ws_x[f'L{r}'].value += (
                                         f'IF(ROUND(LOG10(J{r}),0)=0,"Mismo orden de magnitud",'
                                         f'IF(ROUND(LOG10(J{r}),0)>0,ROUND(LOG10(J{r}),0)&" orden(es) por encima",'
                                         f'-ROUND(LOG10(J{r}),0)&" orden(es) por debajo")))))')
                    celda(ws_x, f'M{r}', f"=IF(NOT(ISNUMBER(E{r})),\"\",IF(D{r}<3,\"Menos de 3 pares; \",\"\")"
                                         f"&'Incremento por subtramo'!W{fr})")
                    filas[(sub, per_ref, cond)] = r
                    r += 1
        return filas, r

    filas_cmp_n, r = bloque_comparacion(12, 'N')
    filas_cmp_p, r = bloque_comparacion(r + 2, 'P')
    nota(ws_x, f'A{r}', 'Subtramo 3 + Nima: mismo incremento observado (Antes del Cauca − Antes del Nima), frente a la '
                        'suma de las estimaciones teóricas del subtramo 3 y del Nima, porque el Nima desemboca en ese subtramo. '
                        'El factor de N es nitrógeno perdido en total; el N-NO3 es solo una fracción.')

    # Nima: concentraciones promedio y referencia teórica
    n0 = r + 3
    celda(ws_x, f'A{n0 - 1}', 'Río Nima: concentraciones promedio por estación y periodo (sin caudal: no se calcula carga '
                             'observada ni condición hidrológica)', font=F_BOLD, borde=False)
    encabezado(ws_x, n0, 1, ['Estación', 'Periodo', 'Campañas', 'Registros de N-NO3', 'Concentración promedio de N-NO3 (mg/L)',
                             'Registros de N total', 'Concentración promedio de N total (mg/L)', 'Registros de P total',
                             'Concentración promedio de P total (mg/L)'], alto=66)
    r = n0 + 1
    filas_nima = {}
    for _, est, _ in NIMA:
        for per_ref in ('=p_p1_nombre', '=p_p2_nombre'):
            celda(ws_x, f'A{r}', est)
            celda(ws_x, f'B{r}', per_ref)
            base = f'{rng("A")},"Rio Nima",{rng("B")},$A{r},{rng("G")},$B{r}'
            celda(ws_x, f'C{r}', f'=COUNTIFS({base})', fmt='0')
            for cn, cv, col in (('D', 'E', 'K'), ('F', 'G', 'L'), ('H', 'I', 'M')):
                celda(ws_x, f'{cn}{r}', f'=COUNTIFS({base},{rng(col)},">=0")', fmt='0')
                celda(ws_x, f'{cv}{r}', f'=IF({cn}{r}>0,SUMIFS({rng(col)},{base})/{cn}{r},"")', fmt=FMT_C)
            filas_nima[(est, per_ref)] = r
            r += 1
    r += 1
    encabezado(ws_x, r, 1, ['Referencia teórica de la caña, río Nima', 'Área de caña (ha)', 'N bajo (kg/d)', 'N medio (kg/d)',
                            'N alto (kg/d)', 'P bajo (kg/d)', 'P medio (kg/d)', 'P alto (kg/d)'], alto=54)
    rn = fila_teo['Río Nima']
    celda(ws_x, f'A{r + 1}', 'Estimación teórica de la caña (896,6 ha; no depende del periodo)')
    celda(ws_x, f'B{r + 1}', f'=B{rn}', fmt='#,##0.0')
    for c_dst, c_src in zip('CDEFGH', 'FGHLMN'):
        celda(ws_x, f'{c_dst}{r + 1}', f'={c_src}{rn}', fmt=FMT_KG)
    anchos(ws_x, {'A': 24, 'B': 15, 'C': 15, 'D': 13, 'E': 15, 'F': 14, 'G': 14, 'H': 14, 'I': 14, 'J': 13,
                  'K': 13, 'L': 26, 'M': 30, 'N': 13, 'O': 13, 'P': 12, 'Q': 13, 'R': 12})
    ws_x.freeze_panes = 'B5'

    # ── Bitácora ──────────────────────────────────────────────────────
    titulo(ws_b, 'Bitácora de exclusiones y observaciones de calidad de datos',
           'Registros generados por analisis_amaime_nima.py con los parámetros por defecto. Ningún dato original se modifica: '
           'las exclusiones se aplican con fórmulas.')
    encabezado(ws_b, 4, 1, ['Tipo', 'Río', 'Estación', 'Fecha', 'Variable', 'Valor original', 'Criterio', 'Tratamiento'], alto=30)
    for k, b in enumerate(bitacora(calidad, caudal, res)):
        r = 5 + k
        for col, key in zip('ABCDEFGH', ('tipo', 'rio', 'estacion', 'fecha', 'variable', 'valor', 'criterio', 'tratamiento')):
            v = b.get(key)
            celda(ws_b, f'{col}{r}', v, fmt=FMT_FECHA if key == 'fecha' and isinstance(v, dt.date) else None,
                  align=WRAP)
    anchos(ws_b, {'A': 30, 'B': 12, 'C': 18, 'D': 12, 'E': 16, 'F': 26, 'G': 60, 'H': 60})
    ws_b.freeze_panes = 'A5'

    for ws in wb.worksheets:
        ws.sheet_view.showGridLines = False
    wb.save(XLSX_OUT)
    return {'filas_resumen_carga': filas_resumen_carga, 'filas_resumen_inc': filas_resumen_inc,
            'filas_cmp_n': filas_cmp_n, 'filas_cmp_p': filas_cmp_p, 'fila_teo': fila_teo,
            'filas_nima': filas_nima}


# ══════════════════════════════════════════════════════════════════════
# 5. Bitácora
# ══════════════════════════════════════════════════════════════════════
def bitacora(calidad, caudal, res):
    out = []
    camp = res['camp']
    # Campañas de 2022
    for f in sorted({(x['rio'], x['fecha']) for x in calidad if periodo(x['fecha'].year) == SIN_PERIODO}):
        out.append({'tipo': 'Campaña fuera de los periodos', 'rio': f[0], 'estacion': 'Todas', 'fecha': f[1],
                    'variable': 'Todas', 'valor': '—',
                    'criterio': 'El año 2022 queda fuera de ambos periodos (Parámetros).',
                    'tratamiento': 'Se conserva en Datos y en Clasificación; no entra en los promedios por periodo.'})
    # Caudal inconsistente entre estaciones
    for _, c in camp[camp['inconsistente']].iterrows():
        out.append({'tipo': 'Caudal de campaña inconsistente', 'rio': 'Rio Amaime', 'estacion': 'Todas',
                    'fecha': c['fecha'], 'variable': 'Caudal',
                    'valor': f"Los Ceibos {c['ceibos']:.2f} m³/s; Amaime {c['amaime']:.2f} m³/s (cociente {c['cociente']:,.0f})",
                    'criterio': f"Cociente entre estaciones mayor que {P['cociente_max']} el mismo día.",
                    'tratamiento': 'Campaña sin caudal usado: sin carga y sin condición hidrológica (parámetro editable).'})
    # Límites físicos
    n_lim = 0
    for x in calidad:
        if x['no3'] is not None and x['no3'] > P['lim_no3']:
            n_lim += 1
            out.append({'tipo': 'Límite físico', 'rio': x['rio'], 'estacion': x['estacion'], 'fecha': x['fecha'],
                        'variable': 'N-NO3', 'valor': x['no3'], 'criterio': f"N-NO3 > {P['lim_no3']} mg/L",
                        'tratamiento': 'Celda anulada en la columna de valor válido.'})
    if n_lim == 0:
        out.append({'tipo': 'Límite físico', 'rio': 'Amaime y Nima', 'estacion': 'Todas', 'fecha': None,
                    'variable': 'N-NO3', 'valor': 'Sin casos',
                    'criterio': f"N-NO3 > {P['lim_no3']:.0f} mg/L (perfil_longitudinal_calidad.py).",
                    'tratamiento': 'Ningún registro se anula. Máximo observado: '
                                   f"{max(x['no3'] for x in calidad if x['no3'] is not None):.2f} mg/L."})
    # Valores no reportados
    for rio, ests in (('Rio Amaime', AMAIME), ('Rio Nima', NIMA)):
        for _, est, _ in ests:
            regs = [x for x in calidad if x['rio'] == rio and x['estacion'] == est]
            for key, var in (('no3', 'N-NO3'), ('nt', 'N total'), ('pt', 'P total')):
                sd = [x for x in regs if x[key] is None]
                if not sd:
                    continue
                con = sorted(x['fecha'].isoformat() for x in regs if x[key] is not None)
                out.append({'tipo': 'Valor no reportado (S/D)', 'rio': rio, 'estacion': est, 'fecha': None,
                            'variable': var, 'valor': f'{len(sd)} de {len(regs)} campañas sin dato',
                            'criterio': 'S/D o vacío en la fuente (to_num de build_calidad_trib.py).',
                            'tratamiento': 'Sin concentración ni carga en esas campañas. Campañas con dato: '
                                           + (', '.join(con) if len(con) <= 8 else f'{len(con)}')})
    # Posible límite de detección: mismo valor en todas las estaciones de la campaña
    for rio in ('Rio Amaime', 'Rio Nima'):
        por = defaultdict(list)
        for x in calidad:
            if x['rio'] == rio:
                for key, var in (('no3', 'N-NO3'), ('nt', 'N total'), ('pt', 'P total')):
                    if x[key] is not None:
                        por[(x['fecha'], var)].append(x[key])
        for (fecha, var), vals in sorted(por.items()):
            for valor, n in sorted(Counter(vals).items()):
                if n >= 3:
                    out.append({'tipo': 'Posible límite de detección', 'rio': rio,
                                'estacion': f'{n} de {len(vals)} estaciones', 'fecha': fecha, 'variable': var,
                                'valor': valor,
                                'criterio': 'Mismo valor en 3 o más estaciones de la campaña.',
                                'tratamiento': 'Se conserva con el valor reportado (criterio del proyecto: el límite de '
                                               'detección entra con su propio valor). Entre esas estaciones el '
                                               'incremento es cero por construcción.'})
    # Cobertura de estaciones
    fechas = sorted({x['fecha'] for x in calidad if x['rio'] == 'Rio Amaime'})
    for _, est, _ in AMAIME:
        tiene = {x['fecha'] for x in calidad if x['rio'] == 'Rio Amaime' and x['estacion'] == est}
        falta = [f for f in fechas if f not in tiene]
        if falta:
            out.append({'tipo': 'Campaña sin muestra en la estación', 'rio': 'Rio Amaime', 'estacion': est,
                        'fecha': None, 'variable': 'Todas', 'valor': ', '.join(f.isoformat() for f in falta),
                        'criterio': 'La estación no aparece en la campaña.',
                        'tratamiento': 'Sin par en esas fechas; el incremento se calcula solo con pares completos.'})
    # Serie de referencia
    c = caudal['ceibos'].dropna()
    c21 = c[[f.year == 2021 for f in c.index]]
    out.append({'tipo': 'Serie de referencia (observación)', 'rio': 'Rio Amaime', 'estacion': 'Los Ceibos',
                'fecha': None, 'variable': 'Caudal',
                'valor': f'{int((c21 <= 0.05).sum())} días de 2021 con caudal ≤ 0,05 m³/s; máximo 2021 {c21.max():.1f} m³/s',
                'criterio': 'Valores erráticos en 2021 (alternan casi cero y crecientes de cientos de m³/s).',
                'tratamiento': 'Se conservan en la serie de referencia para reproducir los umbrales 3,12 y 10,91 m³/s; '
                               'solo afectan a una campaña del Amaime (ver caudal inconsistente).'})
    out.append({'tipo': 'Cambio de estación entre periodos', 'rio': 'Rio Amaime', 'estacion': 'Los Ceibos / Amaime',
                'fecha': None, 'variable': 'Caudal',
                'valor': 'Periodo 1: caudal de Amaime (km 44,6); periodo 2: caudal de Los Ceibos (km 32,4)',
                'criterio': 'Las dos estaciones casi no se solapan en las fechas de campaña.',
                'tratamiento': 'Sin corrección. Parte de la diferencia entre periodos puede deberse a la estación '
                               'que aporta el caudal (limitación del README).'})
    out.append({'tipo': 'Río sin caudal', 'rio': 'Rio Nima', 'estacion': 'Todas', 'fecha': None, 'variable': 'Todas',
                'valor': '—', 'criterio': 'Sin estación hidrométrica en el Nima.',
                'tratamiento': 'No se calcula carga observada ni condición hidrológica; no se extrapola caudal.'})
    return out


# ══════════════════════════════════════════════════════════════════════
# 6. Verificación contra el libro recalculado
# ══════════════════════════════════════════════════════════════════════
def verificar(res, mapas):
    wb = load_workbook(XLSX_OUT, data_only=True)
    errores = []

    def cmp(etiqueta, libro, control, tol=1e-6):
        if control is None or (isinstance(control, float) and math.isnan(control)):
            ok = libro in (None, '')
        else:
            ok = isinstance(libro, (int, float)) and abs(libro - control) <= tol * max(1, abs(control))
        if not ok:
            errores.append(f'{etiqueta}: libro={libro!r} control={control!r}')

    ws = wb['Clasificación']
    cmp('umbral verano', ws['C8'].value, res['uv'])
    cmp('umbral invierno', ws['C11'].value, res['ui'])
    per = {'=p_p1_nombre': P['p1_nombre'], '=p_p2_nombre': P['p2_nombre']}
    rc = resumen_carga(res)
    ws = wb['Carga por estación']
    for (est, pr, cond), r in mapas['filas_resumen_carga'].items():
        n, m = rc[(est, per[pr], cond, 'carga_n')]
        cmp(f'n carga N {est} {pr} {cond}', ws[f'Q{r}'].value, n)
        cmp(f'carga N {est} {pr} {cond}', ws[f'R{r}'].value, m)
        n, m = rc[(est, per[pr], cond, 'carga_p')]
        cmp(f'carga P {est} {pr} {cond}', ws[f'V{r}'].value, m)
    ri = resumen_incremento(res)
    ws = wb['Incremento por subtramo']
    for (var, clave, pr, cond), r in mapas['filas_resumen_inc'].items():
        n, m, neg = ri[('carga_n' if var == 'N' else 'carga_p', clave, per[pr], cond)]
        cmp(f'n inc {var} {clave} {pr} {cond}', ws[f'T{r}'].value, n)
        cmp(f'inc {var} {clave} {pr} {cond}', ws[f'U{r}'].value, m)
        cmp(f'neg {var} {clave} {pr} {cond}', ws[f'V{r}'].value, neg)
    ws = wb['Comparación']
    fac = factores()
    areas = {'Subtramo 1': 708.2, 'Subtramo 2': 83.5, 'Subtramo 3': 2684.2, 'Río Nima': 896.6}
    for et, a in areas.items():
        r = mapas['fila_teo'][et]
        for j, c in enumerate('CDE'):
            cmp(f'teórica N {et} {c}', ws[f'{c}{r}'].value, a * fac['N'][j])
        for j, c in enumerate('IJK'):
            cmp(f'teórica P {et} {c}', ws[f'{c}{r}'].value, a * fac['P'][j])
        for c in 'PR':
            if ws[f'{c}{r}'].value != 'Coincide':
                errores.append(f'verificación {c} {et}: {ws[f"{c}{r}"].value}')
    wp = wb['Parámetros']
    estados = [c.value for row in wp.iter_rows() for c in row if c.value in ('Coincide', 'Difiere')]
    if 'Difiere' in estados or len(estados) < 8:
        errores.append(f'Parámetros: verificaciones {Counter(estados)}')
    for nombre_h in wb.sheetnames:
        for row in wb[nombre_h].iter_rows():
            for c in row:
                if isinstance(c.value, str) and c.value.startswith('#'):
                    errores.append(f'{nombre_h}!{c.coordinate}: {c.value}')
    return errores, estados


def imprimir_resumen(res):
    rc, ri = resumen_carga(res), resumen_incremento(res)
    print(f"Umbrales: verano {res['uv']:.4f}  invierno {res['ui']:.4f}  (n = {len(res['ref'])} días)")
    print(res['camp'][['fecha', 'ceibos', 'amaime', 'qusado', 'condicion', 'periodo']].to_string(index=False))
    fac = factores()
    teo = {'Subtramo 1': 708.2, 'Subtramo 2': 83.5, 'Subtramo 3': 2684.2, 'Subtramo 3 + Nima': 2684.2 + 896.6}
    for var, k in (('carga_n', 'N'), ('carga_p', 'P')):
        print(f'\n== Incremento {var} (kg/d) | teórica bajo/medio/alto (kg/d)')
        for clave, _, _ in TRAMOS:
            for per in (P['p1_nombre'], P['p2_nombre']):
                linea = []
                for cond in CONDICIONES:
                    n, m, neg = ri[(var, clave, per, cond)]
                    linea.append(f"{cond[:4]} n={n} {'' if m is None else f'{m:9.1f}'} neg={neg}")
                print(f'{clave:22s} {per:11s} ' + ' | '.join(linea))
        for sub, a in teo.items():
            print(f'  teórica {sub:18s}', ' '.join(f'{a * f / 365:8.2f}' for f in fac[k]))
    print('\n== Carga promedio por estación (Todas)')
    for _, est, _ in AMAIME:
        for per in (P['p1_nombre'], P['p2_nombre']):
            n, m = rc[(est, per, 'Todas', 'carga_n')]
            n2, m2 = rc[(est, per, 'Todas', 'carga_p')]
            print(f'{est:16s} {per:11s} N n={n} {m if m is None else round(m, 1)}  P n={n2} {m2 if m2 is None else round(m2, 1)}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--verificar', action='store_true', help='compara el libro recalculado con pandas')
    args = ap.parse_args()
    calidad = leer_calidad()
    caudal = leer_caudal()
    prior, limites = leer_tramos()
    res = calcular(calidad, caudal)
    if args.verificar:
        mapas = construir_mapas(calidad, caudal, prior, limites, res)
        errores, estados = verificar(res, mapas)
        print(f'Verificaciones de Parámetros y Comparación: {Counter(estados)}')
        if errores:
            print(f'{len(errores)} diferencias:')
            for e in errores[:60]:
                print('  ', e)
            sys.exit(1)
        print('El libro recalculado coincide con el cálculo de control en pandas.')
        return
    construir(calidad, caudal, prior, limites, res)
    imprimir_resumen(res)
    print(f'\nLibro escrito: {XLSX_OUT}')


def construir_mapas(calidad, caudal, prior, limites, res):
    """Reconstruye las posiciones de celdas sin sobrescribir el libro recalculado."""
    global XLSX_OUT
    destino = XLSX_OUT
    tmp = destino + '.mapas.xlsx'
    XLSX_OUT = tmp
    try:
        mapas = construir(calidad, caudal, prior, limites, res)
    finally:
        XLSX_OUT = destino
        if os.path.exists(tmp):
            os.remove(tmp)
    return mapas


if __name__ == '__main__':
    main()
