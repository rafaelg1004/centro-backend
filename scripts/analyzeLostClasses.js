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
  
  console.log(`Paquetes con clases perdidas: ${res.rows.length}`);
  res.rows.forEach(r => {
    console.log(`Factura: ${r.numero_factura} | Historico: ${r.historico_usadas} | Real: ${r.real_usadas} | Perdidas: ${r.perdidas} | Fecha: ${r.fecha_pago}`);
  });
  
  await pgClient.end();
}

run().catch(console.error);
