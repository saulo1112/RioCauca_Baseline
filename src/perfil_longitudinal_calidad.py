# -*- coding: utf-8 -*-
"""
Genera perfiles longitudinales de calidad del agua del río Cauca
clasificados por condición hidrológica (Invierno / Transición / Verano),
usando Mediacanoa como estación de referencia para la clasificación.

Se ejecuta UNA SOLA VEZ desde la terminal (raíz del proyecto):

    python src/perfil_longitudinal_calidad.py

Metodología:
    - Para cada campaña de monitoreo se busca el caudal promedio diario
      de Mediacanoa en esa fecha
    - Con la curva de duración de caudales de Mediacanoa (percentil 30%/70%)
      se clasifica la campaña completa como Invierno, Transición o Verano
    - Se grafican los promedios de cada parámetro por condición hidrológica

Por cada parámetro genera dos gráficas en data/water_quality/perfiles/:
  1. perfil_<PARAM>_condicion.png  — promedio por condición hidrológica
  2. perfil_<PARAM>_boxplot.png    — distribución por condición (box plot)

Parámetros: DBO, DQO, OD, SST, Nitratos, Fósforo Total

Notas de calidad de datos:
    - NITRATOS: registros de las campañas de julio y agosto 2022 tienen
      valores físicamente imposibles (hasta 150,000,000 mg/L vs máx normal
      de ~5 mg/L). Se filtran automáticamente con límite de 15 mg/L.
      Origen probable: error de unidades o digitación en la fuente CVC.

Requiere:
    pip install pandas openpyxl matplotlib numpy
"""

import io
import sys
from pathlib import Path

# La consola de Windows usa cp1252 por defecto; forzar UTF-8 para los prints.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

# ── Rutas (relativas a la raíz del proyecto) ───────────────────────────────────
SCRIPT_DIR  = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
CALIDAD_FILE    = PROJECT_DIR / "data" / "databases" / "Calidad_del_agua_del_Rio_Cauca_20260604.csv"
CAUDAL_REF_FILE = PROJECT_DIR / "data" / "hydrology" / "MEDICANOA" / "caudal_diario.csv"
OUTPUT_DIR      = PROJECT_DIR / "data" / "water_quality" / "perfiles"

DPI               = 180
AÑO_DESDE         = 2015
YLIM_PERCENTIL    = 95
PERM_VERANO       = 70
PERM_INVIERNO     = 30

# Condiciones hidrológicas
CONDICIONES = ["Verano", "Transición", "Invierno"]
COLOR_COND  = {"Verano": "#B71C1C", "Transición": "#2E7D32", "Invierno": "#1565C0"}
MARKER_COND = {"Verano": "s",        "Transición": "^",        "Invierno": "o"}
LSTYLE_COND = {"Verano": ":",        "Transición": "--",        "Invierno": "-"}

# Desplazamiento horizontal leve para evitar superposición entre series.
# Con eje de índices (espaciado 1), el offset es proporcional al espaciado.
X_OFFSET_COND = {
    "Verano":     -0.08,
    "Transición":  0.0,
    "Invierno":    0.08,
}

# Parámetros con cobertura suficiente
PARAMETROS = {
    "DBO":      {"col": "DEMANDA BIOQUIMICA DE OXIGENO (mg O2/l)",  "unidad": "mg O₂/L"},
    "DQO":      {"col": "DEMANDA QUIMICA DE OXIGENO (mg O2/l)",     "unidad": "mg O₂/L"},
    "OD":       {"col": "OXIGENO DISUELTO (mg O2/l)",               "unidad": "mg O₂/L"},
    "SST":      {"col": "SOLIDOS SUSPENDIDOS TOTALES (mg SS/l)",    "unidad": "mg/L"},
    "NITRATOS": {"col": "NITRATOS (mg N-NO3/l)",                    "unidad": "mg N/L"},
    "P_TOTAL":  {"col": "FOSFORO TOTAL (mg P/l)",                   "unidad": "mg P/L"},
}

# ── Límites físicos por parámetro ──────────────────────────────────────────────
# Valores por encima de estos límites se consideran errores en la fuente.
LIMITES_FISICOS = {
    "NITRATOS (mg N-NO3/l)": 15,
}

