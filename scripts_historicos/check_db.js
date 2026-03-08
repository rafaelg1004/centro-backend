const mongoose = require('mongoose');
require('dotenv').config();

async function checkCollections() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    // Check if there's a perinatal collection
    const perinatalCount = await db.collection('valoracionperinatals').countDocuments();
    console.log('Valoraciones Perinatal count:', perinatalCount);

    await mongoose.disconnect();
}

checkCollections();
