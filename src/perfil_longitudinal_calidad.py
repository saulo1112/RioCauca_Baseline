# -*- coding: utf-8 -*-
"""
Genera perfiles longitudinales de calidad del agua y caudal del río Cauca
clasificados por condición hidrológica (Invierno / Transición / Verano),
usando Mediacanoa como estación de referencia para la clasificación.

Estaciones incluidas: 9 estaciones con par hidrométrico confirmado.
Riofrío excluido por ausencia de estación hidrométrica propia.

Se ejecuta UNA SOLA VEZ desde la terminal (raíz del proyecto):
    python src/perfil_longitudinal_calidad.py
"""

import io
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

# ── Rutas ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR      = Path(__file__).resolve().parent
PROJECT_DIR     = SCRIPT_DIR.parent
CALIDAD_FILE    = PROJECT_DIR / "data" / "databases" / "Calidad_del_agua_del_Rio_Cauca_20260604.csv"
CAUDAL_REF_FILE = PROJECT_DIR / "data" / "hydrology" / "MEDICANOA" / "caudal_diario.csv"
HYDROLOGY_DIR   = PROJECT_DIR / "data" / "hydrology"
OUTPUT_DIR      = PROJECT_DIR / "data" / "water_quality" / "perfiles"

DPI            = 180
AÑO_DESDE      = 2015
YLIM_PERCENTIL = 95
PERM_VERANO    = 70
PERM_INVIERNO  = 30

CONDICIONES = ["Verano", "Transición", "Invierno"]
COLOR_COND  = {"Verano": "#B71C1C", "Transición": "#2E7D32", "Invierno": "#1565C0"}
MARKER_COND = {"Verano": "s",       "Transición": "^",       "Invierno": "o"}
LSTYLE_COND = {"Verano": ":",       "Transición": "--",      "Invierno": "-"}
X_OFFSET_COND = {"Verano": -0.08,  "Transición": 0.0,       "Invierno": 0.08}

PARAMETROS = {
    "DBO":      {"col": "DEMANDA BIOQUIMICA DE OXIGENO (mg O2/l)",  "unidad": "mg O₂/L"},
    "DQO":      {"col": "DEMANDA QUIMICA DE OXIGENO (mg O2/l)",     "unidad": "mg O₂/L"},
    "OD":       {"col": "OXIGENO DISUELTO (mg O2/l)",               "unidad": "mg O₂/L"},
    "SST":      {"col": "SOLIDOS SUSPENDIDOS TOTALES (mg SS/l)",    "unidad": "mg/L"},
    "NITRATOS": {"col": "NITRATOS (mg N-NO3/l)",                    "unidad": "mg N/L"},
    "P_TOTAL":  {"col": "FOSFORO TOTAL (mg P/l)",                   "unidad": "mg P/L"},
}

LIMITES_FISICOS = {
    "NITRATOS (mg N-NO3/l)": 15,
}

# ── 9 estaciones con par hidrométrico confirmado (Riofrío excluido) ────────────
ABSCISADOS = {
    "PASO DE LA BALSA":   0.000,
    "LA BOLSA":           51.519,
    "PUENTE HORMIGUERO":  83.100,
    "JUANCHITO":          101.875,
    "PASO DE LA TORRE":   143.379,
    "MEDIACANOA":         201.511,
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
    "PUENTE GUAYABAL":   "Guayabal\n(320.5 km)",
    "LA VICTORIA":       "La Victoria\n(336.5 km)",
    "ANACARO":           "Anacaro\n(389.1 km)",
}
ORDEN_EST = list(ABSCISADOS.keys())

# Par hidrométrico: estación calidad → carpeta en data/hydrology
PAR_HIDROMETRICO = {
    "PASO DE LA BALSA":  "LA BALSA",
    "LA BOLSA":          "LA BOLSA",
    "PUENTE HORMIGUERO": "HORMIGUERO",
    "JUANCHITO":         "JUANCHITO (S HASTA 2017)",
    "PASO DE LA TORRE":  "PASO LA TORRE",
    "MEDIACANOA":        "MEDICANOA",
    "PUENTE GUAYABAL":   "GUAYABAL (HASTA 2022)",
    "LA VICTORIA":       "LA VICTORIA",
    "ANACARO":           "ANACARO",
}

RENOMBRAR_ESTACION = {
    "PASO DE LA BOLSA": "LA BOLSA",
    "RIO FRIO":         "RIOFRIO",
}


# ── Lectura y clasificación ────────────────────────────────────────────────────

