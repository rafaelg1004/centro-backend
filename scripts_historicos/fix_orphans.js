const mongoose = require('mongoose');
require('dotenv').config();

async function fixOrphans() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const valuations = await db.collection('valoracionfisioterapias').find().toArray();
    const Paciente = db.collection('pacientes');

    console.log('--- Fixing Orphans ---');
    for (const v of valuations) {
        let p = await Paciente.findOne({ _id: v.paciente });
        if (!p) {
            console.log(`Valuation ${v._id} has orphan patient ID ${v.paciente}`);

            // Search in old collections
            let oldP = await db.collection('pacienteadultos').findOne({ _id: v.paciente });
            if (!oldP) {
                // Try searching by numDocumento in the legacy data of the valuation if available
                const docLegacy = v._datosLegacy?.numDocumentoIdentificacion || v._datosLegacy?.cedula || v._datosLegacy?.paciente?.numDocumentoIdentificacion;
                if (docLegacy) {
                    p = await Paciente.findOne({ numDocumentoIdentificacion: docLegacy });
                    if (p) {
                        console.log(`Found patient by document ${docLegacy}. Updating valuation.`);
                        await db.collection('valoracionfisioterapias').updateOne({ _id: v._id }, { $set: { paciente: p._id } });
                        continue;
                    }
                }
            } else {
                console.log(`Found patient in old collection: ${oldP.nombres}. Migrating now...`);
                const newDoc = {
                    tipoDocumentoIdentificacion: oldP.tipoDocumentoIdentificacion || 'CC',
                    numDocumentoIdentificacion: oldP.cedula || oldP.numDocumentoIdentificacion || `MIG_${Date.now()}_${Math.random()}`,
                    nombres: oldP.nombres || 'SIN NOMBRE',
                    apellidos: oldP.apellidos || '',
                    fechaNacimiento: oldP.fechaNacimiento || new Date(1980, 0, 1),
                    codSexo: 'F',
                    esAdulto: true,
                    datosContacto: { telefono: oldP.telefono },
                    createdAt: oldP.createdAt || new Date()
                };
                const result = await Paciente.insertOne(newDoc);
                await db.collection('valoracionfisioterapias').updateOne({ _id: v._id }, { $set: { paciente: result.insertedId } });
                console.log(`Patient migrated and valuation updated.`);
            }
        }
    }

    await mongoose.disconnect();
}

fixOrphans();
