const mongoose = require('mongoose');
require('dotenv').config();

async function checkPacientes() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const count = await db.collection('pacientes').countDocuments();
    const first = await db.collection('pacientes').findOne();
    console.log('Total pacientes in unified collection:', count);
    console.log('Sample paciente:', JSON.stringify(first, null, 2));
    await mongoose.disconnect();
}

checkPacientes();
