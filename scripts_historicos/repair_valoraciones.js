const mongoose = require('mongoose');
require('dotenv').config();

async function repairValoracionesLinks() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const valoraciones = await db.collection('valoracionfisioterapias').find({}).toArray();
    let reclinked = 0;

    for (const v of valoraciones) {
        let p = null;
        if (v.paciente) {
            try {
                p = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(v.paciente) });
            } catch (e) { }
        }

        // Is it orphan or has NO paciente?
        if (!p) {
            // Lets try to find the patient using information from _datosLegacy or its own legacy ID

            // 1. By original paciente ID that might have been migrated differently
            let realPatient = null;
            if (v.paciente) {
                try { realPatient = await db.collection('pacientes').findOne({ _refOriginal: v.paciente }); } catch (e) { }
            }

            // 2. By _datosLegacy ID
            if (!realPatient && v._datosLegacy && v._datosLegacy._id) {
                try { realPatient = await db.collection('pacientes').findOne({ _refOriginal: v._datosLegacy._id }); } catch (e) { }
                if (!realPatient) {
                    try { realPatient = await db.collection('pacientes').findOne({ _refOriginal: new mongoose.Types.ObjectId(v._datosLegacy._id) }); } catch (e) { }
                }
            }

            // 3. By cedula/registroCivil
            if (!realPatient && v._datosLegacy) {
                const docNum = v._datosLegacy.cedula || v._datosLegacy.registroCivil || v._datosLegacy.documento;
                if (docNum) {
                    realPatient = await db.collection('pacientes').findOne({ numDocumentoIdentificacion: String(docNum).trim() });
                }
            }

            // 4. By exact name matching
            if (!realPatient && v._datosLegacy) {
                const nameStr = v._datosLegacy.nombres || v._datosLegacy.nombrePaciente;
                if (nameStr) {
                    realPatient = await db.collection('pacientes').findOne({ nombres: nameStr });
                }
            }

            if (realPatient) {
                // We found the actual patient! Update the link.
                await db.collection('valoracionfisioterapias').updateOne(
                    { _id: v._id },
                    { $set: { paciente: realPatient._id } }
                );
                reclinked++;
            } else {
                console.log(`Still orphaned: ${v._id}`);
                if (v._datosLegacy) {
                    console.log(' - Doc num:', v._datosLegacy.cedula || v._datosLegacy.registroCivil);
                    console.log(' - Names:', v._datosLegacy.nombres || v._datosLegacy.nombrePaciente);
                }
            }
        }
    }
    console.log(`Total reclinked: ${reclinked}`);
    await mongoose.disconnect();
}
repairValoracionesLinks();
