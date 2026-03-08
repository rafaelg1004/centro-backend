const mongoose = require('mongoose');
require('dotenv').config();

async function logOneDoc() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const patient = await db.collection('pacientes').findOne({ nombres: 'SIN NOMBRE ASIGNADO', _migradoDesde: 'consentimientoperinatals' });
    if (patient) {
        console.log('--- PERINATAL ORPHAN PACIENTES ---');
        console.log('Paciente ID:', patient._id);
        const doc = await db.collection('consentimientoperinatals').findOne({ _id: patient._refOriginal });
        if (doc) {
            console.log(JSON.stringify(doc, null, 2));
        }
    }

    const patientPP = await db.collection('pacientes').findOne({ nombres: 'SIN NOMBRE ASIGNADO', _migradoDesde: 'valoracionpisopelvicos' });
    if (patientPP) {
        console.log('\n--- PISO PELVICO ORPHAN PACIENTES ---');
        console.log('Paciente ID:', patientPP._id);
        const docPP = await db.collection('valoracionpisopelvicos').findOne({ _id: patientPP._refOriginal });
        if (docPP) {
            console.log(JSON.stringify(docPP, null, 2));
        }
    }

    await mongoose.disconnect();
}
logOneDoc();
