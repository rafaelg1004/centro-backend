const mongoose = require('mongoose');
require('dotenv').config();

async function showLogs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const count = await db.collection('logs').countDocuments({ user: 'Dayanvillegas' });
    console.log('Logs por Dayanvillegas:', count);
    const sample = await db.collection('logs').findOne({ user: 'Dayanvillegas' });
    console.log('Sample:', JSON.stringify(sample, null, 2));
    await mongoose.disconnect();
}

showLogs();
