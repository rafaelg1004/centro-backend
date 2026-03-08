const mongoose = require('mongoose');
require('dotenv').config();

async function showLogs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const sample = await db.collection('logs').findOne({ action: 'ACCESO_PERMITIDO', user: 'Dayanvillegas' });
    console.log('Dayan Access Sample:', JSON.stringify(sample, null, 2));
    await mongoose.disconnect();
}

showLogs();
