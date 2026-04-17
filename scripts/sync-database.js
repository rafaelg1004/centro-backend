#!/usr/bin/env node
/**
 * ============================================
 * SCRIPT: Sincronizar Base de Datos PostgreSQL
 * ============================================
 * Crea las tablas según los modelos Sequelize sin migrar datos.
 */

require("dotenv").config();
const { testConnection, sequelize } = require("../database/config");

// Cargar modelos para que sequelize los conozca
const models = require("../models-sequelize");

async function main() {
  console.log("\n========================================");
  console.log("  SINCRONIZACIÓN DE BASE DE DATOS");
  console.log("========================================\n");

  // Conectar
  console.log("🔗 Conectando a PostgreSQL...");
  const connected = await testConnection();
  if (!connected) {
    console.error("   ❌ No se pudo conectar");
    process.exit(1);
  }

  // Sincronizar (force: false = no borrar datos existentes)
  const force = process.argv.includes("--force");

  if (force) {
    console.warn(
      "⚠️  ATENCIÓN: Modo FORCE activado - Se borrarán todas las tablas",
    );
  }

  console.log(`📦 Sincronizando modelos${force ? " (FORCE)" : ""}...`);

  try {
    await sequelize.sync({ force, alter: !force });
    console.log(`✅ Base de datos sincronizada${force ? " (forzado)" : ""}.`);
    console.log(
      `   Tablas creadas: ${Object.keys(models)
        .filter((k) => k !== "sequelize")
        .join(", ")}`,
    );
  } catch (error) {
    console.error("❌ Error al sincronizar:", error.message);
    process.exit(1);
  }

  console.log("\n✅ Sincronización completada");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
