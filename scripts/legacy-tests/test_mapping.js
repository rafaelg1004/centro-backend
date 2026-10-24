const fs = require('fs');
const data = require('./bada2d21.json'); // I'll just put the json here

// Helper: Convertir snake_case a camelCase
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToCamelCase(obj) {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToCamelCase(item));
  }
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    const convertedValue = (value !== null && typeof value === "object" && !Array.isArray(value))
      ? convertKeysToCamelCase(value)
      : value;
    
    newObj[camelKey] = convertedValue;
    if (camelKey !== key) {
      newObj[key] = convertedValue; 
    }
  }
  return newObj;
}

function mapearDatosLegacy(data) {
  const legacy = data.datosLegacy || data._datosLegacy;
  if (!legacy || Object.keys(legacy).length === 0) return data;

  const newData = { ...data };
  
  const esPediatria = newData.tipoPrograma === "Pediatría" || newData.tipoPrograma === "Pediatria" || (!newData.tipoPrograma && legacy.tipoPrograma === "Pediatría") || String(newData.codConsulta) === "890201";
  
  if (esPediatria) {
    if (!newData.moduloPediatria) newData.moduloPediatria = {};

    newData.motivoConsulta = newData.motivoConsulta || legacy.motivoDeConsulta || "";
    
    if (!newData.moduloPediatria.lenguaje) newData.moduloPediatria.lenguaje = {};
    if (!newData.moduloPediatria.lenguaje.balbucea) newData.moduloPediatria.lenguaje.balbucea = legacy.balbucea_si ? "SI" : (legacy.balbucea_no ? "NO" : "");
    if (!newData.moduloPediatria.lenguaje.diceMamaPapa) newData.moduloPediatria.lenguaje.diceMamaPapa = legacy.diceMamaPapa_si ? "SI" : (legacy.diceMamaPapa_no ? "NO" : "");
    if (!newData.moduloPediatria.lenguaje.entiendeOrdenes) newData.moduloPediatria.lenguaje.entiendeOrdenes = legacy.entiendeOrdenesSimples_si ? "SI" : (legacy.entiendeOrdenesSimples_no ? "NO" : "");
    if (!newData.moduloPediatria.lenguaje.senalaQueQuiere) newData.moduloPediatria.lenguaje.senalaQueQuiere = legacy.senalaQueQuiere_si ? "SI" : (legacy.senalaQueQuiere_no ? "NO" : "");
    if (!newData.moduloPediatria.lenguaje.usaFrases) newData.moduloPediatria.lenguaje.usaFrases = legacy.usaFrases2Palabras_si ? "SI" : (legacy.usaFrases2Palabras_no ? "NO" : "");
    if (!newData.moduloPediatria.lenguaje.dice5a10Palabras) newData.moduloPediatria.lenguaje.dice5a10Palabras = legacy.dice5a10Palabras_si ? "SI" : (legacy.dice5a10Palabras_no ? "NO" : "");

    // Also check socioemocional
    if (!newData.moduloPediatria.socioemocional) newData.moduloPediatria.socioemocional = {};
    if (!newData.moduloPediatria.socioemocional.sonrieSocialmente) newData.moduloPediatria.socioemocional.sonrieSocialmente = legacy.sonrieSocialmente_si ? "SI" : (legacy.sonrieSocialmente_no ? "NO" : "");
  }
  return newData;
}

let converted = convertKeysToCamelCase(data);
converted = mapearDatosLegacy(converted);
console.log(JSON.stringify(converted.moduloPediatria.lenguaje, null, 2));
console.log(JSON.stringify(converted.moduloPediatria.socioemocional, null, 2));

