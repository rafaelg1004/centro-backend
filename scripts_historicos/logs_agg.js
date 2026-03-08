const mongoose = require('mongoose');
require('dotenv').config();

async function logsAnalysis() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const logs = await db.collection('logs').aggregate([
        {
            $group: {
                _id: {
                    method: "$details.method",
                    path: "$details.path"
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]).toArray();

    console.log('--- ENPOINTS IMPORTANTES ---');
    logs.filter(l => l.count > 10).forEach(l => {
        console.log(`${String(l._id.method).padEnd(6)} | ${String(l._id.path).padEnd(40)} | ${l.count}`);
    });

    await mongoose.disconnect();
}

logsAnalysis();
