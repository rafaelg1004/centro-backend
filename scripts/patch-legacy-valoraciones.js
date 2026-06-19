const { MongoClient } = require("mongodb");
const { Client } = require("pg");
require("dotenv").config({ path: __dirname + "/../.env" });

async function patchLegacyData() {
  console.log("Iniciando parcheo de datos_legacy desde MongoDB a PostgreSQL...");

  const mongoUri = process.env.MONGODB_URI;
  const mongoClient = new MongoClient(mongoUri);

  const pgClient = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    await mongoClient.connect();
    console.log("✅ Conectado a MongoDB");

    await pgClient.connect();
    console.log("✅ Conectado a PostgreSQL");

    const db = mongoClient.db();
    
    // Obtener todas las valoraciones que tienen _datosLegacy
    const valoracionesMongo = await db
      .collection("valoracionfisioterapias")
      .find({ _datosLegacy: { $exists: true, $ne: null } })
      .toArray();

    console.log(`Encontradas ${valoracionesMongo.length} valoraciones con _datosLegacy en MongoDB`);

    let actualizadas = 0;
    let noEncontradas = 0;
    let errores = 0;

    for (const v of valoracionesMongo) {
      try {
        // 1. Encontrar el paciente en MongoDB para obtener su número de documento
        const pacienteMongo = await db.collection("pacientes").findOne({ _id: v.paciente });
        
        if (!pacienteMongo || !pacienteMongo.numDocumentoIdentificacion) {
          console.warn(`⚠️ Paciente no encontrado o sin documento en MongoDB para la valoración ${v._id}`);
          noEncontradas++;
          continue;
        }

        const docIdentidad = pacienteMongo.numDocumentoIdentificacion;

        // 2. Encontrar el paciente en PostgreSQL
        const resPacientePg = await pgClient.query(
          "SELECT id FROM pacientes WHERE num_documento_identificacion = $1",
          [docIdentidad]
        );

        if (resPacientePg.rows.length === 0) {
          console.warn(`⚠️ Paciente con doc ${docIdentidad} no encontrado en PostgreSQL`);
          noEncontradas++;
          continue;
        }

        const pacienteIdPg = resPacientePg.rows[0].id;

        // 3. Encontrar la valoración en PostgreSQL
        // El script original usó fecha_inicio_atencion (que es v.fechaInicioAtencion || v.createdAt || new Date(0))
        const fechaAtencion = v.fechaInicioAtencion || v.createdAt || new Date(0);

        const resValPg = await pgClient.query(
          "SELECT id FROM valoraciones_fisioterapia WHERE paciente_id = $1 AND tipo_programa = $2 ORDER BY ABS(EXTRACT(EPOCH FROM (fecha_inicio_atencion - $3::timestamp))) LIMIT 1",
          [pacienteIdPg, v.tipoPrograma, fechaAtencion]
        );

        if (resValPg.rows.length === 0) {
          console.warn(`⚠️ Valoración no encontrada en PG para paciente ${docIdentidad} y fecha ${fechaAtencion}`);
          noEncontradas++;
          continue;
        }

        const valoracionIdPg = resValPg.rows[0].id;

        // 4. Actualizar datos_legacy en PostgreSQL
        await pgClient.query(
          "UPDATE valoraciones_fisioterapia SET datos_legacy = $1 WHERE id = $2",
          [JSON.stringify(v._datosLegacy), valoracionIdPg]
        );

        actualizadas++;
      } catch (err) {
        console.error(`❌ Error procesando valoración ${v._id}:`, err);
        errores++;
      }
    }

    console.log("\n=========================================");
    console.log("Resumen del parcheo:");
    console.log(`✅ Actualizadas: ${actualizadas}`);
    console.log(`⚠️ No encontradas/omitiadas: ${noEncontradas}`);
    console.log(`❌ Errores: ${errores}`);
    console.log("=========================================\n");

  } catch (error) {
    console.error("Error crítico durante el parcheo:", error);
  } finally {
    await mongoClient.close();
    await pgClient.end();
  }
}

patchLegacyData();
