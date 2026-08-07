# -*- coding: utf-8 -*-
"""build_caudal_consolidado.py — Consolidado de caudal diario de tributarios.

Se ejecuta UNA SOLA VEZ desde la terminal para generar el CSV consolidado:

    python src/build_caudal_consolidado.py

Une las series diarias por estación que ya produjo build_hydro_trib.py
(data/hydrology/tributarios/<ESTACION>/caudal_diario.csv) en un único CSV,
enriquecido con el río, el estado y las coordenadas WGS84 de cada estación
desde data/hydrology/estaciones_hidro_trib.json (que a su vez las toma de
data/databases/Estaciones_tributarios.geojson). Produce:

    docs/caudal_consolidado_tributarios.csv
"""

import os
import sys
import csv
import json

try:
    sys.stdout.reconfigure(encoding='utf-8')
except (AttributeError, ValueError):
    pass

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
TRIB_DIR = os.path.join(PROJECT_DIR, 'data', 'hydrology', 'tributarios')
META_PATH = os.path.join(PROJECT_DIR, 'data', 'hydrology', 'estaciones_hidro_trib.json')
OUT_PATH = os.path.join(PROJECT_DIR, 'docs', 'caudal_consolidado_tributarios.csv')


def main():
    if not os.path.isfile(META_PATH):
        raise SystemExit(f'No existe el JSON de metadatos:\n  {META_PATH}')
    if not os.path.isdir(TRIB_DIR):
        raise SystemExit(f'No existe la carpeta de estaciones:\n  {TRIB_DIR}')

    with open(META_PATH, encoding='utf-8') as fh:
        estaciones = json.load(fh)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    filas = []
    sin_datos = []

    for e in estaciones:
        nombre = e['nombre']
        csv_path = os.path.join(TRIB_DIR, nombre, 'caudal_diario.csv')
        if not os.path.isfile(csv_path):
            sin_datos.append(nombre)
            continue

        n_antes = len(filas)
        with open(csv_path, encoding='utf-8') as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                filas.append({
                    'rio':          e.get('rio') or '',
                    'estacion':     nombre,
                    'municipio':    e.get('municipio') or '',
                    'estado':       e.get('estado') or '',
                    'latitud':      e.get('latitud'),
                    'longitud':     e.get('longitud'),
                    'fecha':        row['FECHA'],
                    'caudal_m3s':   row['CAUDAL_M3S'],
                })
        n_leidas = len(filas) - n_antes
        print(f'  {nombre:<20} [{e.get("rio") or "?":<16}] {n_leidas:>5} registros')

    if sin_datos:
        print(f'\n  ⚠ Estaciones sin caudal_diario.csv (omitidas): {", ".join(sin_datos)}')

    # Orden estable: río, estación, fecha — para que el CSV sea legible y
    # deterministic run tras run (independiente del orden del JSON de origen).
    filas.sort(key=lambda r: (r['rio'], r['estacion'], r['fecha']))

    cols = ['rio', 'estacion', 'municipio', 'estado', 'latitud', 'longitud', 'fecha', 'caudal_m3s']
    with open(OUT_PATH, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(filas)

    rios = sorted({r['rio'] for r in filas if r['rio']})
    print('\n── Resumen ─────────────────────────────────')
    print(f'  Estaciones consolidadas : {len(estaciones) - len(sin_datos)}')
    print(f'  Ríos                    : {len(rios)} — {", ".join(rios)}')
    print(f'  Registros totales       : {len(filas):,}')
    print(f'  CSV de salida           : {OUT_PATH}')


if __name__ == '__main__':
    main()
