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
    
    const tables = [
      'valoraciones_fisioterapia',
      'borradores_formularios'
    ];
    
    for (const table of tables) {
      try {
        const res = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
        if (res.rows.length > 0) {
           console.log(`Found in table: ${table}`);
           console.log(JSON.stringify(res.rows, null, 2));
        }
      } catch(e) {
        // ignore errors like id not matching uuid format or column not existing
      }
    }
  }
  pool.end();
}

test().catch(console.error);
