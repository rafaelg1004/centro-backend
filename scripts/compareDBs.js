const { MongoClient } = require('mongodb');
const { Client } = require('pg');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI;

async function run() {
  const mongoClient = new MongoClient(mongoUri);
  const pgClient = new Client({
    host: 'localhost',
    port: 5432,
    database: 'centrodesalud',
    user: 'postgres',
    password: '1234'
  });

  try {
    await mongoClient.connect();
    await pgClient.connect();
    
    const db = mongoClient.db('centro_estimulacion');
    const clasesMongoColl = db.collection('clases');
    
    // Traer todas las clases de Mongo de Enero a Febrero
    const clasesMongo = await clasesMongoColl.find({ fecha: { $gte: "2026-01-01", $lte: "2026-02-15" } }).toArray();
    console.log(`Clases en Mongo: ${clasesMongo.length}`);
    
    // Traer todas las clases de Postgres del mismo periodo
    const resPg = await pgClient.query("SELECT id, nombre, fecha FROM clases WHERE fecha >= '2026-01-01' AND fecha <= '2026-02-15'");
    const clasesPg = resPg.rows;
    console.log(`Clases en Postgres: ${clasesPg.length}`);
    
    // Ver si alguna clase de Mongo no está en Postgres (comparando nombre y fecha, ya que los IDs pueden ser distintos o no)
    const faltantes = [];
    clasesMongo.forEach(cm => {
      // Postgres dates are objects if we don't format them, but let's compare by simple string matching
      // Since pg returns Date objects for DATE columns, we convert to YYYY-MM-DD
      const findPg = clasesPg.find(cp => {
         const cpFecha = cp.fecha.toISOString().split('T')[0];
         return cpFecha === cm.fecha && cp.nombre === cm.nombre;
      });
      if (!findPg) {
         faltantes.push(cm);
      }
    });
    
    console.log(`\nHay ${faltantes.length} clases en Mongo que no parecen estar en Postgres:`);
    faltantes.forEach(f => {
      console.log(`- ${f.fecha} | ${f.nombre} | ${f.ninos ? f.ninos.length : 0} niños`);
    });
    
    // Ahora veamos si hay asistencias que faltan de los niños con facturas 2472, etc.
    // Vamos a buscar específicamente a Helena (Mongo ID: 699ccd2cc3cc772cf77fc1a9, Factura 2472)
    // Ya sabemos que en Mongo Helena tiene 7 asistencias para la 2472, igual que en Postgres.
    // O tal vez el usuario dice que "se perdió" y significa que no está en NINGUNA base de datos?

  } finally {
    await mongoClient.close();
    await pgClient.end();
  }
}

run().catch(console.dir);
