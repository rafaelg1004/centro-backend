const mongoose = require('mongoose');
require('dotenv').config();

async function showLogs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const actions = await db.collection('logs').aggregate([
        { $match: { user: 'Dayanvillegas', action: 'ACCESO_PERMITIDO' } },
        { $group: { _id: "$details.path", count: { $sum: 1 } } }
    ]).toArray();
    console.log('--- RUTAS ACCEDIDAS POR Dayanvillegas ---');
    actions.forEach(a => console.log(`${String(a._id).padEnd(40)} | ${a.count}`));
    await mongoose.disconnect();
}

showLogs();
