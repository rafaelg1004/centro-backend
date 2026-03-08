const mongoose = require('mongoose');
require('dotenv').config();

async function fullScan() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`COL: ${col.name} | TOTAL: ${count}`);
    }
    await mongoose.disconnect();
}

fullScan();
