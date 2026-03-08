const mongoose = require('mongoose');
require('dotenv').config();

async function fixOrphans() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const valuations = await db.collection('valoracionfisioterapias').find().toArray();
    const Paciente = db.collection('pacientes');

    console.log('--- Fixing Orphans (Advanced) ---');
    for (const v of valuations) {
        let p = await Paciente.findOne({ _id: v.paciente });
        if (!p) {
            console.log(`Valuation ${v._id} has orphan patient ID ${v.paciente}`);

            // Try searching in ALL collections
            const cols = await db.listCollections().toArray();
            let foundLegacy = null;
            let colName = "";

            for (const c of cols) {
                if (c.name === 'pacientes' || c.name === 'valoracionfisioterapias') continue;
                const doc = await db.collection(c.name).findOne({ _id: v.paciente });
                if (doc && (doc.nombres || doc.nombre)) {
                    foundLegacy = doc;
                    colName = c.name;
                    break;
                }
            }

            if (foundLegacy) {
                console.log(`Found donor record in ${colName}: ${foundLegacy.nombres || foundLegacy.nombre}. Migrating...`);
                const newDoc = {
                    tipoDocumentoIdentificacion: foundLegacy.tipoDocumentoIdentificacion || 'CC',
                    numDocumentoIdentificacion: foundLegacy.cedula || foundLegacy.numDocumentoIdentificacion || foundLegacy.registroCivil || `FIX_${Date.now()}_${Math.random()}`,
                    nombres: foundLegacy.nombres || foundLegacy.nombre || 'SIN NOMBRE',
                    apellidos: foundLegacy.apellidos || '',
                    fechaNacimiento: foundLegacy.fechaNacimiento || new Date(1980, 0, 1),
                    codSexo: foundLegacy.genero?.startsWith('M') ? 'M' : 'F',
                    esAdulto: !foundLegacy.registroCivil,
                    datosContacto: { telefono: foundLegacy.telefono || foundLegacy.celular },
                    _fixSource: colName
                };
                const result = await Paciente.insertOne(newDoc);
                await db.collection('valoracionfisioterapias').updateOne({ _id: v._id }, { $set: { paciente: result.insertedId } });
                console.log(`Successfully migrated and linked.`);
            } else {
                console.log(`Could NOT find patient ${v.paciente} in any collection.`);
            }
        }
    }

    await mongoose.disconnect();
}

fixOrphans();
