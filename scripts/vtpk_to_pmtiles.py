#!/usr/bin/env python3
"""
vtpk_to_pmtiles.py
Convierte Mapa_Base.vtpk → public/tiles/mapa_base.pmtiles
Sin dependencias externas — solo stdlib de Python 3.

Pipeline:
  1. Abre el VTPK como ZIP
  2. Lee cada bundle en formato ArcGIS Compact V2
  3. Extrae tiles PBF individuales (ya comprimidos en gzip)
  4. Escribe el archivo PMTiles v3 directamente (Hilbert curve tile IDs)
  5. Extrae el estilo GL del VTPK y lo adapta para MapLibre

Uso:
  python3 scripts/vtpk_to_pmtiles.py
"""

import zipfile, struct, gzip, json, os, sys
from pathlib import Path

VTPK_PATH   = Path("capas/Mapa_Base.vtpk")
OUT_PMTILES = Path("public/tiles/mapa_base.pmtiles")
OUT_STYLE   = Path("styles/vtpk_style.json")

# ── 1. Compact V2 bundle reader ──────────────────────────────────────────

def parse_bundle_meta(zpath: str):
    """'p12/tile/L14/R1f00C1200.bundle' → (level=14, row_base=7936, col_base=4608)"""
    parts = zpath.split("/")
    level    = int(parts[-2][1:])          # "L14" → 14
    rc       = parts[-1][:-7]              # "R1f00C1200"
    r_str, c_str = rc.split("C")
    row_base = int(r_str[1:], 16)          # "R1f00" → 0x1f00 = 7936
    col_base = int(c_str, 16)             # "1200" → 0x1200 = 4608
    return level, row_base, col_base

def extract_bundle(data: bytes, z: int, row_base: int, col_base: int):
    """Extrae tiles (z, x, y, bytes) de un bundle Compact V2."""
    HEADER = 64
    tiles  = []
    for i in range(128 * 128):
        e      = data[HEADER + i * 8 : HEADER + i * 8 + 8]
        offset = struct.unpack_from("<Q", e[:5] + b"\x00\x00\x00")[0]
        size   = struct.unpack_from("<I", e[5:8] + b"\x00")[0]
        if size == 0:
            continue
        r, c = divmod(i, 128)
        # ArcGIS row→ XYZ y (mismo orden, sin flip)
        tiles.append((z, col_base + c, row_base + r, data[offset : offset + size]))
    return tiles

# ── 2. Hilbert curve → PMTiles tile ID ──────────────────────────────────

def _rotate(n, x, y, rx, ry):
    if ry == 0:
        if rx == 1:
            x = n - 1 - x
            y = n - 1 - y
        x, y = y, x
    return x, y

