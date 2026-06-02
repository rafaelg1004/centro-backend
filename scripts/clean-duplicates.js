#!/usr/bin/env node
/**
 * Script para limpiar valoraciones duplicadas generadas por el script de migración.
 * 
 * Lógica:
 * - Agrupa por paciente_id + tipo_programa + motivo_consulta
 * - Si hay más de 1 registro en un grupo, conserva el MÁS ANTIGUO (el original)
 * - Borra los que se crearon hoy (duplicados de migración)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { sequelize } = require("../database/config");
const models = require("../models-sequelize");
const { Op } = require("sequelize");

async function main() {
  await sequelize.authenticate();
  console.log("✅ Conectado a PostgreSQL\n");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const all = await models.ValoracionFisioterapia.findAll({
    order: [["createdAt", "ASC"]], // Más antiguo primero
  });

  console.log(`📊 Total valoraciones en BD: ${all.length}`);

  // Agrupar por paciente + tipo + motivo
  const groups = {};
  for (const v of all) {
    const key = `${v.paciente_id}||${v.tipo_programa}||${(v.motivo_consulta || "").substring(0, 50)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(v);
  }

  const toDelete = [];

  for (const [key, list] of Object.entries(groups)) {
    if (list.length <= 1) continue;

    // Separar: originales (creados antes de hoy) vs duplicados (creados hoy)
    const originales = list.filter((v) => v.createdAt < today);
    const creadosHoy = list.filter((v) => v.createdAt >= today);

    if (originales.length > 0 && creadosHoy.length > 0) {
      // Tenemos originales Y duplicados de hoy -> borrar los de hoy
      for (const dup of creadosHoy) {
        toDelete.push(dup);
      }
    } else if (originales.length === 0 && creadosHoy.length > 1) {
      // Todos son de hoy pero hay más de 1 -> conservar solo el primero (más antiguo)
      for (let i = 1; i < creadosHoy.length; i++) {
        toDelete.push(creadosHoy[i]);
      }
    }
  }

  console.log(`\n🗑️  Duplicados encontrados para borrar: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("✅ No hay duplicados. La base de datos está limpia.");
    process.exit(0);
  }

  // Mostrar resumen antes de borrar
  console.log("\n--- Registros a eliminar ---");
  for (const d of toDelete) {
    console.log(
      `  ❌ ID: ${d.id} | Tipo: ${d.tipo_programa} | Creado: ${d.createdAt.toISOString()} | Motivo: ${(d.motivo_consulta || "").substring(0, 40)}`
    );
  }

  // Borrar
  console.log("\n🔧 Eliminando duplicados...");
  let deleted = 0;
  for (const d of toDelete) {
    await d.destroy();
    deleted++;
  }

  // Verificación final
  const remaining = await models.ValoracionFisioterapia.count();
  console.log(`\n✅ Eliminados: ${deleted}`);
  console.log(`📊 Total valoraciones restantes: ${remaining}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
