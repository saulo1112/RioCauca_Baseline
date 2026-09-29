# -*- coding: utf-8 -*-
"""geojson_a_shapefile.py — Convierte Buffer_Zona_Estudio_por_Tramo.geojson a
Shapefile para importar en ArcGIS Pro (p. ej. para determinar el número de
curva por subtramo).

    cd tools/tramos && py geojson_a_shapefile.py

Los nombres de campo del GeoJSON se acortan a <=10 caracteres para el .dbf
(límite clásico de Shapefile); el GeoJSON de origen conserva los nombres
completos y no se toca.
"""
import geopandas as gpd

ROOT = r"c:\Users\ASUS\Desktop\Work\Proyecto - Corredor Biológico\Fase I\Rio_Cauca_Baseline"
SRC = f"{ROOT}/data/cartografia/Buffer_Zona_Estudio_por_Tramo.geojson"
OUT_DIR = f"{ROOT}/data/cartografia/shapefiles/Buffer_Zona_Estudio_por_Tramo"
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

gdf.to_file(OUT_SHP, driver="ESRI Shapefile", encoding="utf-8")
print(f"\nEscrito: {OUT_SHP}")
for ext in (".shp", ".shx", ".dbf", ".prj", ".cpg"):
    p = OUT_SHP.replace(".shp", ext)
    print(f"  {p}  ({os.path.getsize(p)} bytes)" if os.path.exists(p) else f"  {p}  (NO CREADO)")

# Verificacion de lectura
chk = gpd.read_file(OUT_SHP)
print(f"\nVerificacion: {len(chk)} features releidas, columnas: {list(chk.columns)}")
