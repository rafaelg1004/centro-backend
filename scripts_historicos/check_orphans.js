const mongoose = require('mongoose');
require('dotenv').config();

async function checkOrphans() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const valuations = await db.collection('valoracionfisioterapias').find().toArray();
    console.log('Total Valuations:', valuations.length);

    let orphans = 0;
    for (const v of valuations) {
        const p = await db.collection('pacientes').findOne({ _id: v.paciente });
        if (!p) {
            orphans++;
            // Try to find by string ID if stored as string
            if (typeof v.paciente === 'string') {
                const p2 = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(v.paciente) });
                if (p2) {
                    console.log(`Found orphan that was stored as string ID! Updating: ${v._id}`);
                    await db.collection('valoracionfisioterapias').updateOne({ _id: v._id }, { $set: { paciente: p2._id } });
                    orphans--;
                }
            } else if (v.paciente instanceof mongoose.Types.ObjectId) {
                // Try search in old collection just in case
                const oldP = await db.collection('pacienteadultos').findOne({ _id: v.paciente });
                if (oldP) {
                    console.log(`Found orphan linked to old collection! Patient: ${oldP.nombres}. Need migration.`);
                }
            }
        }
    }
    console.log('Total Orphans after string check:', orphans);

    await mongoose.disconnect();
}

checkOrphans();
