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
  
  // Find pacientes
  const pRes = await pgClient.query(`
    SELECT DISTINCT pp.paciente_id, p.nombres, p.apellidos
    FROM pago_paquetes pp
    JOIN pacientes p ON pp.paciente_id = p.id
    WHERE pp.numero_factura = ANY($1)
  `, [facturas]);
  
  const pacientes = pRes.rows;
  let fixSql = "-- SCRIPT PARA CUBRIR DEUDAS CON PAQUETES ACTIVOS\n\n";
  
  for (const paciente of pacientes) {
    // Find active packages
    const pkgs = await pgClient.query(`
      SELECT * FROM pago_paquetes 
      WHERE paciente_id = $1 AND clases_usadas < clases_pagadas
    `, [paciente.paciente_id]);
    
    // Find unpaid classes
    const unpaid = await pgClient.query(`
      SELECT cn.id, c.fecha, c.nombre 
      FROM clase_ninos cn
      JOIN clases c ON cn.clase_id = c.id
      WHERE cn.paciente_id = $1 AND cn.numero_factura IS NULL
      ORDER BY c.fecha ASC
    `, [paciente.paciente_id]);
    
    if (pkgs.rows.length > 0 && unpaid.rows.length > 0) {
      console.log(`\nPaciente: ${paciente.nombres} ${paciente.apellidos}`);
      
      let unpaidIdx = 0;
      for (const pkg of pkgs.rows) {
        let disp = pkg.clases_pagadas - pkg.clases_usadas;
        console.log(`- Tiene paquete ACTIVO: Factura ${pkg.numero_factura} (Le faltan ${disp} clases)`);
        
        while (disp > 0 && unpaidIdx < unpaid.rows.length) {
          const cls = unpaid.rows[unpaidIdx];
          console.log(`  -> Asignando clase adeudada del ${new Date(cls.fecha).toISOString().split('T')[0]} a esta factura.`);
          fixSql += `UPDATE clase_ninos SET numero_factura = '${pkg.numero_factura}' WHERE id = '${cls.id}';\n`;
          disp--;
          unpaidIdx++;
        }
        
        const nuevasUsadas = pkg.clases_pagadas - disp;
        fixSql += `UPDATE pago_paquetes SET clases_usadas = ${nuevasUsadas}, updated_at = NOW() WHERE id = '${pkg.id}';\n\n`;
      }
    }
  }
  
  const fs = require('fs');
  fs.writeFileSync('scripts/fixDeudas.sql', fixSql);
  console.log("\nScript generado: scripts/fixDeudas.sql");
  
  await pgClient.end();
}

run().catch(console.error);
