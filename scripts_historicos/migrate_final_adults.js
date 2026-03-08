const mongoose = require('mongoose');
require('dotenv').config();

async function migrateAdults() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const adults = await db.collection('pacienteadultos').find().toArray();
    console.log(`Found ${adults.length} patients in 'pacienteadultos'`);

    let migrated = 0;
    let skipped = 0;

    for (const a of adults) {
        const docNum = a.cedula || a.numDocumentoIdentificacion;
        if (!docNum) {
            console.log(`Skipping patient without ID: ${a.nombres}`);
            skipped++;
            continue;
        }

        const exists = await db.collection('pacientes').findOne({ numDocumentoIdentificacion: String(docNum) });
        if (!exists) {
            const newDoc = {
                tipoDocumentoIdentificacion: a.tipoDocumentoIdentificacion || 'CC',
                numDocumentoIdentificacion: String(docNum),
                nombres: a.nombres,
                apellidos: a.apellidos || '',
                fechaNacimiento: a.fechaNacimiento || new Date(1980, 0, 1),
                codSexo: 'F',
                esAdulto: true,
                aseguradora: a.aseguradora,
                datosContacto: {
                    direccion: a.direccion,
                    telefono: a.celular || a.telefono,
                    nombreAcompanante: a.acompanante
                },
                createdAt: a.createdAt || new Date(),
                _migratedFromAdults: true
            };
            await db.collection('pacientes').insertOne(newDoc);
            migrated++;
        } else {
            skipped++;
        }
    }

    console.log(`Migration complete. Migrated: ${migrated}, Skipped (already exist): ${skipped}`);
    await mongoose.disconnect();
}

migrateAdults();
