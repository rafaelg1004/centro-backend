require('dotenv').config();
const { sequelize } = require('../database/config');
const models = require('../models-sequelize');

async function main() {
  await sequelize.authenticate();
  console.log("Conexión establecida");
  
  // Agregar columnas si no existen
  const queryInterface = sequelize.getQueryInterface();
  const table = 'pacientes';
  
  try {
    await queryInterface.addColumn(table, 'tipo_documento_madre', { type: sequelize.Sequelize.STRING(50) });
    console.log("Columna tipo_documento_madre añadida");
  } catch (e) { console.log(e.message); }
  
  try {
    await queryInterface.addColumn(table, 'num_documento_madre', { type: sequelize.Sequelize.STRING(50) });
    console.log("Columna num_documento_madre añadida");
  } catch (e) { console.log(e.message); }
  
  try {
    await queryInterface.addColumn(table, 'tipo_documento_padre', { type: sequelize.Sequelize.STRING(50) });
    console.log("Columna tipo_documento_padre añadida");
  } catch (e) { console.log(e.message); }
  
  try {
    await queryInterface.addColumn(table, 'num_documento_padre', { type: sequelize.Sequelize.STRING(50) });
    console.log("Columna num_documento_padre añadida");
  } catch (e) { console.log(e.message); }
  
  console.log("Sincronización completada");
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
