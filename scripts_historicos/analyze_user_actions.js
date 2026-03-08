const mongoose = require('mongoose');
require('dotenv').config();

async function showLogs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const actions = await db.collection('logs').aggregate([
        { $match: { user: 'Dayanvillegas' } },
        { $group: { _id: "$action", count: { $sum: 1 } } }
    ]).toArray();
    console.log('--- ACCIONES DE Dayanvillegas ---');
    actions.forEach(a => console.log(`${String(a._id).padEnd(30)} | ${a.count}`));
    await mongoose.disconnect();
}

showLogs();
