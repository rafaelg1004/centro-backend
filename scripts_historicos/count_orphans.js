const mongoose = require('mongoose');
require('dotenv').config();

async function checkOrphans() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    // Buscar valoraciones que tengan pacientes que NO existen
    const valuations = await db.collection('valoracionfisioterapias').find().toArray();
    let uniqueOrphans = new Set();

    for (const v of valuations) {
        const p = await db.collection('pacientes').findOne({ _id: v.paciente });
        if (!p) {
            uniqueOrphans.add(String(v.paciente));
        }
    }

    console.log(`Historias detectadas: ${valuations.length}`);
    console.log(`Pacientes huérfanos (ID único): ${uniqueOrphans.size}`);

    await mongoose.disconnect();
}

checkOrphans();
