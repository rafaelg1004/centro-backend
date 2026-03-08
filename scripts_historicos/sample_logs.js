const mongoose = require('mongoose');
require('dotenv').config();

async function showLogs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const sample = await db.collection('logs').findOne();
    console.log('Log Sample:', JSON.stringify(sample, null, 2));
    await mongoose.disconnect();
}

showLogs();
