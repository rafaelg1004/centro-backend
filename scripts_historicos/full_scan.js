const mongoose = require('mongoose');
require('dotenv').config();

async function fullScan() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('--- SCANNING ALL COLLECTIONS FOR PATIENTS ---');
    for (const col of collections) {
        const sample = await db.collection(col.name).findOne();
        if (sample && (sample.nombres || sample.nombre || sample.numDocumentoIdentificacion || sample.cedula)) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`Collection: ${col.name.padEnd(25)} | Count: ${count} | Sample Keys: ${Object.keys(sample).join(', ')}`);
        }
    }
    await mongoose.disconnect();
}

fullScan();
