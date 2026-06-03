"""
prepare_data.py — Transformación de datos CARDER/CVC → formato app web
Proyecto 890K | UAO × ASOCAÑA | Fase I — Línea Base Calidad Agua

Ejecutar UNA VEZ localmente antes de cada actualización de datos:
    cd Rio_Cauca_Baseline
    python scripts/prepare_data.py

Genera en data/:
    calidad_agua.csv     — perfil de calidad (formato ancho, 18 filas)
    hidrometria.csv      — estadísticos de caudal por cuerpo de agua
    caudales_cdc.csv     — curvas de duración de caudales (CARDER)

Requiere:
    pip install pandas openpyxl

Fuentes (rutas relativas al directorio Fase I):
    ERA_MinMedMax_Perfiles_Calidad_2026-04-08.csv  → calidad_agua.csv
    ERA_CDC_2026-04-08.csv                         → caudales_cdc.csv
    Q_Especificos CARDER_2026-04-08.csv            → hidrometria.csv
"""

import pandas as pd
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent          # Rio_Cauca_Baseline/
DATA_DIR = BASE_DIR / "data"
FUENTES  = BASE_DIR.parent / "Derechos de petición"

# ── Mapeo de nombres de parámetros CARDER → columnas de la app ─────────────
PARAM_MAP = {
    "DQO (mg/L)":                    "DQO",
    "DBO (mg/L)":                    "DBO5",
    "SST (mg/L)":                    "SST",
    "OD (mg/L)":                     "OD",
    "Nitrogeno Total (mgN/L)":       "NT",
    "Fosforo Total (mg/L)":          "PT",
    "ICA-5 [IDEAM]":                 "ICA5",
}

# ── Mapeo de nombres de corriente → tipo y tramo ───────────────────────────
CUERPO_META = {
    # Tributarios
    "Rio Consota":      {"TIPO_CUERPO": "Tributario", "TRAMO_O_RIO": "Risaralda"},
    "Rio Otun":         {"TIPO_CUERPO": "Tributario", "TRAMO_O_RIO": "Risaralda"},
    "Rio Barbas":       {"TIPO_CUERPO": "Tributario", "TRAMO_O_RIO": "Risaralda"},
    "Rio La Vieja":     {"TIPO_CUERPO": "Tributario", "TRAMO_O_RIO": "Risaralda"},
    "Rio Risaralda":    {"TIPO_CUERPO": "Tributario", "TRAMO_O_RIO": "Risaralda"},
}


def load_calidad():
    """
    Transforma ERA_MinMedMax_Perfiles_Calidad (formato largo) →
    formato ancho con columnas {PARAM}_min / _med / _max por corriente.
    """
    path = FUENTES / "ERA_MinMedMax_Perfiles_Calidad_2026-04-08.csv"
    if not path.exists():
        print(f"  [SKIP] No encontrado: {path}")
        return None

    print(f"  Leyendo {path.name}...")
    df = pd.read_csv(path, encoding="utf-8-sig")
    df.columns = df.columns.str.strip()

    # Normalizar parámetros al mapeo
    df["PARAM_NORM"] = df["Parametro"].str.strip().map(PARAM_MAP)
    df = df[df["PARAM_NORM"].notna()].copy()

    # Limpiar valores ICA-5 que vienen como "0.73 (Aceptable)" → 0.73
    for col in ["Minimo", "Medio", "Maximo"]:
        df[col] = (
            df[col].astype(str)
            .str.extract(r"([\d.]+)")[0]
            .astype(float)
        )

    # Pivot: una fila por Corriente, columnas {PARAM}_{min,med,max}
    rows = []
    for corriente, grp in df.groupby("Corriente"):
        row = {"CUERPO_AGUA": corriente}
        for _, prow in grp.iterrows():
            p = prow["PARAM_NORM"]
            row[f"{p}_min"] = round(prow["Minimo"], 3)
            row[f"{p}_med"] = round(prow["Medio"], 3)
            row[f"{p}_max"] = round(prow["Maximo"], 3)
        meta = CUERPO_META.get(corriente, {
            "TIPO_CUERPO": "Tributario", "TRAMO_O_RIO": corriente
        })
        row.update(meta)
        row["FUENTE"]      = "CARDER"
        row["ESTADO_DATO"] = "ERA 2026-04-08"
        rows.append(row)

    out = pd.DataFrame(rows)
    # Reordenar columnas
    meta_cols = ["CUERPO_AGUA", "TIPO_CUERPO", "TRAMO_O_RIO"]
    param_cols = []
    for p in ["DBO5", "DQO", "SST", "OD", "NT", "PT", "ICA5"]:
        for s in ["min", "med", "max"]:
            c = f"{p}_{s}"
            if c in out.columns:
                param_cols.append(c)
    tail_cols = ["FUENTE", "ESTADO_DATO"]
    out = out.reindex(columns=meta_cols + param_cols + tail_cols, fill_value=None)

    out_path = DATA_DIR / "calidad_agua.csv"
    out.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"  ✓ calidad_agua.csv — {len(out)} filas, {len(out.columns)} columnas")
    return out


