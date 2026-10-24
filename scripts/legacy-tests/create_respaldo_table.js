const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

async function createTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS respaldo_formularios (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      endpoint VARCHAR(255),
      metodo VARCHAR(10),
      payload_recibido JSONB,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log("Tabla respaldo_formularios creada correctamente.");
  } catch (e) {
    console.error("Error al crear la tabla:", e);
  } finally {
    pool.end();
  }
}

createTable();
