const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const adults = await db.collection('pacientes').countDocuments({ esAdulto: true });
    const children = await db.collection('pacientes').countDocuments({ esAdulto: false });
    const unknown = await db.collection('pacientes').countDocuments({ esAdulto: { $exists: false } });

    console.log('Adults:', adults);
    console.log('Children:', children);
    console.log('Unknown:', unknown);

    await mongoose.disconnect();
}

check();
