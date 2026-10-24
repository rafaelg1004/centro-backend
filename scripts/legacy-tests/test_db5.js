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
  const res = await pool.query(`SELECT * FROM valoraciones_fisioterapia WHERE id = 'bada2d21-dcf3-46af-ac87-88c18bf9a8a5'`);
  console.log(JSON.stringify(res.rows[0], null, 2));
  pool.end();
}

test().catch(console.error);
