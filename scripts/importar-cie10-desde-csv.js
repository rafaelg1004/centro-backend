// ============================================================
// SCRIPT: Importar catálogo CIE-10 desde CSV a PostgreSQL
// ============================================================
// Uso:
//   cd Backend
//   node scripts/importar-cie10-desde-csv.js
//
// El CSV debe estar en: scripts/TablaReferencia_CIE10__1.csv
// (generado previamente con libreoffice desde el .xlsx de referencia)
//
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { sequelize, CIE10 } = require("../models-sequelize");

const CSV_PATH = path.join(__dirname, "TablaReferencia_CIE10__1.csv");

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado a PostgreSQL");
    console.log(`   Base de datos: ${sequelize.config.database}`);
    console.log(`   Host: ${sequelize.config.host}`);

    if (!fs.existsSync(CSV_PATH)) {
      console.error(`❌ No se encontró el archivo CSV: ${CSV_PATH}`);
      console.log("   Genera el CSV desde el Excel con libreoffice:");
      console.log("   libreoffice --headless --convert-to csv --outdir scripts TablaReferencia_CIE10__1.xlsx");
      process.exit(1);
    }

    const raw = fs.readFileSync(CSV_PATH, "utf-8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) {
      console.error("❌ El CSV está vacío");
      process.exit(1);
    }

    const headers = parseCSVLine(lines[0]);
    const idxCodigo = headers.indexOf("Codigo");
    const idxNombre = headers.indexOf("Nombre");
    const idxDescripcion = headers.indexOf("Descripcion");
    const idxHabilitado = headers.indexOf("Habilitado");
    const idxCapitulo = headers.indexOf("Extra_VI:Capitulo");
    const idxSexo = headers.indexOf("Extra_X:Sexo");
    const idxEdadMin = headers.indexOf("Extra_II:EdadMinima");
    const idxEdadMax = headers.indexOf("Extra_III:EdadMaxima");

    if (idxCodigo === -1 || idxNombre === -1) {
      console.error("❌ El CSV no tiene las columnas esperadas (Codigo, Nombre)");
      console.log("   Columnas encontradas:", headers.join(", "));
      process.exit(1);
    }

    const codigos = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const codigo = row[idxCodigo]?.trim();
      const nombre = row[idxNombre]?.trim();
      if (!codigo || !nombre) continue;
      codigos.push({
        codigo: codigo.toUpperCase(),
        nombre,
        descripcion: row[idxDescripcion]?.trim() || nombre,
        categoria: row[idxCapitulo]?.trim() || null,
        sexo_restringido: row[idxSexo]?.trim() || null,
        edad_minima: parseInt(row[idxEdadMin], 10) || null,
        edad_maxima: parseInt(row[idxEdadMax], 10) || null,
        activo: row[idxHabilitado]?.toUpperCase() === "SI" || row[idxHabilitado]?.toUpperCase() === "TRUE" || true,
      });
    }

    console.log(`\n📥 Códigos CIE-10 leídos del CSV: ${codigos.length}`);
    console.log("🔄 Importando en bloques de 500...");

    const BATCH_SIZE = 500;
    let insertados = 0;
    let actualizados = 0;
    const transaction = await sequelize.transaction();

    try {
      for (let i = 0; i < codigos.length; i += BATCH_SIZE) {
        const batch = codigos.slice(i, i + BATCH_SIZE);

        const result = await CIE10.bulkCreate(batch, {
          transaction,
          updateOnDuplicate: [
            "nombre",
            "descripcion",
            "categoria",
            "sexo_restringido",
            "edad_minima",
            "edad_maxima",
            "activo",
            "updated_at",
          ],
        });

        // bulkCreate no retorna cuántos fueron insertados vs actualizados
        // Hacemos una estimación: contamos los que existían antes
        const existentes = await CIE10.findAll({
          where: { codigo: batch.map((c) => c.codigo) },
          transaction,
          attributes: ["codigo", "created_at"],
        });
        // Si created_at es muy reciente, probablemente fue insertado ahora
        const umbral = new Date(Date.now() - 5000);
        const recientes = existentes.filter((e) => new Date(e.created_at) > umbral);
        insertados += recientes.length;
        actualizados += batch.length - recientes.length;

        console.log(`   Progreso: ${Math.min(i + BATCH_SIZE, codigos.length)}/${codigos.length}`);
      }

      await transaction.commit();
      console.log(`\n✅ Importación completada:`);
      console.log(`   Insertados: ${insertados}`);
      console.log(`   Actualizados: ${actualizados}`);
      console.log(`   Total procesados: ${codigos.length}`);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
