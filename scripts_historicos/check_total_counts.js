const mongoose = require('mongoose');
require('dotenv').config();

async function checkTotalCounts() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collections = ['pacientes', 'pacienteadultos', 'pacientebf', 'valoracionfisioterapias'];

    console.log('--- CONTEO TOTAL DE PACIENTES POTENCIALES ---');
    for (const name of collections) {
        try {
            const count = await db.collection(name).countDocuments();
            console.log(`${name.padEnd(25)}: ${count}`);
        } catch (e) {
            console.log(`${name.padEnd(25)}: [No existe]`);
        }
    }

    await mongoose.disconnect();
}

checkTotalCounts();
