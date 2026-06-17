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
  
  const facturas = ['2305', '2562', '2570', '2569', '2572', '2568', '2362', '2661'];
  
  for (const factura of facturas) {
    const pRes = await pgClient.query(`
      SELECT pp.clases_pagadas, p.nombres, p.apellidos, pp.fecha_pago
      FROM pago_paquetes pp
      JOIN pacientes p ON pp.paciente_id = p.id
      WHERE pp.numero_factura = $1
    `, [factura]);
    
    if (pRes.rows.length === 0) continue;
    const paquete = pRes.rows[0];
    
    const cRes = await pgClient.query(`
      SELECT c.fecha, c.nombre
      FROM clase_ninos cn
      JOIN clases c ON cn.clase_id = c.id
      WHERE cn.numero_factura = $1
      ORDER BY c.fecha ASC
    `, [factura]);
    
    const clases = cRes.rows;
    const pagadas = paquete.clases_pagadas;
    const excedentes = clases.slice(pagadas);
    
    console.log(`\n=================================================`);
    console.log(`Factura: ${factura} | Paciente: ${paquete.nombres} ${paquete.apellidos}`);
    console.log(`Fecha de Compra: ${new Date(paquete.fecha_pago).toISOString().split('T')[0]}`);
    console.log(`Pagadas: ${pagadas} | Totales Asistidas: ${clases.length} | Excedentes: ${excedentes.length}`);
    
    console.log(`\n--- Clases Excedentes (Las más recientes) ---`);
    excedentes.forEach(c => {
      console.log(`- Fecha: ${new Date(c.fecha).toISOString().split('T')[0]} | Clase: ${c.nombre}`);
    });
  }
  
  await pgClient.end();
}

run().catch(console.error);
