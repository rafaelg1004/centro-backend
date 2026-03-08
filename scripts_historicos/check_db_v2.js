const mongoose = require('mongoose');
require('dotenv').config();

async function checkCollections() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const countConsentimiento = await db.collection('consentimientoperinatals').countDocuments();
    const countLactanciaLegacy = await db.collection('valoracioningresoadultoslactancias').countDocuments();

    console.log('Consentimientos Perinatales:', countConsentimiento);
    console.log('Valoraciones Lactancia Legacy:', countLactanciaLegacy);

    await mongoose.disconnect();
}

checkCollections();
