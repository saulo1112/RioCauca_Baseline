# -*- coding: utf-8 -*-
"""
Extrae las figuras del Capítulo 3 del Informe Fase 1 (perfiles longitudinales
de caudal y de calidad del agua, por río) para la galería del geovisor.

    python scripts/extraer_perfiles_informe.py "../Informe Fase 1. v2 (2026-11-27).docx"

El .docx se abre como zip en modo lectura: el informe no se modifica.

Toma las Figuras 3.1 a 3.118 (Río Cauca y los quince tributarios; la 3.119 es
la escorrentía regional y no pertenece a ningún río). Cada figura se asigna al
río del título de nivel 3 que la precede y se clasifica como «caudal» si su
leyenda menciona caudal; el resto son parámetros fisicoquímicos.

Produce:
    data/perfiles_informe/<rio>_<n>.webp   (ancho máximo 1800 px)
    data/perfiles_informe/manifest.json    (ríos → figuras, con leyenda y tipo)
"""

import io
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

from lxml import etree
from PIL import Image

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "perfiles_informe"
ANCHO_MAX = 1800
CALIDAD_WEBP = 88
ULTIMA_FIGURA = 118

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {
    "w": W,
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "v": "urn:schemas-microsoft-com:vml",
}

# Etiqueta corta de cada figura (miniaturas y pestañas), en el orden en que
# se prueban: la primera expresión que coincide con la leyenda gana.
PARAMETROS = [
    (r"curva de duraci", "Curva de duración"),
    (r"caudal promedio mensual", "Caudal mensual"),
    (r"serie mensual de caudal", "Serie de caudal"),
    (r"caudal", "Caudal"),
    (r"ox[ií]geno disuelto", "Oxígeno disuelto"),
    (r"DBO", "DBO₅"),
    (r"DQO", "DQO"),
    (r"s[óo]lidos suspendidos", "SST"),
    (r"nitratos", "Nitratos"),
    (r"nitr[óo]geno total", "Nitrógeno total"),
    (r"f[óo]sforo total", "Fósforo total"),
    (r"turbiedad", "Turbiedad"),
    (r"\bpH\b", "pH"),
    (r"conductividad", "Conductividad"),
    (r"coliformes", "Coliformes totales"),
]


def texto(el):
    return "".join(t.text or "" for t in el.iter(f"{{{W}}}t"))


def estilo(p):
    s = p.find(f"{{{W}}}pPr/{{{W}}}pStyle")
    return s.get(f"{{{W}}}val") if s is not None else ""


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def parametro(leyenda):
    for patron, etiqueta in PARAMETROS:
        if re.search(patron, leyenda, re.IGNORECASE):
            return etiqueta
    raise ValueError(f"Leyenda sin parámetro reconocido: {leyenda}")


def main(docx_path):
    z = zipfile.ZipFile(docx_path)
    root = etree.fromstring(z.read("word/document.xml"), etree.XMLParser(huge_tree=True))
    rels = etree.fromstring(z.read("word/_rels/document.xml.rels"))
    destino = {r.get("Id"): r.get("Target") for r in rels}

    # Vista aceptada: si el informe trae control de cambios, se ignora lo borrado.
    for x in root.xpath("//w:del[not(parent::w:rPr) and not(parent::w:trPr)]", namespaces=NS):
        x.getparent().remove(x)

    en_cap3 = False
    rio = None
    leyenda = None
    figuras = []
    for el in root.find(f"{{{W}}}body"):
        if el.tag == f"{{{W}}}p":
            t = texto(el).strip()
            s = estilo(el)
            if s.endswith("1") and t.upper().startswith("CAPÍTULO"):
                en_cap3 = t.upper().startswith("CAPÍTULO 3")
            elif en_cap3 and s.endswith("3") and t.startswith("Río "):
                rio = t
            elif en_cap3 and t.startswith("Figura 3."):
                leyenda = t
        if not en_cap3 or not leyenda:
            continue
        blips = el.xpath(".//a:blip/@r:embed", namespaces=NS) + el.xpath(".//v:imagedata/@r:id", namespaces=NS)
        if not blips:
            continue
        m = re.match(r"Figura 3\.(\d+)\.?\s*(.*)", leyenda)
        n = int(m.group(1))
        if n <= ULTIMA_FIGURA:
            if len(blips) != 1:
                raise ValueError(f"La {leyenda} trae {len(blips)} imágenes; se esperaba una")
            figuras.append({"n": n, "rio": rio, "leyenda": leyenda, "media": destino[blips[0]]})
        leyenda = None   # una imagen por leyenda

    numeros = [f["n"] for f in figuras]
    if numeros != list(range(1, ULTIMA_FIGURA + 1)):
        faltan = sorted(set(range(1, ULTIMA_FIGURA + 1)) - set(numeros))
        raise SystemExit(f"FALLA: figuras del Capítulo 3 incompletas o desordenadas (faltan {faltan})")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for viejo in OUT_DIR.glob("*.webp"):
        viejo.unlink()

    rios = {}
    peso = 0
    for f in figuras:
        img = Image.open(io.BytesIO(z.read("word/" + f["media"])))
        img = img.convert("RGB")
        if img.width > ANCHO_MAX:
            img = img.resize((ANCHO_MAX, round(img.height * ANCHO_MAX / img.width)), Image.LANCZOS)
        nombre = f"{slug(f['rio'])}_{f['n']:03d}.webp"
        img.save(OUT_DIR / nombre, "WEBP", quality=CALIDAD_WEBP, method=6)
        peso += (OUT_DIR / nombre).stat().st_size

        tipo = "caudal" if re.search(r"caudal", f["leyenda"], re.IGNORECASE) else "calidad"
        rios.setdefault(f["rio"], []).append({
            "figura": f"3.{f['n']}",
            "leyenda": re.sub(r"^Figura 3\.\d+\.?\s*", "", f["leyenda"]),
            "parametro": parametro(f["leyenda"]),
            "tipo": tipo,
            "archivo": nombre,
        })

    cauca = [r for r in rios if r == "Río Cauca"]
    tributarios = sorted((r for r in rios if r != "Río Cauca"),
                         key=lambda r: unicodedata.normalize("NFD", r).lower())
    manifest = {
        "fuente": f"Informe Fase 1, Capítulo 3 ({Path(docx_path).name})",
        "rios": [{"rio": r, "grupo": "cauca" if r == "Río Cauca" else "tributario", "figuras": rios[r]}
                 for r in cauca + tributarios],
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{len(figuras)} figuras de {len(rios)} ríos → {OUT_DIR.relative_to(ROOT)} ({peso / 1e6:.1f} MB)")
    for r in manifest["rios"]:
        c = sum(f["tipo"] == "caudal" for f in r["figuras"])
        print(f"  {r['rio']:22s} calidad {len(r['figuras']) - c:2d} · caudal {c}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