# Abscisados desde La Balsa (km 0)
# Fuente: Figura 6.1, Vol. VIII, Informe PMC (Univ. del Valle - CVC)
ABSCISADOS = {
    "PASO DE LA BALSA":   0.000,
    "LA BOLSA":           51.519,
    "PUENTE HORMIGUERO":  83.100,
    "JUANCHITO":          101.875,
    "PASO DE LA TORRE":   143.379,
    "MEDIACANOA":         201.511,
    "RIOFRIO":            237.384,   # sin par hidrométrico — usa Mediacanoa como ref.
    "PUENTE GUAYABAL":    320.451,
    "LA VICTORIA":        336.490,
    "ANACARO":            389.130,
}
NOMBRES_CORTOS = {
    "PASO DE LA BALSA":  "P. Balsa\n(0 km)",
    "LA BOLSA":          "La Bolsa\n(51.5 km)",
    "PUENTE HORMIGUERO": "Pte. Hormiguero\n(83.1 km)",
    "JUANCHITO":         "Juanchito\n(101.9 km)",
    "PASO DE LA TORRE":  "P. Torre\n(143.4 km)",
    "MEDIACANOA":        "Mediacanoa\n(201.5 km)",
    "RIOFRIO":           "Riofrío\n(237.4 km)",
    "PUENTE GUAYABAL":   "Guayabal\n(320.5 km)",
    "LA VICTORIA":       "La Victoria\n(336.5 km)",
    "ANACARO":           "Anacaro\n(389.1 km)",
}
ORDEN_EST = list(ABSCISADOS.keys())

# Normalización de nombres del CSV → clave de ABSCISADOS.
# El CSV usa "PASO DE LA BOLSA" para la estación que aquí se llama "LA BOLSA",
# y ocasionalmente "RIO FRIO" (con espacio) en lugar de "RIOFRIO".
# Se aplica DESPUÉS de colapsar espacios y pasar a mayúsculas.
RENOMBRAR_ESTACION = {
    "PASO DE LA BOLSA": "LA BOLSA",
    "RIO FRIO":         "RIOFRIO",
}


# ───────────────────────────────────────────────────────────────────────────────


def _leer_csv_calidad(path: Path) -> pd.DataFrame:
    """Lee el CSV de calidad del agua, manejando el formato 'envuelto'
    (toda la fila dentro de comillas externas con comillas internas dobladas)."""
    raw = path.read_text(encoding="utf-8-sig")
    primera = raw.lstrip().split("\n")[0].strip()
    if primera.startswith('"FECHA DE MUESTREO,'):
        out = []
        for ln in raw.split("\n"):
            t = ln.strip()
            if not t:
                continue
            if t.startswith('"') and t.endswith('"'):
                t = t[1:-1].replace('""', '"')
            out.append(t)
        raw = "\n".join(out)
        print("   ⚠  Formato CSV envuelto detectado — normalizado")
    return pd.read_csv(io.StringIO(raw))


def leer_caudal_referencia():
    """Lee el caudal diario de Mediacanoa (CSV generado) y calcula los
    umbrales Verano/Invierno de su curva de duración de caudales."""
    df_caud = pd.read_csv(CAUDAL_REF_FILE)
    df_caud = df_caud.rename(columns={"CAUDAL_M3S": "CAUDAL_REF"})
    df_caud["FECHA"] = pd.to_datetime(df_caud["FECHA"], errors="coerce")
    df_caud = df_caud.dropna(subset=["FECHA", "CAUDAL_REF"])

    datos = np.sort(df_caud["CAUDAL_REF"].values)[::-1]
    permanencia = np.arange(1, len(datos) + 1) / len(datos) * 100
    u_v = float(np.interp(PERM_VERANO,   permanencia, datos))
    u_i = float(np.interp(PERM_INVIERNO, permanencia, datos))
    return df_caud, u_v, u_i


def clasificar_campana(caudal, u_v, u_i) -> str:
    if pd.isna(caudal):   return "Sin clasificar"
    if caudal <= u_v:     return "Verano"
    elif caudal >= u_i:   return "Invierno"
    else:                 return "Transición"


