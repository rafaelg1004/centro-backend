function flattenObject(obj, prefix = "") {
  let result = [];
  for (const [key, value] of Object.entries(obj)) {
    const formattedKey = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
    const fullLabel = prefix ? `${prefix} - ${formattedKey}` : formattedKey;

    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    )
      continue;

    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = flattenObject(value, fullLabel);
      result = result.concat(nested);
    } else if (Array.isArray(value)) {
      const arrayStr = value.filter((v) => v && v !== "").join(", ");
      if (arrayStr) {
        result.push({ nombre: key, etiqueta: fullLabel, valor: arrayStr });
      }
    } else {
      result.push({ nombre: key, etiqueta: fullLabel, valor: String(value) });
    }
  }
  return result;
}

function crearModuloCompleto(data, nombreModulo, nombrePropiedadSalida) {
  const modulo = data[nombreModulo];
  if (!modulo || typeof modulo !== "object") return data;

  const newData = { ...data };
  const campos = [];

  for (const [key, value] of Object.entries(modulo)) {
    const formattedKey = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());

    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    )
      continue;

    if (typeof value === "object" && !Array.isArray(value)) {
      const nestedFields = flattenObject(value, formattedKey);
      campos.push(...nestedFields);
    } else if (Array.isArray(value)) {
      const arrayStr = value.filter((v) => v && v !== "").join(", ");
      if (arrayStr) {
        campos.push({
          nombre: `${nombreModulo}.${key}`,
          etiqueta: formattedKey,
          valor: arrayStr,
        });
      }
    } else {
      campos.push({
        nombre: `${nombreModulo}.${key}`,
        etiqueta: formattedKey,
        valor: String(value),
      });
    }
  }
  newData[nombrePropiedadSalida] = campos;
  return newData;
}

const data = require('./bada2d21.json');
// apply conversion to camel case...
// we can use a mock
const mockData = {
  moduloPediatria: {
    lenguaje: { balbucea: "SI", usaFrases: "NO" },
    hitos: {
      gateo: "No - "
    }
  }
};
console.log(crearModuloCompleto(mockData, "moduloPediatria", "moduloPediatriaCompleto").moduloPediatriaCompleto);