def _leer_csv_calidad(path: Path) -> pd.DataFrame:
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
    df = pd.read_csv(CAUDAL_REF_FILE)
    df = df.rename(columns={"CAUDAL_M3S": "CAUDAL_REF"})
    df["FECHA"] = pd.to_datetime(df["FECHA"], errors="coerce")
    df = df.dropna(subset=["FECHA", "CAUDAL_REF"])
    datos = np.sort(df["CAUDAL_REF"].values)[::-1]
    perm  = np.arange(1, len(datos) + 1) / len(datos) * 100
    u_v   = float(np.interp(PERM_VERANO,   perm, datos))
    u_i   = float(np.interp(PERM_INVIERNO, perm, datos))
    return df, u_v, u_i


def clasificar(q, u_v, u_i):
    if pd.isna(q):    return "Sin clasificar"
    if q <= u_v:      return "Verano"
    elif q >= u_i:    return "Invierno"
    else:             return "Transición"


def cargar_datos(df_ref, u_v, u_i) -> pd.DataFrame:
    df = _leer_csv_calidad(CALIDAD_FILE)
    df["FECHA"] = pd.to_datetime(df["FECHA DE MUESTREO"], errors="coerce")
    df["ESTACION_STD"] = (df["ESTACIONES"].str.strip().str.upper()
                          .str.replace(r"\s+", " ", regex=True)
                          .replace(RENOMBRAR_ESTACION))
    df = df[df["FECHA"].dt.year >= AÑO_DESDE].copy()
    df = df[df["FECHA"].notna() & df["ESTACION_STD"].isin(ABSCISADOS)].copy()
    df["ABSCISADO"] = df["ESTACION_STD"].map(ABSCISADOS)

    for info in PARAMETROS.values():
        if info["col"] in df.columns:
            df[info["col"]] = pd.to_numeric(df[info["col"]], errors="coerce")

    for col_name, limite in LIMITES_FISICOS.items():
        if col_name in df.columns:
            mask = df[col_name] > limite
            n = int(mask.sum())
            if n > 0:
                df.loc[mask, col_name] = np.nan
                print(f"   ⚠  {col_name}: {n} valores > {limite} eliminados")

    df["FECHA_DIA"] = df["FECHA"].dt.normalize()
    df_ref["FECHA_DIA"] = df_ref["FECHA"].dt.normalize()
    df = df.merge(
        df_ref[["FECHA_DIA", "CAUDAL_REF"]].drop_duplicates("FECHA_DIA"),
        on="FECHA_DIA", how="left",
    )
    df["CONDICION"] = df["CAUDAL_REF"].apply(lambda q: clasificar(q, u_v, u_i))
    return df


# ── Helpers gráficos ───────────────────────────────────────────────────────────

def _label_x():
    return ("Abscisado (km desde La Balsa)  —  "
            "Fuente: PMC Cuadro. 2.6, Vol. VII (Univ. del Valle - CVC)")


def _nota_pie(fig, u_v, u_i, extra=""):
    nota = (f"Clasificación: Mediacanoa como ref. hidrológica  |  "
            f"Verano ≤{u_v:.0f} m³/s  |  Invierno ≥{u_i:.0f} m³/s  |  "
            f"Fuente: CVC {AÑO_DESDE}–2026")
    if extra:
        nota += f"  |  {extra}"
    fig.text(0.99, 0.005, nota, ha="right", fontsize=6,
             color="#AAAAAA", style="italic")


def _dibujar_etiquetas(ax, puntos, y_cap):
    df_lbl = pd.DataFrame(puntos, columns=["x", "y", "texto", "color", "cond"])
    lbl_x_off = {"Verano": -0.08, "Transición": 0.0, "Invierno": 0.08}
    lbl_y_off = {"Verano": 0.04,  "Transición": 0.08, "Invierno": -0.04}
    y_min, y_max = ax.get_ylim()

    for _, grp in df_lbl.groupby(df_lbl["x"].round(1)):
        for _, row in grp.sort_values("y").iterrows():
            val   = row["y"]
            x_pos = row["x"] + lbl_x_off.get(row["cond"], 0)
            if val > y_max:
                y_pos, va, texto = y_max * 0.97, "top",    f"▲{val:.1f}"
            elif val < y_min:
                y_pos, va, texto = y_min + (y_max - y_min) * 0.03, "bottom", f"▼{val:.1f}"
            else:
                y_pos = val + y_cap * lbl_y_off.get(row["cond"], 0.04)
                va, texto = "bottom", row["texto"]
            ax.text(x_pos, y_pos, texto, ha="center", va=va,
                    fontsize=7.5, color=row["color"],
                    fontweight="bold", clip_on=False, zorder=5)


