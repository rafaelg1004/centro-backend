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
    SELECT pp.numero_factura, pp.paciente_id, pp.clases_usadas as historico_usadas, COALESCE(cr.real_usadas, 0) as real_usadas,
           (pp.clases_usadas - COALESCE(cr.real_usadas, 0)) as perdidas,
           pp.fecha_pago
    FROM pago_paquetes pp
    LEFT JOIN conteo_real cr ON pp.numero_factura = cr.numero_factura
    WHERE pp.clases_usadas > COALESCE(cr.real_usadas, 0)
    ORDER BY perdidas DESC;
  `);
  
  let fixSql = "-- SCRIPT PARA RECUPERAR ASISTENCIAS PERDIDAS DEL HISTÓRICO\n\n";
  
  for (const row of res.rows) {
    const pacienteData = await pgClient.query("SELECT nombres, apellidos FROM pacientes WHERE id = $1", [row.paciente_id]);
    const name = pacienteData.rows[0].nombres + " " + pacienteData.rows[0].apellidos;
    
    fixSql += `-- Paciente: ${name} | Factura: ${row.numero_factura} | Faltan: ${row.perdidas} clases\n`;
    
    for (let i = 0; i < row.perdidas; i++) {
      const d = new Date(row.fecha_pago);
      d.setDate(d.getDate() + i); 
      const fechaStr = d.toISOString().split('T')[0];
      
      const claseId = require('crypto').randomUUID();
      fixSql += `INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('${claseId}', 'Asistencia Histórica Recuperada ${i+1}', '${fechaStr}', NOW(), NOW());\n`;
      fixSql += `INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '${claseId}', '${row.paciente_id}', '${row.numero_factura}', '{}'::jsonb, NOW());\n`;
    }
    
    fixSql += `UPDATE pago_paquetes SET clases_usadas = ${row.historico_usadas}, updated_at = NOW() WHERE numero_factura = '${row.numero_factura}';\n\n`;
  }
  
  fs.writeFileSync('scripts/recuperarPerdidas.sql', fixSql);
  console.log("Script regenerado: scripts/recuperarPerdidas.sql");
  
  await pgClient.end();
}

run().catch(console.error);
