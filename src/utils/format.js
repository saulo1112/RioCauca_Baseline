/* format.js — Helpers de formato compartidos por los controles del visor. */

/* Formatea un número con separador de miles y decimales fijos (formato en-US).
 * Ejemplo: fmt(3475.8612, 2) → "3,475.86" */
export function fmt(value, decimals = 2) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* Escapa los caracteres con significado en HTML. Obligatorio para cualquier
 * texto que provenga de un GeoJSON antes de inyectarlo con innerHTML. */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* Escapa un valor para una celda CSV: comillas dobles si contiene separador,
 * comilla o salto de línea. */
export function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
