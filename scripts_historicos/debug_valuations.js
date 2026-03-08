const mongoose = require('mongoose');
require('dotenv').config();

async function checkValuations() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const v = await db.collection('valoracionfisioterapias').find({}).toArray();
    console.log('Total valuations:', v.length);
    if (v.length > 0) {
        console.log('First valuation patient ID:', v[0].paciente);
        const p = await db.collection('pacientes').findOne({ _id: v[0].paciente });
        console.log('Found patient for first valuation?', !!p);
    }
    await mongoose.disconnect();
}

checkValuations();