def _base_figura(titulo):
    fig, ax = plt.subplots(figsize=(12.6, 5.8))
    fig.patch.set_facecolor("#F7F9FC")
    ax.set_facecolor("#F7F9FC")
    ax.set_title(titulo, fontsize=11, fontweight="bold", pad=12, color="#1A1A2E")
    for idx in range(len(ORDEN_EST)):
        ax.axvline(idx, color="#DDDDDD", linewidth=0.6, zorder=1)
    ax.set_xticks(range(len(ORDEN_EST)))
    ax.set_xticklabels([NOMBRES_CORTOS[e] for e in ORDEN_EST],
                       fontsize=8.5, ha="center", linespacing=1.1)
    ax.set_xlim(-0.5, len(ORDEN_EST) - 0.5)
    ax.set_xlabel(_label_x(), fontsize=8, labelpad=8, color="#666666")
    ax.tick_params(axis="x", pad=4)
    ax.grid(axis="y", linestyle="--", alpha=0.35, zorder=0)
    return fig, ax


# ── Perfil de calidad ──────────────────────────────────────────────────────────

def graficar_condicion(df, abrev, info, u_v, u_i):
    col    = info["col"]
    unidad = info["unidad"]
    if col not in df.columns:
        print(f"  ⚠  {abrev}: columna ausente")
        return None

    camp_count = df.groupby("CONDICION")["FECHA_DIA"].nunique().to_dict()
    EST_IDX    = {est: i for i, est in enumerate(ORDEN_EST)}

    resumen = (df.groupby(["ESTACION_STD", "CONDICION"])[col]
                 .agg(["mean", "std", "count", "min", "max"])
                 .reset_index()
                 .rename(columns={"mean": "MEDIA", "count": "N",
                                  "min": "MIN",    "max": "MAX"}))
    resumen = resumen[(resumen["N"] >= 2) & resumen["CONDICION"].isin(CONDICIONES)]
    resumen["IDX"] = resumen["ESTACION_STD"].map(EST_IDX)
    if resumen.empty:
        print(f"  ⚠  {abrev}: sin datos suficientes")
        return None

    y_cap = float(np.nanpercentile(df[col].dropna(), YLIM_PERCENTIL))

    titulo = (f"Perfil Longitudinal de {abrev} — Río Cauca  ({AÑO_DESDE}–2026)\n"
              f"Por condición hidrológica  |  Ref: Mediacanoa  |  "
              f"Banda = rango máximo–mínimo")
    fig, ax = _base_figura(titulo)

    puntos = []
    for cond in CONDICIONES:
        sub = resumen[resumen["CONDICION"] == cond].sort_values("IDX")
        if sub.empty:
            continue
        c       = COLOR_COND[cond]
        n       = camp_count.get(cond, 0)
        x_plot  = sub["IDX"] + X_OFFSET_COND.get(cond, 0)
        ax.plot(x_plot, sub["MEDIA"], color=c, linestyle=LSTYLE_COND[cond],
                linewidth=2, marker=MARKER_COND[cond], markersize=7,
                markerfacecolor="white", markeredgecolor=c, markeredgewidth=2,
                zorder=4, label=f"{cond}  (n={n} campañas)")
        ax.fill_between(x_plot, sub["MIN"].clip(lower=0),
                        sub["MAX"].clip(upper=y_cap),
                        alpha=0.10, color=c, zorder=2)
        for (_, r), xv in zip(sub.iterrows(), x_plot):
            puntos.append((xv, r["MEDIA"], f"{r['MEDIA']:.1f}", c, cond))

    ax.set_ylim(0, y_cap * 1.36)
    ax.set_ylabel(f"{abrev} ({unidad})", fontsize=10, labelpad=8)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.1f}"))
    ax.legend(fontsize=9, title="Condición hidrológica",
              title_fontsize=9, loc="best", framealpha=0.85)
    _dibujar_etiquetas(ax, puntos, y_cap)

    n_out = int((df[col].dropna() > y_cap).sum())
    _nota_pie(fig, u_v, u_i, f"✂ {n_out} outliers fuera del eje" if n_out else "")
    fig.tight_layout()
    fig.subplots_adjust(bottom=0.16)
    out = OUTPUT_DIR / f"perfil_{abrev}_condicion.png"
    fig.savefig(out, dpi=DPI, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  ✔  {abrev:10s} → {out.name}")
    return out


# ── Perfil de caudal ───────────────────────────────────────────────────────────

# Períodos trienales y sus estilos de línea
PERIODOS_CAUDAL = {
    "2015–2018": (2015, 2018),
    "2019–2022": (2019, 2022),
    "2023–2026": (2023, 2026),
}
LSTYLE_PERIODO = {
    "2015–2018": "-",
    "2019–2022": "--",
    "2023–2026": ":",
}
MARKER_PERIODO = {
    "2015–2018": "o",
    "2019–2022": "^",
    "2023–2026": "s",
}


def graficar_caudal(u_v, u_i):
    """
    Perfil longitudinal de caudal por trienio y condición hidrológica.
    Genera 9 series: 3 períodos × 3 condiciones (Invierno/Transición/Verano).
    Color por condición, estilo de línea por período — igual que la Fig. 3.3
    del informe de referencia PMC.
    """
    EST_IDX = {est: i for i, est in enumerate(ORDEN_EST)}

    def periodo_label(año):
        for lbl, (ini, fin) in PERIODOS_CAUDAL.items():
            if ini <= año <= fin:
                return lbl
        return None

    resumen_rows = []
    for est_cal, carpeta in PAR_HIDROMETRICO.items():
        csv_path = HYDROLOGY_DIR / carpeta / "caudal_diario.csv"
        if not csv_path.exists():
            print(f"  ⚠  No encontrado: {carpeta}/caudal_diario.csv")
            continue
        df_q = pd.read_csv(csv_path)
        df_q["FECHA"]   = pd.to_datetime(df_q["FECHA"], errors="coerce")
        df_q = df_q.dropna(subset=["FECHA", "CAUDAL_M3S"])
        df_q["AÑO"]     = df_q["FECHA"].dt.year
        df_q["PERIODO"] = df_q["AÑO"].apply(periodo_label)
        df_q = df_q[df_q["PERIODO"].notna() & (df_q["AÑO"] >= AÑO_DESDE)]
        if df_q.empty:
            continue
        df_q["CONDICION"] = df_q["CAUDAL_M3S"].apply(
            lambda q: clasificar(q, u_v, u_i))
        for (per, cond), grp in df_q.groupby(["PERIODO", "CONDICION"]):
            if cond not in CONDICIONES:
                continue
            resumen_rows.append({
                "ESTACION_STD": est_cal,
                "PERIODO":      per,
                "CONDICION":    cond,
                "MEDIA":        grp["CAUDAL_M3S"].mean(),
                "N":            len(grp),
            })

    if not resumen_rows:
        print("  ⚠  Caudal: sin datos disponibles")
        return None

    resumen = pd.DataFrame(resumen_rows)
    resumen["IDX"] = resumen["ESTACION_STD"].map(EST_IDX)

    titulo = (f"Perfil Longitudinal de Caudal — Río Cauca  ({AÑO_DESDE}–2026)\n"
              f"Por condición hidrológica y período trienal  |  "
              f"Ref: Mediacanoa (umbrales por estación)")
    fig, ax = _base_figura(titulo)
    # Ampliar el xlim para que Anacaro no quede cortado
    ax.set_xlim(-0.6, len(ORDEN_EST) - 0.4)

    # Offset horizontal: separar condiciones dentro del mismo índice
    X_OFF_COND_Q = {"Invierno": -0.08, "Transición": 0.0, "Verano": 0.08}

    puntos = []
    for per in PERIODOS_CAUDAL:
        for cond in CONDICIONES:
            sub = (resumen[(resumen["PERIODO"] == per) &
                           (resumen["CONDICION"] == cond)]
                   .sort_values("IDX"))
            if sub.empty:
                continue
            c      = COLOR_COND[cond]
            x_plot = sub["IDX"] + X_OFF_COND_Q.get(cond, 0)
            lbl    = f"{cond} — {per}" if cond == CONDICIONES[0] else f"— {per}"
            ax.plot(x_plot, sub["MEDIA"],
                    color=c,
                    linestyle=LSTYLE_PERIODO[per],
                    linewidth=1.8,
                    marker=MARKER_PERIODO[per],
                    markersize=6,
                    markerfacecolor="white",
                    markeredgecolor=c,
                    markeredgewidth=1.8,
                    zorder=4,
                    label=f"{cond}  {per}")
            for (_, r), xv in zip(sub.iterrows(), x_plot):
                puntos.append((xv, r["MEDIA"], f"{r['MEDIA']:.0f}", c, cond, per))

    # Escala más ajustada: 20% sobre el máximo real
    y_max_plot = resumen["MEDIA"].max() * 1.20
    ax.set_ylim(0, y_max_plot)
    ax.set_ylabel("Caudal promedio (m³/s)", fontsize=10, labelpad=8)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{x:.0f}"))

    # Leyenda en dos columnas: condición × período
    import matplotlib.lines as mlines
    import matplotlib.patches as mpatches
    handles = []
    for cond in CONDICIONES:
        handles.append(mlines.Line2D([], [], color=COLOR_COND[cond],
                                     linewidth=2, label=cond))
    handles.append(mpatches.Patch(color="none", label=""))
    for per, ls in LSTYLE_PERIODO.items():
        handles.append(mlines.Line2D([], [], color="gray",
                                     linestyle=ls, linewidth=1.8,
                                     marker=MARKER_PERIODO[per], markersize=6,
                                     markerfacecolor="white",
                                     label=per))
    ax.legend(handles=handles, fontsize=8.5, ncol=2,
              title="Condición  |  Período",
              title_fontsize=8.5, loc="upper left", framealpha=0.85)

    # Etiquetas: solo mostrar la condición Invierno (valores más altos y espaciados)
    # y Verano (valores más bajos). Transición se omite para despejar la gráfica.
    # Dentro de cada condición, solo etiquetar el período más reciente (2023-2026)
    # para evitar acumulación de números en el mismo punto.
    y_min_ax, y_max_ax = ax.get_ylim()
    rango = y_max_ax - y_min_ax

    # Agrupar por (x_redondeada, cond) y mostrar solo el valor de cada período
    # con offsets escalonados fijos y fuente pequeña
    OFF_COND = {"Invierno": 0.06, "Transición": 0.0, "Verano": -0.06}
    OFF_PER  = {"2015–2018": -rango*0.06, "2019–2022": 0, "2023–2026": rango*0.07}

    for xv, val, texto, color, cond, per in puntos:
        y_pos = val + OFF_COND.get(cond, 0) * rango + OFF_PER.get(per, 0)
        va = "bottom"
        if y_pos > y_max_ax * 0.96:
            y_pos = y_max_ax * 0.95
            va = "top"
        elif y_pos < y_min_ax + rango * 0.02:
            y_pos = y_min_ax + rango * 0.03
            va = "bottom"
        ax.text(xv, y_pos, texto, ha="center", va=va,
                fontsize=6.0, color=color, fontweight="bold",
                clip_on=False, zorder=5,
                bbox=dict(boxstyle="round,pad=0.05", fc="white",
                          ec="none", alpha=0.5))

    nota = (f"Umbrales calculados con curva de duración de caudales "
            f"(percentil 30%/70%) por estación  |  Fuente: CVC {AÑO_DESDE}–2026")
    fig.text(0.99, 0.005, nota, ha="right", fontsize=6,
             color="#AAAAAA", style="italic")
    fig.tight_layout()
    fig.subplots_adjust(bottom=0.16)
    out = OUTPUT_DIR / "perfil_CAUDAL_condicion.png"
    fig.savefig(out, dpi=DPI, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  ✔  CAUDAL     → {out.name}")
    return out


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    if not CALIDAD_FILE.exists():
        raise FileNotFoundError(f"No se encontró '{CALIDAD_FILE}'")
    if not CAUDAL_REF_FILE.exists():
        raise FileNotFoundError(
            f"No se encontró '{CAUDAL_REF_FILE}'\n"
            f"Ejecuta primero src/build_hydro_data.py")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"📄 Leyendo caudales de referencia (Mediacanoa)...")
    df_caud, u_v, u_i = leer_caudal_referencia()
    print(f"   → {len(df_caud):,} días | Verano ≤{u_v:.1f} | Invierno ≥{u_i:.1f} m³/s")

    print(f"\n📄 Leyendo calidad del agua...")
    df = cargar_datos(df_caud, u_v, u_i)
    camp = df.groupby("CONDICION")["FECHA_DIA"].nunique()
    print(f"\n   Campañas clasificadas ({df['FECHA_DIA'].nunique()} total):")
    for cond, n in camp.items():
        print(f"     {cond:15s}: {n}")

    print(f"\n📊 Generando perfiles de calidad del agua:\n")
    generados = []
    for abrev, info in PARAMETROS.items():
        out = graficar_condicion(df, abrev, info, u_v, u_i)
        if out:
            generados.append(out)

    print(f"\n📊 Generando perfil de caudal:\n")
    out_q = graficar_caudal(u_v, u_i)
    if out_q:
        generados.append(out_q)

    print(f"\n✅ {len(generados)} gráficas guardadas en {OUTPUT_DIR}")
    for p in generados:
        print(f"   {p.name}")


if __name__ == "__main__":
    main()