const mongoose = require('mongoose');
require('dotenv').config();

async function fixBooleans() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    // Convertir todos los esAdulto que sean undefined a false (suposición segura para niños)
    await db.collection('pacientes').updateMany(
        { esAdulto: { $exists: false } },
        { $set: { esAdulto: false } }
    );

    // Asegurarse de que los de 'pacienteadultos' tengan esAdulto: true
    const result = await db.collection('pacientes').updateMany(
        { _migratedFromAdults: true },
        { $set: { esAdulto: true } }
    );

    console.log(`Updated migrated adults: ${result.modifiedCount}`);

    const stats = await db.collection('pacientes').aggregate([
        { $group: { _id: "$esAdulto", count: { $sum: 1 } } }
    ]).toArray();

    console.log('Final stats by esAdulto:', stats);

    await mongoose.disconnect();
}

fixBooleans();
