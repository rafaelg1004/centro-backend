const mongoose = require('mongoose');
require('dotenv').config();

async function checkSessions() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const count = await db.collection('sesionperinatalpacientes').countDocuments();
    console.log('Total sessions in sesionperinatalpacientes:', count);
    if (count > 0) {
        const first = await db.collection('sesionperinatalpacientes').findOne();
        console.log('Sample session:', JSON.stringify(first, null, 2));
    }
    await mongoose.disconnect();
}

checkSessions();
