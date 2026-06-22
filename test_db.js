const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

async function test() {
  const ids = ['bada2d21-dcf3-46af-ac87-88c18bf9a8a5', '42151b11-f106-4f2f-bbd1-a4f589d978ee'];
  for (const id of ids) {
    const res = await pool.query('SELECT * FROM pacientes WHERE id = $1', [id]);
    console.log(`\n=================== PACIENTE ${id} ===================\n`);
    console.log(JSON.stringify(res.rows, null, 2));
    
    // Also check valoraciones
    const resVal = await pool.query('SELECT id, paciente_id, tipo_valoracion, datos_especificos, created_at FROM valoraciones WHERE paciente_id = $1', [id]);
    console.log(`\n--- VALORACIONES FOR ${id} ---\n`);
    console.log(JSON.stringify(resVal.rows, null, 2));
  }
  pool.end();
}

test().catch(console.error);
