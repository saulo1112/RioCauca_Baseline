# -*- coding: utf-8 -*-
"""
DISTRIBUCION DE DATOS FISICOQUIMICOS - RIO RISARALDA
UAO + ASOCANA | Proyecto Corredor Biologico 890K

Lee el Excel PUNTOS_DE_MONITOREO.xlsx y guarda cada hoja
de estacion (SUP-XXX) como CSV dentro de su subcarpeta.
"""

import sys
import pandas as pd
from pathlib import Path

# Forzar salida UTF-8 en consola Windows
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ── Configuracion ─────────────────────────────────────────────
EXCEL_PATH = Path(r"C:\Users\ASUS\Desktop\Work\Proyecto - Corredor Biológico\Fase I\Bases de datos\Estaciones\Tributarios\RIO RISARALDA\PUNTOS_DE_MONITOREO.xlsx")
BASE_DIR   = EXCEL_PATH.parent
NOMBRE_ARCHIVO = "calidad_fisicoquimica.csv"

# ── Leer Excel ────────────────────────────────────────────────
print(f"Leyendo {EXCEL_PATH.name}...")
xl = pd.ExcelFile(EXCEL_PATH)

# Hojas de estaciones (excluir hoja de info general)
hojas_estacion = [h for h in xl.sheet_names if h.upper().startswith("SUP")]
print(f"  Estaciones encontradas: {hojas_estacion}\n")

errores    = []
procesadas = 0

for hoja in hojas_estacion:

    # Leer hoja
    df = pd.read_excel(xl, sheet_name=hoja)
    df.columns = [c.strip() for c in df.columns]

    # Renombrar columnas con espacios al inicio
    renombrar = {
        ' Fecha':                           'Fecha',
        ' Hora':                            'Hora',
        ' Nitritos (mgN-NO2/L)':            'Nitritos (mgN-NO2/L)',
        ' Alcalinidad Total (mg CaCO3/L)':  'Alcalinidad Total (mg CaCO3/L)',
        ' Detergentes (SAAM) (mg SAAM/L)':  'Detergentes (SAAM) (mg SAAM/L)',
    }
    df.rename(columns={k: v for k, v in renombrar.items() if k in df.columns},
              inplace=True)

    # Ordenar por fecha
    if 'Fecha' in df.columns:
        df['Fecha'] = pd.to_datetime(df['Fecha'], errors='coerce')
        df = df.sort_values('Fecha').reset_index(drop=True)

    # Buscar carpeta por codigo SUP-XXX (ignorar punto al final del nombre)
    codigo = hoja.replace('.', '').strip().upper()
    carpetas = [d for d in BASE_DIR.iterdir()
                if d.is_dir() and d.name.upper().startswith(codigo)]

    if not carpetas:
        msg = f"  [AVISO] No se encontro carpeta para '{hoja}' (buscando '{codigo}*')"
        print(msg)
        errores.append(msg)
        continue

    carpeta_dest = carpetas[0]
    salida = carpeta_dest / NOMBRE_ARCHIVO
    df.to_csv(salida, index=False, encoding='utf-8-sig', sep=';')
    # Guardar también como Excel
    salida_xlsx = carpeta_dest / "calidad_fisicoquimica.xlsx"
    df.to_excel(salida_xlsx, index=False, sheet_name=codigo)

    n = len(df)
    fecha_min = df['Fecha'].min().strftime('%Y-%m-%d') if 'Fecha' in df.columns and df['Fecha'].notna().any() else 'S/D'
    fecha_max = df['Fecha'].max().strftime('%Y-%m-%d') if 'Fecha' in df.columns and df['Fecha'].notna().any() else 'S/D'

    print(f"  [OK] {hoja:10s} -> {carpeta_dest.name}")
    print(f"       {n} registros | {fecha_min} -> {fecha_max}")
    print(f"       Guardado: {salida}\n")
    procesadas += 1

# ── Resumen ───────────────────────────────────────────────────
print("=" * 60)
print("RESUMEN")
print("=" * 60)
print(f"  Estaciones procesadas : {procesadas}")
print(f"  Con errores           : {len(errores)}")
if errores:
    print("\n  Errores:")
    for e in errores:
        print(f"    {e}")
print(f"\n[LISTO] Archivos '{NOMBRE_ARCHIVO}' guardados en cada subcarpeta.")
print(f"        Separador: punto y coma (;) - compatible con Excel en espanol.")