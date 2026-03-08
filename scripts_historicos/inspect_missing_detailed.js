const mongoose = require('mongoose');
require('dotenv').config();

async function inspectMissingNamesDetailed() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const patients = await db.collection('pacientes').find({ nombres: 'SIN NOMBRE ASIGNADO' }).toArray();
    console.log(`Encontrados ${patients.length} pacientes sin nombre.`);

    for (const p of patients) {
        if (!p._migradoDesde || !p._refOriginal) continue;

        const doc = await db.collection(p._migradoDesde).findOne({ _id: p._refOriginal });
        if (!doc) continue;

        let foundName = null;
        let foundDoc = null;

        // Reglas especificas para 'consentimientoperinatals'
        if (p._migradoDesde === 'consentimientoperinatals') {
            if (doc.firmas && doc.firmas.pacienteOAcudiente) {
                foundName = doc.firmas.pacienteOAcudiente.nombre;
                foundDoc = doc.firmas.pacienteOAcudiente.cedula;
            }
        }
        else if (p._migradoDesde === 'valoracionpisopelvicos') {
            if (doc.firmas && doc.firmas.pacienteOAcudiente) {
                foundName = doc.firmas.pacienteOAcudiente.nombre;
                foundDoc = doc.firmas.pacienteOAcudiente.cedula;
            }
        }
        else if (p._migradoDesde === 'valoracioningresoadultoslactancias') {
            if (doc.nombres) foundName = doc.nombres;
        }

        console.log(`[${p._migradoDesde}] P_${p._id}: Name=${foundName}, Doc=${foundDoc}`);
    }

    await mongoose.disconnect();
}

inspectMissingNamesDetailed();
