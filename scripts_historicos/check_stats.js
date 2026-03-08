const mongoose = require('mongoose');
require('dotenv').config();

async function checkStats() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const total = await db.collection('pacientes').countDocuments();
    const adults = await db.collection('pacientes').countDocuments({ esAdulto: true });
    const children = await db.collection('pacientes').countDocuments({ esAdulto: false });
    const nullAdult = await db.collection('pacientes').countDocuments({ esAdulto: { $exists: false } });

    console.log(`Total: ${total}`);
    console.log(`Adults (true): ${adults}`);
    console.log(`Children (false): ${children}`);
    console.log(`EsAdulto missing: ${nullAdult}`);

    await mongoose.disconnect();
}

checkStats();
