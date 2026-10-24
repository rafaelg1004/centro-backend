const fs = require('fs');
const data = require('./bada2d21.json');

// Mapeo directo de backend a frontend para simular DetalleValoracion.jsx
function convertKeysToCamelCase(obj) {
  if (Array.isArray(obj)) return obj.map(v => convertKeysToCamelCase(v));
  if (obj !== null && obj && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      result[camelKey] = convertKeysToCamelCase(obj[key]);
      return result;
    }, {});
  }
  return obj;
}

const converted = convertKeysToCamelCase(data);
// Simulation of mapearDatosLegacy
function mapearDatosLegacy(newData) {
  const legacy = newData.datosLegacy;
  if (!legacy || Object.keys(legacy).length === 0) return newData;
  const esPediatria = true;
  if (esPediatria) {
    if (!newData.moduloPediatria) newData.moduloPediatria = {};
    newData.motivoConsulta = newData.motivoConsulta || legacy.motivoDeConsulta || "";
    if (!newData.moduloPediatria.prenatales) newData.moduloPediatria.prenatales = {};
    const pren = legacy.antecedentesPrenatales || [];
    if (Array.isArray(pren)) {
      const pString = pren.join(" ").toLowerCase();
      newData.moduloPediatria.prenatales.gestacionPlaneada = pString.includes("planeada");
    }
  }
  return newData;
}
const mapped = mapearDatosLegacy(converted);
console.log(JSON.stringify(mapped, null, 2).substring(0, 1000));
