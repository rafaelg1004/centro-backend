#!/usr/bin/env node
/**
 * ============================================
 * SCRIPT: Actualizar columnas de usuarios
 * ============================================
 * Agrega columnas faltantes sin borrar datos
 */

require('dotenv').config();
const { sequelize } = require('../database/config');

async function main() {
  console.log('\n========================================');
  console.log('  ACTUALIZANDO TABLA USUARIOS');
  console.log('========================================\n');

  try {
    // Agregar columnas faltantes
    await sequelize.query(`
      ALTER TABLE usuarios 
        ADD COLUMN IF NOT EXISTS nombre VARCHAR(200),
        ADD COLUMN IF NOT EXISTS registro_medico VARCHAR(100),
        ADD COLUMN IF NOT EXISTS firma_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(200),
        ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP WITH TIME ZONE;
    `);

    console.log('✅ Columnas agregadas correctamente');

    // Verificar columnas actuales
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Columnas en tabla usuarios:');
    columns.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type})`);
    });

    // Contar usuarios
    const [count] = await sequelize.query('SELECT COUNT(*) as total FROM usuarios;');
    console.log(`\n👥 Total usuarios en tabla: ${count[0].total}`);

    console.log('\n✅ Actualización completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
