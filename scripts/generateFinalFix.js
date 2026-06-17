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
  
  let fixSql = "-- SCRIPT DEFINITIVO PARA CUBRIR DEUDAS CON PAQUETES ACTIVOS\n\n";
  
  // 1. Force sync all pago_paquetes.clases_usadas with real counts
  fixSql += "-- 1. Sincronizar todos los contadores de paquetes con la realidad actual\n";
  fixSql += `WITH conteo_real AS (
    SELECT numero_factura, COUNT(id) as real_usadas
    FROM clase_ninos
    WHERE numero_factura IS NOT NULL
    GROUP BY numero_factura
)
UPDATE pago_paquetes pp
SET clases_usadas = COALESCE(cr.real_usadas, 0), updated_at = NOW()
FROM conteo_real cr
WHERE pp.numero_factura = cr.numero_factura AND pp.clases_usadas != cr.real_usadas;

UPDATE pago_paquetes pp
SET clases_usadas = 0, updated_at = NOW()
WHERE clases_usadas > 0 AND NOT EXISTS (SELECT 1 FROM clase_ninos cn WHERE cn.numero_factura = pp.numero_factura);

`;

  // Get patients who have unpaid classes
  const pRes = await pgClient.query(`
    SELECT DISTINCT paciente_id FROM clase_ninos WHERE numero_factura IS NULL
  `);
  
  for (const row of pRes.rows) {
    const paciente_id = row.paciente_id;
    
    // Find active packages
    // Use real time query, but since we are generating SQL based on current DB state,
    // we need to calculate what the active packages are using the real count.
    const pkgs = await pgClient.query(`
      SELECT pp.id, pp.numero_factura, pp.clases_pagadas, 
             (SELECT COUNT(*) FROM clase_ninos cn WHERE cn.numero_factura = pp.numero_factura) as real_usadas
      FROM pago_paquetes pp
      WHERE pp.paciente_id = $1
      ORDER BY pp.fecha_pago ASC
    `, [paciente_id]);
    
    const activePkgs = pkgs.rows.filter(p => parseInt(p.real_usadas) < p.clases_pagadas);
    
    // Find unpaid classes
    const unpaid = await pgClient.query(`
      SELECT cn.id, c.fecha, c.nombre 
      FROM clase_ninos cn
      JOIN clases c ON cn.clase_id = c.id
      WHERE cn.paciente_id = $1 AND cn.numero_factura IS NULL
      ORDER BY c.fecha ASC
    `, [paciente_id]);
    
    if (activePkgs.length > 0 && unpaid.rows.length > 0) {
      const pData = await pgClient.query("SELECT nombres, apellidos FROM pacientes WHERE id = $1", [paciente_id]);
      const name = pData.rows[0].nombres + " " + pData.rows[0].apellidos;
      
      fixSql += `-- Paciente: ${name}\n`;
      let unpaidIdx = 0;
      
      for (const pkg of activePkgs) {
        let disp = pkg.clases_pagadas - parseInt(pkg.real_usadas);
        while (disp > 0 && unpaidIdx < unpaid.rows.length) {
          const cls = unpaid.rows[unpaidIdx];
          fixSql += `UPDATE clase_ninos SET numero_factura = '${pkg.numero_factura}' WHERE id = '${cls.id}';\n`;
          disp--;
          unpaidIdx++;
        }
        
        const nuevasUsadas = pkg.clases_pagadas - disp;
        fixSql += `UPDATE pago_paquetes SET clases_usadas = ${nuevasUsadas}, updated_at = NOW() WHERE numero_factura = '${pkg.numero_factura}';\n\n`;
      }
    }
  }
  
  fs.writeFileSync('scripts/fixDeudasDefinitivo.sql', fixSql);
  console.log("Script generado: scripts/fixDeudasDefinitivo.sql");
  
  await pgClient.end();
}

run().catch(console.error);
