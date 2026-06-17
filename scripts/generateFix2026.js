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
  
  const resPaquetes = await pgClient.query(`
    SELECT pp.paciente_id, p.nombres, p.apellidos, pp.numero_factura, 
           pp.clases_pagadas, pp.clases_usadas, pp.fecha_pago,
           (pp.clases_pagadas - pp.clases_usadas) as faltantes
    FROM pago_paquetes pp
    JOIN pacientes p ON pp.paciente_id = p.id
    WHERE pp.fecha_pago >= '2026-02-01' AND pp.fecha_pago <= '2026-04-30'
    AND pp.clases_usadas < pp.clases_pagadas
  `);
  
  const paquetes = resPaquetes.rows;
  let sqlScript = '-- SCRIPT PARA LLENAR CLASES FALTANTES Y CERRAR FACTURAS (FEB-ABR 2026)\n\n';

  for (const paq of paquetes) {
    const queryClases = {
      text: `
        SELECT id, nombre, fecha FROM clases 
        WHERE fecha >= $1 AND fecha <= '2026-05-31'
        AND id NOT IN (SELECT clase_id FROM clase_ninos WHERE paciente_id = $2)
        ORDER BY fecha ASC
        LIMIT $3
      `,
      values: [paq.fecha_pago, paq.paciente_id, paq.faltantes]
    };
    
    const resClases = await pgClient.query(queryClases);
    
    sqlScript += `-- Niño: ${paq.nombres} ${paq.apellidos} (Factura ${paq.numero_factura}) - Faltan ${paq.faltantes} clases\n`;
    
    for (const c of resClases.rows) {
      sqlScript += `INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)\n`;
      sqlScript += `VALUES (gen_random_uuid(), '${c.id}', '${paq.paciente_id}', '${paq.numero_factura}', '{}'::jsonb, NOW());\n`;
    }
    
    sqlScript += `UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '${paq.numero_factura}' AND paciente_id = '${paq.paciente_id}';\n\n`;
  }
  
  console.log(sqlScript);
  await pgClient.end();
}

run().catch(console.error);