def cargar_datos(df_caud_ref, u_v, u_i) -> pd.DataFrame:
    df = _leer_csv_calidad(CALIDAD_FILE)
    df["FECHA"] = pd.to_datetime(df["FECHA DE MUESTREO"], errors="coerce")

    # Normalizar nombre de estación: trim + mayúsculas + colapsar espacios,
    # luego aplicar el mapa de renombres (PASO DE LA BOLSA → LA BOLSA, etc.)
    df["ESTACION_STD"] = (df["ESTACIONES"].str.strip().str.upper()
                            .str.replace(r"\s+", " ", regex=True)
                            .replace(RENOMBRAR_ESTACION))

    df = df[df["FECHA"].dt.year >= AÑO_DESDE].copy()
    df = df[df["FECHA"].notna() & df["ESTACION_STD"].isin(ABSCISADOS)].copy()
    df["ABSCISADO"] = df["ESTACION_STD"].map(ABSCISADOS)

    # Convertir parámetros a numérico
    for info in PARAMETROS.values():
        if info["col"] in df.columns:
            df[info["col"]] = pd.to_numeric(df[info["col"]], errors="coerce")

    # ── Filtro de límites físicos ──────────────────────────────────────────────
    total_filtrados = 0
    for col_name, limite in LIMITES_FISICOS.items():
        if col_name in df.columns:
            mask = df[col_name] > limite
            n = int(mask.sum())
            if n > 0:
                df.loc[mask, col_name] = np.nan
                total_filtrados += n
                print(f"   ⚠  {col_name}: {n} valores > {limite} eliminados "
                      f"(error en fuente CVC — campañas jul/ago 2022)")
    if total_filtrados == 0:
        print("   ✔  Sin valores anómalos detectados")

    # ── Cruzar con caudal de Mediacanoa ───────────────────────────────────────
    df["FECHA_DIA"] = df["FECHA"].dt.normalize()
    df_caud_ref["FECHA_DIA"] = df_caud_ref["FECHA"].dt.normalize()
    df = df.merge(
        df_caud_ref[["FECHA_DIA", "CAUDAL_REF"]].drop_duplicates("FECHA_DIA"),
        on="FECHA_DIA", how="left",
    )
    df["CONDICION"] = df["CAUDAL_REF"].apply(
        lambda q: clasificar_campana(q, u_v, u_i)
    )
    return df


def _label_x():
    return ("Abscisado (km desde La Balsa)  —  "
            "Fuente: PMC Fig. 6.1, Vol. VIII (Univ. del Valle - CVC)")


def _nota_pie(fig, u_v, u_i, texto_extra=""):
    nota = (f"Clasificación: Mediacanoa como ref. hidrológica  |  "
            f"Verano ≤{u_v:.0f} m³/s  |  Invierno ≥{u_i:.0f} m³/s  |  "
            f"Fuente: CVC {AÑO_DESDE}–2026")
    if texto_extra:
        nota += f"  |  {texto_extra}"
    fig.text(0.99, 0.005, nota, ha="right", fontsize=6,
             color="#AAAAAA", style="italic")


