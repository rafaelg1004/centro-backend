const mongoose = require('mongoose');
require('dotenv').config();

async function showLogs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const count = await db.collection('logs').countDocuments({ "details.path": "/api/pacientes", "details.method": "GET" });
    console.log('GET /api/pacientes logs:', count);
    const sample = await db.collection('logs').findOne({ "details.path": "/api/pacientes", "details.method": "GET" });
    console.log('Sample:', JSON.stringify(sample, null, 2));
    await mongoose.disconnect();
}

showLogs();
