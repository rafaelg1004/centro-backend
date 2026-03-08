const mongoose = require('mongoose');
require('dotenv').config();

async function showLogs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const count = await db.collection('logs').countDocuments({ "details.path": "/api/pacientes-adultos", "details.method": "POST" });
    console.log('Total POST /api/pacientes-adultos logs:', count);
    await mongoose.disconnect();
}

showLogs();
