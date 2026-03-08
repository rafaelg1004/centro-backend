const mongoose = require('mongoose');
require('dotenv').config();

async function checkTypes() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const v = await db.collection('valoracionfisioterapias').findOne({ _datosLegacyId: { $exists: true } });
    if (v) {
        console.log('Valuation Patient Field Type:', typeof v.paciente);
        console.log('Is valid ObjectId?', mongoose.Types.ObjectId.isValid(v.paciente));
        console.log('Value:', v.paciente);

        const p = await db.collection('pacientes').findOne({ _id: v.paciente });
        console.log('Found patient?', !!p);
    } else {
        console.log('No migrated valuations found');
    }
    await mongoose.disconnect();
}

checkTypes();