# ── Gráfica 1: Promedio por condición hidrológica ─────────────────────────────
def graficar_condicion(df, abrev, info, u_v, u_i):
    col    = info["col"]
    unidad = info["unidad"]

    if col not in df.columns:
        print(f"  ⚠  {abrev} condición: columna ausente")
        return None

    camp_count = df.groupby("CONDICION")["FECHA_DIA"].nunique().to_dict()

    # Índice ordinal de cada estación (posición X en el gráfico)
    EST_IDX = {est: i for i, est in enumerate(ORDEN_EST)}

    resumen = (df.groupby(["ESTACION_STD", "CONDICION"])[col]
                 .agg(["mean", "std", "count", "min", "max"])
                 .reset_index()
                 .rename(columns={"mean": "MEDIA", "std": "STD",
                                  "count": "N", "min": "MIN", "max": "MAX"}))
    resumen = resumen[resumen["N"] >= 2]
    resumen = resumen[resumen["CONDICION"].isin(CONDICIONES)]
    resumen["IDX"] = resumen["ESTACION_STD"].map(EST_IDX)

    if resumen.empty:
        print(f"  ⚠  {abrev} condición: sin datos suficientes")
        return None

    y_cap = float(np.nanpercentile(df[col].dropna(), YLIM_PERCENTIL))

    fig, ax = plt.subplots(figsize=(12.6, 5.8))
    fig.patch.set_facecolor("#F7F9FC")
    ax.set_facecolor("#F7F9FC")

    puntos = []
    for cond in CONDICIONES:
        sub = resumen[resumen["CONDICION"] == cond].sort_values("IDX")
        if sub.empty:
            continue

        c        = COLOR_COND[cond]
        n        = camp_count.get(cond, 0)
        x_offset = X_OFFSET_COND.get(cond, 0.0)
        x_plot   = sub["IDX"] + x_offset

        ax.plot(x_plot, sub["MEDIA"],
                color=c, linestyle=LSTYLE_COND[cond], linewidth=2,
                marker=MARKER_COND[cond], markersize=7,
                markerfacecolor="white", markeredgecolor=c,
                markeredgewidth=2, zorder=4,
                label=f"{cond}  (n={n} campañas)")

        ax.fill_between(x_plot,
                        sub["MIN"].clip(lower=0),
                        sub["MAX"].clip(upper=y_cap),
                        alpha=0.10, color=c, zorder=2)

        for (_, r), x_val in zip(sub.iterrows(), x_plot):
            puntos.append((x_val, r["MEDIA"], f"{r['MEDIA']:.1f}", c, cond))

    # Etiquetas: offset horizontal/vertical fijo por condición para evitar solape
    df_lbl = pd.DataFrame(puntos, columns=["x", "y", "texto", "color", "cond"])
    lbl_x_off = {"Verano": -0.08, "Transición": 0.0, "Invierno": 0.08}
    lbl_y_off = {"Verano": 0.04, "Transición": 0.08, "Invierno": -0.04}

    for _, grp in df_lbl.groupby(df_lbl["x"].round(1)):
        grp = grp.sort_values("y").reset_index(drop=True)
        y_range = y_cap
        for _, row in grp.iterrows():
            y_off_frac = lbl_y_off.get(row["cond"], 0.04)
            y_pos = row["y"] + y_range * y_off_frac
            x_pos = row["x"] + lbl_x_off.get(row["cond"], 0)
            ax.text(x_pos, y_pos, row["texto"],
                    ha="center", va="bottom",
                    fontsize=7.5, color=row["color"],
                    fontweight="bold", clip_on=True, zorder=5)

    for idx in range(len(ORDEN_EST)):
        ax.axvline(idx, color="#DDDDDD", linewidth=0.6, zorder=1)

    ax.set_xticks(range(len(ORDEN_EST)))
    ax.set_xticklabels([NOMBRES_CORTOS[e] for e in ORDEN_EST],
                       fontsize=8.5, ha="center", linespacing=1.1)

    ax.set_xlim(-0.5, len(ORDEN_EST) - 0.5)
    ax.set_ylim(0, y_cap * 1.36)
    ax.set_ylabel(f"{abrev} ({unidad})", fontsize=10, labelpad=8)
    ax.set_xlabel(_label_x(), fontsize=8, labelpad=8, color="#666666")
    ax.tick_params(axis="x", pad=4)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.1f}"))
    ax.grid(axis="y", linestyle="--", alpha=0.35, zorder=0)
    ax.legend(fontsize=9, title="Condición hidrológica",
              title_fontsize=9, loc="best", framealpha=0.85)

    # Advertencia si alguna estación tiene series cortas (N < 5)
    series_cortas = resumen[resumen["N"] < 5]
    aviso_series = ("  ⚠ algunas estaciones con series cortas (n<5)"
                    if not series_cortas.empty else "")

    ax.set_title(
        f"Perfil Longitudinal de {abrev} — Río Cauca  ({AÑO_DESDE}–2026)\n"
        f"Por condición hidrológica  |  Ref: Mediacanoa  |  "
        f"Banda = rango máximo–mínimo" + aviso_series,
        fontsize=11, fontweight="bold", pad=12, color="#1A1A2E")

    n_out = int((df[col].dropna() > y_cap).sum())
    _nota_pie(fig, u_v, u_i, f"✂ {n_out} outliers fuera del eje" if n_out else "")
    fig.tight_layout()
    fig.subplots_adjust(bottom=0.16)
    out = OUTPUT_DIR / f"perfil_{abrev}_condicion.png"
    fig.savefig(out, dpi=DPI, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  ✔  {abrev:10s} condición → {out.name}")
    return out


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    if not CALIDAD_FILE.exists():
        raise FileNotFoundError(f"No se encontró '{CALIDAD_FILE}'")
    if not CAUDAL_REF_FILE.exists():
        raise FileNotFoundError(
            f"No se encontró '{CAUDAL_REF_FILE}'\n"
            f"Ejecuta primero src/build_hydro_data.py para generar el caudal de Mediacanoa")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"📄 Leyendo caudales de referencia: {CAUDAL_REF_FILE.name} ...")
    df_caud, u_v, u_i = leer_caudal_referencia()
    print(f"   → {len(df_caud):,} caudales diarios")
    print(f"   → Umbral Verano     ≤ {u_v:.1f} m³/s")
    print(f"   → Umbral Transición:  {u_v:.1f} – {u_i:.1f} m³/s")
    print(f"   → Umbral Invierno   ≥ {u_i:.1f} m³/s")

    print(f"\n📄 Leyendo calidad del agua: {CALIDAD_FILE.name} ...")
    df = cargar_datos(df_caud, u_v, u_i)

    camp_class = df.groupby("CONDICION")["FECHA_DIA"].nunique()
    print(f"\n   Clasificación de {df['FECHA_DIA'].nunique()} campañas:")
    for cond, n in camp_class.items():
        print(f"     {cond:15s}: {n} campañas")

    print(f"\n📊 Generando gráficas:\n")
    generados = []
    for abrev, info in PARAMETROS.items():
        out = graficar_condicion(df, abrev, info, u_v, u_i)
        if out is not None:
            generados.append(out)

    print(f"\n✅ Listo. {len(generados)} gráficas guardadas en {OUTPUT_DIR}\n")
    print("Archivos generados:")
    for p in generados:
        print(f"   {p.resolve()}")


if __name__ == "__main__":
    main()
