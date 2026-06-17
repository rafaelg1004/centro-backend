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
  
  const facturas = ['2305', '2562', '2570', '2569', '2572', '2568', '2362', '2661'];
  let sql = "-- SCRIPT PARA DESVINCULAR CLASES EXCEDENTES Y DEJARLAS COMO DEUDA\n\n";
  
  for (const factura of facturas) {
    const pRes = await pgClient.query(`
      SELECT pp.clases_pagadas, p.nombres, p.apellidos, pp.paciente_id
      FROM pago_paquetes pp
      JOIN pacientes p ON pp.paciente_id = p.id
      WHERE pp.numero_factura = $1
    `, [factura]);
    
    if (pRes.rows.length === 0) continue;
    const paquete = pRes.rows[0];
    
    const cRes = await pgClient.query(`
      SELECT cn.id, c.fecha, c.nombre
      FROM clase_ninos cn
      JOIN clases c ON cn.clase_id = c.id
      WHERE cn.numero_factura = $1
      ORDER BY c.fecha ASC
    `, [factura]);
    
    const clases = cRes.rows;
    const pagadas = paquete.clases_pagadas;
    const excedentes = clases.slice(pagadas);
    
    if (excedentes.length > 0) {
      sql += `-- Paciente: ${paquete.nombres} ${paquete.apellidos} (Factura ${factura}) - ${excedentes.length} clases excedentes\n`;
      for (const exc of excedentes) {
        sql += `UPDATE clase_ninos SET numero_factura = NULL WHERE id = '${exc.id}';\n`;
      }
      sql += `UPDATE pago_paquetes SET clases_usadas = ${pagadas}, updated_at = NOW() WHERE numero_factura = '${factura}' AND paciente_id = '${paquete.paciente_id}';\n\n`;
    }
  }
  
  fs.writeFileSync('scripts/detachExcedentes.sql', sql);
  console.log("Script SQL generado en scripts/detachExcedentes.sql");
  await pgClient.end();
}

run().catch(console.error);