def tile_id(z: int, x: int, y: int) -> int:
    """Convierte coordenadas z/x/y al tile ID de PMTiles v3 (Hilbert curve)."""
    if z == 0:
        return 0
    n, d, s = 1 << z, 0, (1 << z) >> 1
    while s > 0:
        rx = 1 if (x & s) > 0 else 0
        ry = 1 if (y & s) > 0 else 0
        d += s * s * ((3 * rx) ^ ry)
        x, y = _rotate(n, x, y, rx, ry)
        s >>= 1
    return ((4 ** z - 1) // 3) + d

# ── 3. Varint encoding ────────────────────────────────────────────────────

def varint(v: int) -> bytes:
    out = bytearray()
    while True:
        b = v & 0x7F
        v >>= 7
        out.append(b | (0x80 if v else 0))
        if not v:
            break
    return bytes(out)

# ── 4. PMTiles v3 directory encoding ─────────────────────────────────────

def encode_dir(entries) -> bytes:
    """
    entries: list of (tile_id, offset, length, run_length)
    Devuelve el directorio comprimido en gzip listo para escribir.
    """
    entries = sorted(entries, key=lambda e: e[0])
    n = len(entries)

    buf = bytearray(varint(n))

    last_id = 0
    for tid, _, _, _ in entries:
        buf += varint(tid - last_id)
        last_id = tid

    for _, _, _, rl in entries:
        buf += varint(rl)

    for _, _, ln, _ in entries:
        buf += varint(ln)

    last_off = 0
    for _, off, ln, rl in entries:
        if rl == 0:           # referencia a hoja (no usado en dir raíz)
            buf += varint(off)
        else:                 # tile normal — delta del offset
            buf += varint(off - last_off)
            last_off = off + ln

    # Sin compresión: internal_compression=1 en el header → browser no necesita DecompressionStream
    return bytes(buf)

# ── 5. Escritura PMTiles v3 ───────────────────────────────────────────────

def write_pmtiles(path: Path, tiles, bounds, center, min_z, max_z):
    """
    tiles:  list of (z, x, y, raw_bytes)   — bytes gzip-comprimidos del VTPK
    bounds: (min_lon, min_lat, max_lon, max_lat)
    center: (lon, lat, zoom)

    Los tiles se descomprimen antes de almacenar (tile_compression = 1 / None).
    Esto evita que el browser necesite DecompressionStream para cada tile,
    eliminando el error 'Compression method not supported'.
    El tamaño final es mayor (~2-3x) pero sigue siendo manejable.
    """
    # Descomprimir tiles de gzip a PBF puro
    print(f"  Descomprimiendo tiles gzip -> PBF…")
    decompressed = []
    errors = 0
    for z, x, y, data in tiles:
        try:
            raw = gzip.decompress(data)
        except Exception:
            raw = data   # ya era PBF sin comprimir
            errors += 1
        # Strip the 1-byte ESRI version prefix (0x02) present in all VTPK bundle tiles
        if len(raw) >= 2 and raw[0] == 0x02 and raw[1] == 0x1a:
            raw = raw[1:]
        decompressed.append((z, x, y, raw))
    if errors:
        print(f"  Advertencia: {errors} tiles no se pudieron descomprimir (se almacenan tal cual)")
    tiles = decompressed

    print(f"  Asignando tile IDs (Hilbert curve)…")
    with_ids = [(tile_id(z, x, y), data) for z, x, y, data in tiles]
    with_ids.sort(key=lambda t: t[0])

    # Deduplicar (el mismo tile puede aparecer en bundles solapados a zoom bajo)
    seen, unique = set(), []
    for tid, data in with_ids:
        if tid not in seen:
            unique.append((tid, data))
            seen.add(tid)
    print(f"  Tiles únicos: {len(unique)}")

    # Construir blob de datos y directorio
    blob_parts, entries, off = [], [], 0
    for tid, data in unique:
        entries.append((tid, off, len(data), 1))
        blob_parts.append(data)
        off += len(data)

    tile_blob = b"".join(blob_parts)
    dir_bytes = encode_dir(entries)

    # Metadatos
    meta = {
        "format":      "pbf",
        "minzoom":     str(min_z),
        "maxzoom":     str(max_z),
        "bounds":      f"{bounds[0]},{bounds[1]},{bounds[2]},{bounds[3]}",
        "center":      f"{center[0]},{center[1]},{center[2]}",
        "name":        "Mapa Base — Corredor Biológico Río Cauca",
        "description": "Cartografía temática del corredor del Río Cauca (UAO × ASOCAÑA)",
        "attribution": "CVC · CARDER · IDEAM",
        "type":        "overlay",
    }
    # Sin compresión: raw JSON (internal_compression=1 → browser no descomprime)
    meta_bytes = json.dumps(meta).encode("utf-8")

    # Calcular offsets
    H = 127
    root_off  = H
    root_len  = len(dir_bytes)
    meta_off  = root_off + root_len
    meta_len  = len(meta_bytes)
    leaf_off  = meta_off + meta_len   # sin hojas
    leaf_len  = 0
    data_off  = leaf_off
    data_len  = len(tile_blob)

    # Cabecera PMTiles v3 (127 bytes) — layout según bytesToHeader de pmtiles@3.x JS
    hdr = bytearray(127)
    hdr[0:7] = b"PMTiles"                      # magic de 7 bytes
    hdr[7]   = 3                               # spec version
    struct.pack_into("<Q", hdr,  8, root_off)  # rootDirectoryOffset
    struct.pack_into("<Q", hdr, 16, root_len)  # rootDirectoryLength
    struct.pack_into("<Q", hdr, 24, meta_off)  # jsonMetadataOffset
    struct.pack_into("<Q", hdr, 32, meta_len)  # jsonMetadataLength
    struct.pack_into("<Q", hdr, 40, leaf_off)  # leafDirectoryOffset
    struct.pack_into("<Q", hdr, 48, leaf_len)  # leafDirectoryLength
    struct.pack_into("<Q", hdr, 56, data_off)  # tileDataOffset
    struct.pack_into("<Q", hdr, 64, data_len)  # tileDataLength
    struct.pack_into("<Q", hdr, 72, len(unique))   # numAddressedTiles
    struct.pack_into("<Q", hdr, 80, len(entries))  # numTileEntries
    struct.pack_into("<Q", hdr, 88, len(unique))   # numTileContents
    hdr[96]  = 1    # clustered
    hdr[97]  = 1    # internalCompression = 1 (None)
    hdr[98]  = 1    # tileCompression = 1 (None)
    hdr[99]  = 1    # tileType = 1 (MVT)
    hdr[100] = min_z
    hdr[101] = max_z
    struct.pack_into("<i", hdr, 102, int(bounds[0] * 1e7))  # minLon
    struct.pack_into("<i", hdr, 106, int(bounds[1] * 1e7))  # minLat
    struct.pack_into("<i", hdr, 110, int(bounds[2] * 1e7))  # maxLon
    struct.pack_into("<i", hdr, 114, int(bounds[3] * 1e7))  # maxLat
    hdr[118] = center[2]                                     # centerZoom
    struct.pack_into("<i", hdr, 119, int(center[0] * 1e7))  # centerLon
    struct.pack_into("<i", hdr, 123, int(center[1] * 1e7))  # centerLat

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(hdr)
        f.write(dir_bytes)
        f.write(meta_bytes)
        f.write(tile_blob)

    return len(unique)

# ── 6. Extracción y adaptación del estilo GL ─────────────────────────────

def extract_style(zf: zipfile.ZipFile) -> dict:
    """Lee el estilo ArcGIS del VTPK y lo adapta para MapLibre GL JS."""
    raw = zf.read("p12/resources/styles/root.json").decode("utf-8")
    style = json.loads(raw)

    # 1. Cambiar fuente: esri → vtpk (nombre del source en MapLibre)
    for layer in style.get("layers", []):
        if layer.get("source") == "esri":
            layer["source"] = "vtpk"

    # 2. Reemplazar fuentes tipográficas propietarias por equivalentes libres
    #    (Arial Regular → Open Sans Regular, Tahoma Regular → Noto Sans Regular)
    for layer in style.get("layers", []):
        layout = layer.get("layout", {})
        if "text-font" in layout:
            fonts = layout["text-font"]
            new_fonts = []
            for f in fonts:
                if "Arial" in f:
                    new_fonts.append("Open Sans Regular")
                elif "Tahoma" in f:
                    new_fonts.append("Noto Sans Regular")
                else:
                    new_fonts.append(f)
            layout["text-font"] = new_fonts

    # 3. Actualizar las URLs del estilo
    style["glyphs"]  = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
    style["sprite"]  = ""

    # 4. Reemplazar la fuente de datos por la referencia PMTiles
    style["sources"] = {
        "vtpk": {
            "type":       "vector",
            "url":        "pmtiles://public/tiles/mapa_base.pmtiles",
            "attribution": "UAO · ASOCAÑA · CVC · CARDER",
        }
    }

    return style

# ── Main ─────────────────────────────────────────────────────────────────

def main():
    if not VTPK_PATH.exists():
        print(f"ERROR: No se encontró {VTPK_PATH}")
        sys.exit(1)

    print(f"\n{'='*55}")
    print(f"  VTPK -> PMTiles v3")
    print(f"  Fuente : {VTPK_PATH}")
    print(f"  Destino: {OUT_PMTILES}")
    print(f"{'='*55}\n")

    all_tiles = []

    with zipfile.ZipFile(VTPK_PATH, "r") as zf:
        bundles = sorted(n for n in zf.namelist() if n.endswith(".bundle"))
        print(f"Bundles encontrados: {len(bundles)}\n")

        for bpath in bundles:
            z, row_base, col_base = parse_bundle_meta(bpath)
            bdata = zf.read(bpath)
            tiles = extract_bundle(bdata, z, row_base, col_base)
            all_tiles.extend(tiles)
            print(f"  [{bpath:40s}]  zoom {z:2d}  →  {len(tiles):3d} tiles")

        print(f"\nTotal extraído: {len(all_tiles)} tiles")

        # Rango de zooms
        zooms  = [t[0] for t in all_tiles]
        min_z, max_z = min(zooms), max(zooms)
        print(f"Rango de zoom: {min_z} – {max_z}")

        # Extraer y adaptar estilo
        print(f"\nExtrayendo estilo GL del VTPK…")
        style = extract_style(zf)
        OUT_STYLE.parent.mkdir(parents=True, exist_ok=True)
        with open(OUT_STYLE, "w", encoding="utf-8") as f:
            json.dump(style, f, ensure_ascii=False, indent=2)
        print(f"Estilo guardado: {OUT_STYLE}")

    # Bounds del corredor (Valle del Cauca, Colombia)
    bounds = (-76.65, 2.95, -75.78, 5.50)
    center = (-76.10, 3.85, 9)

    print(f"\nEscribiendo PMTiles…")
    n = write_pmtiles(OUT_PMTILES, all_tiles, bounds, center, min_z, max_z)

    size_mb = OUT_PMTILES.stat().st_size / 1e6
    print(f"\n{'='*55}")
    print(f"  Resultado: {OUT_PMTILES}")
    print(f"  Tiles únicos  : {n}")
    print(f"  Tamaño        : {size_mb:.2f} MB")
    print(f"{'='*55}\n")

if __name__ == "__main__":
    main()
