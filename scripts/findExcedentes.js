const { Client } = require('pg');
const fs = require('fs');

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
    WITH conteo_real AS (
        SELECT numero_factura, COUNT(id) as real_usadas
        FROM clase_ninos
        WHERE numero_factura IS NOT NULL
        GROUP BY numero_factura
    )
    SELECT pp.numero_factura, pp.paciente_id, pp.clases_pagadas, pp.clases_usadas as historico_usadas, COALESCE(cr.real_usadas, 0) as real_usadas,
           (COALESCE(cr.real_usadas, 0) - pp.clases_pagadas) as excedentes
    FROM pago_paquetes pp
    JOIN conteo_real cr ON pp.numero_factura = cr.numero_factura
    WHERE COALESCE(cr.real_usadas, 0) > pp.clases_pagadas
    ORDER BY excedentes DESC;
  `);
  
  let fixSql = "-- SCRIPT PARA DESVINCULAR CLASES EXCEDENTES Y DEJARLAS COMO DEUDA\n\n";
  
  for (const row of res.rows) {
    const pacienteData = await pgClient.query("SELECT nombres, apellidos FROM pacientes WHERE id = $1", [row.paciente_id]);
    const name = pacienteData.rows[0].nombres + " " + pacienteData.rows[0].apellidos;
    
    fixSql += `-- Paciente: ${name} | Factura: ${row.numero_factura} | Excedentes: ${row.excedentes}\n`;
    
    // Get the most recent classes to detach
    const classesToDetach = await pgClient.query(`
      SELECT cn.id
      FROM clase_ninos cn
      JOIN clases c ON cn.clase_id = c.id
      WHERE cn.numero_factura = $1
      ORDER BY c.fecha DESC
      LIMIT $2
    `, [row.numero_factura, row.excedentes]);
    
    for (const c of classesToDetach.rows) {
      fixSql += `UPDATE clase_ninos SET numero_factura = NULL WHERE id = '${c.id}';\n`;
    }
    
    fixSql += `UPDATE pago_paquetes SET clases_usadas = ${row.clases_pagadas}, updated_at = NOW() WHERE numero_factura = '${row.numero_factura}';\n\n`;
  }
  
  fs.writeFileSync('scripts/detachExcedentesV2.sql', fixSql);
  console.log("Script generado: scripts/detachExcedentesV2.sql");
  
  await pgClient.end();
}

run().catch(console.error);
