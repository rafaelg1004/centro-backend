const mongoose = require('mongoose');
require('dotenv').config();

async function listDbs() {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    const admin = conn.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('--- BASES DE DATOS ---');
    console.log(JSON.stringify(dbs.databases, null, 2));

    for (const dbInfo of dbs.databases) {
        if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
        const db = conn.connection.useDb(dbInfo.name);
        const cols = await db.db.listCollections().toArray();
        console.log(`\nDB: ${dbInfo.name}`);
        for (const c of cols) {
            const count = await db.db.collection(c.name).countDocuments();
            console.log(`  - ${c.name}: ${count}`);
        }
    }

    await mongoose.disconnect();
}

listDbs();
