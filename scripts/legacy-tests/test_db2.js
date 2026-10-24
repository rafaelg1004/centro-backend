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
  const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  console.log("Tables:", tables.rows.map(r => r.table_name));

  const ids = ['bada2d21-dcf3-46af-ac87-88c18bf9a8a5', '42151b11-f106-4f2f-bbd1-a4f589d978ee'];
  for (const id of ids) {
    const res = await pool.query('SELECT * FROM pacientes WHERE id = $1', [id]);
    console.log(`\n=================== PACIENTE ${id} ===================\n`);
    console.log(JSON.stringify(res.rows, null, 2));
    
    // Check if any legacy data exists for this patient
    const legacy = await pool.query('SELECT * FROM legacy_data_mapping WHERE postgres_id = $1', [id]);
    if (legacy.rows.length) {
       console.log(`\n--- LEGACY MAPPING ---\n`);
       console.log(JSON.stringify(legacy.rows, null, 2));
    }
  }
  pool.end();
}

test().catch(console.error);
