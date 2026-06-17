const { Client } = require('pg');

const pgClient = new Client({
  host: 'localhost',
  port: 5432,
  database: 'centrodesalud',
  user: 'postgres',
  password: '1234'
});

async function run() {
  await pgClient.connect();
  
  const res = await pgClient.query(`
    SELECT pp.paciente_id, p.nombres, p.apellidos, pp.numero_factura, pp.clases_pagadas, pp.clases_usadas as db_usadas,
           (SELECT count(*) FROM clase_ninos cn WHERE cn.numero_factura = pp.numero_factura) as reales_usadas
    FROM pago_paquetes pp
    JOIN pacientes p ON pp.paciente_id = p.id
  `);
  
  let overused = [];
  for (const row of res.rows) {
    if (row.reales_usadas > row.clases_pagadas) {
      overused.push(row);
    }
  }
  
  console.log("Paquetes sobre-utilizados (reales_usadas > clases_pagadas):");
  console.table(overused);
  
  await pgClient.end();
}

run().catch(console.error);
