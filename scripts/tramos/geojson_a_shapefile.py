# -*- coding: utf-8 -*-
"""geojson_a_shapefile.py — Convierte Buffer_Zona_Estudio_por_Tramo.geojson a
Shapefile para importar en ArcGIS Pro (p. ej. para determinar el número de
curva por subtramo).

    cd scripts/tramos && py geojson_a_shapefile.py

Los nombres de campo del GeoJSON se acortan a <=10 caracteres para el .dbf
(límite clásico de Shapefile); el GeoJSON de origen conserva los nombres
completos y no se toca.

Si el shapefile ya existe, las columnas que se le hayan agregado a mano en
ArcGIS Pro (p. ej. CN_Normal / CN_Humedo, número de curva) se conservan: se
reubican por (RIO, TRAMO) en la versión regenerada. Cerrar ArcGIS Pro antes de
correrlo (mantiene el archivo bloqueado).
"""
from pathlib import Path

import geopandas as gpd

# Raíz del repo: dos niveles arriba de scripts/tramos/ (igual que ROOT en
# segmentacion.mjs), para que no dependa de la ruta de esta máquina.
ROOT = Path(__file__).resolve().parents[2].as_posix()
SRC = f"{ROOT}/data/exports/arcgis/Buffer_Zona_Estudio_por_Tramo.geojson"
OUT_DIR = f"{ROOT}/data/exports/arcgis/shapefiles/Buffer_Zona_Estudio_por_Tramo"
OUT_SHP = f"{OUT_DIR}/Buffer_Zona_Estudio_por_Tramo.shp"

# Nombre completo (GeoJSON) -> nombre corto (<=10 car., mayusculas por
# convencion de Shapefile/ArcGIS).
RENOMBRAR = {
    "rio":           "RIO",
    "tramo":         "TRAMO",
    "est_arriba":    "EST_ARRIBA",
    "est_abajo":     "EST_ABAJO",
    "km_inicio":     "KM_INICIO",
    "km_fin":        "KM_FIN",
    "longitud_km":   "LONG_KM",
    "buffer_ha":     "BUFFER_HA",
    "cana_cruda_ha": "CANA_CRUD",
    "cana_norm_ha":  "CANA_NORM",
    "pct_cana_rio":  "PCT_CANA",
    "pct_cobertura": "PCT_COBER",
}

import os
os.makedirs(OUT_DIR, exist_ok=True)

gdf = gpd.read_file(SRC)
print(f"{len(gdf)} features leidas de {SRC}")
print("Columnas originales:", list(gdf.columns))

faltan = [c for c in gdf.columns if c != "geometry" and c not in RENOMBRAR]
if faltan:
    raise SystemExit(f"Columnas sin mapear en RENOMBRAR: {faltan}")

gdf = gdf.rename(columns=RENOMBRAR)

# CRS: el GeoJSON no declara `crs` -> WGS84 por convencion (RFC 7946), que es
# ademas el mismo sistema que usa el resto del proyecto (MapLibre).
if gdf.crs is None:
    gdf = gdf.set_crs(epsg=4326)
print("CRS:", gdf.crs)

# Conservar columnas agregadas a mano en ArcGIS (p. ej. CN_Normal/CN_Humedo,
# número de curva). Sin esto, regenerar el shapefile las borraba. Se unen por
# (RIO, TRAMO); el Río Cauca va entero, con TRAMO nulo, así que la clave usa -1.
def _clave(df):
    return list(zip(df["RIO"], df["TRAMO"].fillna(-1).astype(int)))

extras = []
if os.path.exists(OUT_SHP):
    previo = gpd.read_file(OUT_SHP)
    extras = [c for c in previo.columns
              if c != "geometry" and c not in RENOMBRAR.values()]
    if extras:
        previo = previo.assign(_k=_clave(previo)).set_index("_k")[extras]
        if previo.index.duplicated().any():
            raise SystemExit("El shapefile previo tiene (RIO, TRAMO) repetidos; "
                             "no se pueden reubicar sus columnas extra con seguridad.")
        gdf["_k"] = _clave(gdf)
        huerfanas = sorted(set(previo.index) - set(gdf["_k"]))
        gdf = gdf.join(previo, on="_k").drop(columns="_k")
        print(f"Columnas conservadas del shapefile previo: {extras}")
        for c in extras:
            print(f"  {c}: {gdf[c].notna().sum()} de {len(gdf)} filas con valor")
        if huerfanas:
            print(f"  AVISO: {len(huerfanas)} fila(s) del shapefile previo ya no existen "
                  f"y sus valores no se trasladan: {huerfanas}")

gdf.to_file(OUT_SHP, driver="ESRI Shapefile", encoding="utf-8")
print(f"\nEscrito: {OUT_SHP}")
for ext in (".shp", ".shx", ".dbf", ".prj", ".cpg"):
    p = OUT_SHP.replace(".shp", ext)
    print(f"  {p}  ({os.path.getsize(p)} bytes)" if os.path.exists(p) else f"  {p}  (NO CREADO)")

# Verificacion de lectura
chk = gpd.read_file(OUT_SHP)
print(f"\nVerificacion: {len(chk)} features releidas, columnas: {list(chk.columns)}")
