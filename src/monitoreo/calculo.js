/* calculo.js — Traducción de carga difusa a concentración (Actividad 5).
 *
 * Funciones puras (sin DOM) para que el panel y su verificación contra
 * docs/monitoreo_corredor.xlsx usen exactamente el mismo código:
 *
 *   Carga (kg/d)         = área_ha × FE / 365 × (1 − remoción)
 *   Concentración (mg/L) = carga / (Q_condición × 86,4)
 *
 * La relación es lineal en la remoción, así que la remoción necesaria para
 * una meta se despeja en forma cerrada: 1 − meta / concentración_base.
 */

import { FE_N, FE_P, DIAS_ANO, CONV_Q, CONDICIONES } from '../config/monitoreo.js';

export const NUTRIENTES = {
  N: { fe: FE_N, unidadCarga: 'kg N/d', unidadConc: 'mg N/L', nombre: 'Nitrógeno total',
       hist: 'nt_hist_mg_l', nHist: 'n_nt' },
  P: { fe: FE_P, unidadCarga: 'kg P/d', unidadConc: 'mg P/L', nombre: 'Fósforo total',
       hist: 'pt_hist_mg_l', nHist: 'n_pt' },
};

/* Caudal de referencia (m³/s) de una estación para la condición dada, o null. */
export function caudal(props, condicion) {
  const c = CONDICIONES.find(x => x.id === condicion);
  const q = c ? Number(props?.[c.prop]) : NaN;
  return Number.isFinite(q) && q > 0 ? q : null;
}

export function carga(areaHa, nutriente, remocion) {
  return areaHa * NUTRIENTES[nutriente].fe / DIAS_ANO * (1 - remocion);
}

export function concentracion(cargaKgD, q) {
  return cargaKgD / (q * CONV_Q);
}

/* Todo lo que muestra el panel para un subtramo, nutriente, condición y
 * remoción (fracción 0–1). null si la estación no tiene caudal. */
export function proyectar(props, nutriente, condicion, remocion) {
  const q = caudal(props, condicion);
  const area = Number(props?.area_cana_ha);
  if (q == null || !Number.isFinite(area)) return null;
  const cargaBase = carga(area, nutriente, 0);
  const cargaKgD  = carga(area, nutriente, remocion);
  return {
    q,
    cargaBase,
    carga: cargaKgD,
    concBase: concentracion(cargaBase, q),
    conc: concentracion(cargaKgD, q),
  };
}

/* Remoción (fracción) para llevar la concentración base a la meta. Negativa o
 * cero si la base ya cumple; mayor que 1 no ocurre con meta > 0. */
export function remocionParaMeta(concBase, meta) {
  return 1 - meta / concBase;
}
