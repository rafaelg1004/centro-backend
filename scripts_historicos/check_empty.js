const mongoose = require('mongoose');
require('dotenv').config();

async function checkEmpty() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const total = await db.collection('pacientes').countDocuments();
    const noName = await db.collection('pacientes').countDocuments({ $or: [{ nombres: null }, { nombres: "" }, { nombres: { $exists: false } }] });
    const sample = await db.collection('pacientes').findOne({ $or: [{ nombres: null }, { nombres: "" }, { nombres: { $exists: false } }] });

    console.log(`Total: ${total}`);
    console.log(`Without name: ${noName}`);
    if (sample) console.log(`Sample without name: ${JSON.stringify(sample, null, 2)}`);

    await mongoose.disconnect();
}

checkEmpty();
