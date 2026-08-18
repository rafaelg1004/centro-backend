/**
 * Utilidades para el manejo de fechas en el Backend sin desfasajes de zona horaria (UTC vs Local).
 */

function parseFechaLocal(dateVal) {
  if (!dateVal) return null;

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    // Si fue creado con UTC medianoche (ej: new Date("YYYY-MM-DD"))
    if (dateVal.getUTCHours() === 0 && dateVal.getUTCMinutes() === 0 && dateVal.getUTCSeconds() === 0) {
      return new Date(dateVal.getUTCFullYear(), dateVal.getUTCMonth(), dateVal.getUTCDate());
    }
    return new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate());
  }

  const str = String(dateVal).trim();
  const soloFecha = str.split('T')[0];
  const partes = soloFecha.split('-');

  if (partes.length === 3) {
    const [year, month, day] = partes.map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }

  return new Date(dateVal);
}

function obtenerFechaString(dateVal) {
  if (!dateVal) return "";
  const d = parseFechaLocal(dateVal);
  if (!d || isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  parseFechaLocal,
  obtenerFechaString,
};
