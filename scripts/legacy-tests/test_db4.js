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
    console.log(`\n=================== SEARCHING ID: ${id} ===================\n`);
    
    const res = await pool.query(`SELECT * FROM valoraciones_fisioterapia WHERE id = $1`, [id]);
    if (res.rows.length > 0) {
       console.log(`Found in table: valoraciones_fisioterapia`);
       const row = res.rows[0];
       console.log(Object.keys(row));
       console.log("cod_consulta:", row.cod_consulta);
       console.log("tipo_programa:", row.tipo_programa);
    }
  }
  pool.end();
}

test().catch(console.error);
