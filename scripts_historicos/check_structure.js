const mongoose = require('mongoose');
require('dotenv').config();

async function checkStructure() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const doc = await db.collection('consentimientoperinatals').findOne();
    console.log('Consentimiento Perinatal Example:', JSON.stringify(doc, null, 2));

    const docLactancia = await db.collection('valoracioningresoadultoslactancias').findOne();
    console.log('Lactancia Legacy Example:', JSON.stringify(docLactancia, null, 2));

    await mongoose.disconnect();
}

checkStructure();
