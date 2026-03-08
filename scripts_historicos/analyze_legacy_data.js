const mongoose = require('mongoose');
require('dotenv').config();

async function analyzeLegacyData() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const legacyCollections = [
        'valoracioningresos',
        'valoracioningresoadultoslactancias',
        'valoracionpisopelvicos',
        'consentimientoperinatals'
    ];

    console.log('--- ANALIZANDO COLECCIONES LEGACY ---');

    for (const colName of legacyCollections) {
        console.log(`\nColeccion: ${colName}`);
        try {
            const docs = await db.collection(colName).find().toArray();
            console.log(`Total documentos: ${docs.length}`);

            let missingPatients = 0;
            let sampleMissing = null;

            for (const doc of docs) {
                // El campo que vincula al paciente a veces es paciente, o nino, o string, o ObjectId
                const patientId = doc.paciente || doc.nino || (doc._datosLegacy && doc._datosLegacy.paciente);

                if (!patientId) {
                    missingPatients++;
                    if (!sampleMissing) sampleMissing = doc;
                    continue;
                }

                // Intentar buscar en pacientes unificados
                let p = null;
                try {
                    p = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(patientId) });
                } catch (e) {
                    // Por si es string no válido
                }

                if (!p) {
                    missingPatients++;
                    if (!sampleMissing) sampleMissing = doc;
                }
            }

            console.log(`Pacientes huérfanos/faltantes: ${missingPatients}`);
            if (sampleMissing) {
                console.log(`Ejemplo de documento huérfano (solo campos base):`);
                const { _id, paciente, nombres, apellidos, nombrePaciente, registroCivil, cedula, documento, ...rest } = sampleMissing;
                console.log(JSON.stringify({ _id, paciente, nombres, apellidos, nombrePaciente, registroCivil, cedula, documento }, null, 2));
            }

        } catch (error) {
            console.log(`Error leyendo ${colName}:`, error.message);
        }
    }

    await mongoose.disconnect();
}

analyzeLegacyData();
