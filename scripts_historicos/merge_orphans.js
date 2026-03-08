const mongoose = require('mongoose');
require('dotenv').config();

async function mergeOrphans() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const orphans = await db.collection('pacientes').find({
        $or: [
            { _migradoDesde: 'consentimientoperinatals' },
            { _migradoDesde: 'valoracionpisopelvicos' }
        ]
    }).toArray();

    console.log(`Verificando ${orphans.length} posibles huerfanos para fusionar...`);
    let merged = 0;

    for (const orphan of orphans) {
        // Encontrar la valoracion que apunta a este uerfano
        const val = await db.collection('valoracionfisioterapias').findOne({ paciente: orphan._id });
        if (val) {
            // Sabemos que las valoraciones apuntan a la 'orphan'. Pero la original tenian la relacion en 'doc.paciente' o valor._datosLegacy.paciente..
            const refOld = val._datosLegacy ? val._datosLegacy.paciente : null;
            if (refOld) {
                // Hay algun paciente real migrado desde la tabla de adultos ('_refOriginal' == refOld) ?
                const realPatient = await db.collection('pacientes').findOne({ _refOriginal: new mongoose.Types.ObjectId(refOld) });
                if (realPatient && String(realPatient._id) !== String(orphan._id)) {
                    // SÍ! Encontramos el paciente real. Fusionamos:
                    console.log(`Fusionando ${orphan.nombres} con el paciente real: ${realPatient.nombres}`);

                    // 1. Apuntar valoracion al true patient
                    await db.collection('valoracionfisioterapias').updateOne(
                        { _id: val._id },
                        { $set: { paciente: realPatient._id } }
                    );

                    // 2. Borrar orphan
                    await db.collection('pacientes').deleteOne({ _id: orphan._id });
                    merged++;
                    continue; // todo resuelto
                }
            }
        }
    }
    console.log(`Total fusionados/limpiados: ${merged}`);
    await mongoose.disconnect();
}
mergeOrphans();
