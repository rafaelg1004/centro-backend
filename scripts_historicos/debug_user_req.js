const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log('--- Patients Check ---');
    const sampleMaternar = await db.collection('pacientes').findOne({ estadoEmbarazo: { $exists: true, $ne: null } });
    console.log('Sample Maternar:', JSON.stringify(sampleMaternar, null, 2));

    const counts = await db.collection('pacientes').aggregate([
        { $group: { _id: "$estadoEmbarazo", count: { $sum: 1 } } }
    ]).toArray();
    console.log('Counts by estadoEmbarazo:', counts);

    console.log('\n--- Valuations Check ---');
    const totalV = await db.collection('valoracionfisioterapias').countDocuments();
    console.log('Total Valuations:', totalV);

    // Check if any have _datosLegacy but missing standard fields
    const missingFields = await db.collection('valoracionfisioterapias').countDocuments({
        $or: [
            { motivoConsulta: { $exists: false } },
            { diagnosticoFisioterapeutico: { $exists: false } }
        ]
    });
    console.log('Valuations with missing standard fields:', missingFields);

    await mongoose.disconnect();
}

check();