def load_cdc():
    """
    Copia ERA_CDC tal cual a data/caudales_cdc.csv (ya está en formato correcto).
    """
    path = FUENTES / "ERA_CDC_2026-04-08.csv"
    if not path.exists():
        print(f"  [SKIP] No encontrado: {path}")
        return None

    print(f"  Leyendo {path.name}...")
    df = pd.read_csv(path, encoding="utf-8-sig")
    df.columns = df.columns.str.strip()

    out_path = DATA_DIR / "caudales_cdc.csv"
    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    unidades = df["Unidad"].nunique() if "Unidad" in df.columns else "?"
    print(f"  ✓ caudales_cdc.csv — {len(df)} filas, {unidades} unidades hidrográficas")
    return df


def load_hidrometria(df_cdc=None):
    """
    Genera hidrometria.csv con estadísticos Q por unidad hidrográfica.
    Usa percentiles de la CDC (P90=Q_min, P50=Q_med, P10=Q_max).
    """
    path_q = FUENTES / "Q_Especificos CARDER_2026-04-08.csv"

    rows = []

    # Opción 1: estadísticos desde la curva de duración
    if df_cdc is not None and len(df_cdc) > 0:
        for uh, grp in df_cdc.groupby("Unidad"):
            hist = grp[grp["Escenario"].str.contains("Historico|histórico", case=False, na=False)]
            if len(hist) == 0:
                hist = grp  # si no hay histórico, usar todos
            q_col = "Caudal m3s"
            p_col = "Porcentaje Excedencia"
            if q_col not in hist.columns:
                continue
            hist_sorted = hist.sort_values(p_col)
            q_min  = hist_sorted[hist_sorted[p_col] >= 90][q_col].mean()
            q_med  = hist_sorted[hist_sorted[p_col].between(45, 55)][q_col].mean()
            q_max  = hist_sorted[hist_sorted[p_col] <= 10][q_col].mean()
            q_est  = hist_sorted[hist_sorted[p_col] >= 95][q_col].mean()
            rows.append({
                "CUERPO_AGUA":  uh,
                "TIPO_CUERPO":  "Tributario",
                "TRAMO_O_RIO":  uh,
                "Q_min_m3s":    round(q_min,  2) if pd.notna(q_min)  else None,
                "Q_med_m3s":    round(q_med,  2) if pd.notna(q_med)  else None,
                "Q_max_m3s":    round(q_max,  2) if pd.notna(q_max)  else None,
                "Q_estiaje_m3s":round(q_est,  2) if pd.notna(q_est)  else None,
                "PERIODO":      "Histórico (CARDER)",
                "FUENTE":       "CARDER",
                "ESTADO_DATO":  "ERA_CDC 2026-04-08",
            })

    if not rows:
        print("  [INFO] No se generaron filas de hidrometría desde CDC.")
        return None

    out = pd.DataFrame(rows)
    out_path = DATA_DIR / "hidrometria.csv"
    out.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"  ✓ hidrometria.csv — {len(out)} filas")
    return out


if __name__ == "__main__":
    print("\n=== prepare_data.py — Proyecto 890K Corredor Biológico ===\n")
    DATA_DIR.mkdir(exist_ok=True)

    print("1. Calidad del agua (ERA_MinMedMax)...")
    load_calidad()

    print("\n2. Curvas de duración de caudales (ERA_CDC)...")
    df_cdc = load_cdc()

    print("\n3. Hidrometría estadística...")
    load_hidrometria(df_cdc)

    print("\n=== Listo. Archivos generados en data/ ===\n")