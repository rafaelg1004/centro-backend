const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const sample = await db.collection('pacientes').findOne({ esAdulto: true });
    console.log('Sample Adult:', JSON.stringify(sample, null, 2));

    const withFum = await db.collection('pacientes').countDocuments({ fum: { $exists: true, $ne: "" } });
    console.log('Patients with FUM:', withFum);

    const withSemana = await db.collection('pacientes').countDocuments({ semanasGestacion: { $exists: true, $ne: "" } });
    console.log('Patients with Semanas Gestacion:', withSemana);

    await mongoose.disconnect();
}

check();
