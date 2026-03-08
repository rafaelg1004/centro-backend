const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        const p = await db.collection('pagopaquetes').find({ pacienteId: { $exists: true } }).toArray();
        console.log('Pagos con pacienteId:', p.length);

        const p2 = await db.collection('pagopaquetes').find({}).toArray();
        const pacientesVivos = await db.collection('pacientes').find({}, { projection: { _id: 1 } }).toArray();
        const validIds = new Set(pacientesVivos.map(v => v._id.toString()));

        let orphans = 0;
        p2.forEach(x => {
            if (x.nino && !validIds.has(x.nino.toString())) orphans++;
        });
        console.log('Orphan pagos (nino no existe):', orphans);
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
check();
