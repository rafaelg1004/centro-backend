const mongoose = require('mongoose');
require('dotenv').config();

async function showBadPacientesDetailed() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const valoraciones = await db.collection('valoracionfisioterapias').find({}).toArray();

    let pacientesMalosIds = new Set();

    for (const v of valoraciones) {
        if (!v.paciente) continue;
        const p = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(v.paciente) });
        if (p && (p.nombres === 'SIN NOMBRE ASIGNADO' || p.nombres === 'AUN SIN NOMBRE' || p.nombres === null || p.nombres === undefined || p.nombres.trim() === '')) {
            pacientesMalosIds.add(String(p._id));
        }
    }

    for (const id of pacientesMalosIds) {
        const bp = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(id) });
        const doc = await db.collection(bp._migradoDesde).findOne({ _id: bp._refOriginal });
        console.log(`\n\n=== MALO ID: ${id} ===`);
        console.log(`Migrado: ${bp._migradoDesde}, Ref: ${bp._refOriginal}`);
        console.log(JSON.stringify(doc, null, 2));
    }

    await mongoose.disconnect();
}
showBadPacientesDetailed();
