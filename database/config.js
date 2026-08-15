require('dotenv').config();

const { Sequelize } = require('sequelize');

const pg = require('pg');

// Forzar a que pg retorne columnas tipo DATE (OID 1082) como strings 'YYYY-MM-DD' sin conversión a objeto Date de JS
pg.types.setTypeParser(1082, (val) => val);

// Configuración de la conexión a PostgreSQL
const sequelize = new Sequelize(
  process.env.PGDATABASE || 'dmamitas',
  process.env.PGUSER || 'postgres',
  process.env.PGPASSWORD || '',
  {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    dialect: 'postgres',
    timezone: '-05:00', // Zona horaria de Colombia
    dialectOptions: {
      useUTC: false, // Forzar uso de zona horaria local
      dateStrings: true
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  }
);

// Función para verificar la conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a PostgreSQL establecida correctamente.');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a PostgreSQL:', error);
    return false;
  }
};

// Función para sincronizar modelos (crear tablas si no existen)
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log(`✅ Base de datos sincronizada${force ? ' (forzado)' : ''}.`);
    return true;
  } catch (error) {
    console.error('❌ Error al sincronizar base de datos:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};
