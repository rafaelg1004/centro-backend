const mongoose = require('mongoose');
require('dotenv').config();

async function checkValuations() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const count = await db.collection('valoracionfisioterapias').countDocuments();
    const first = await db.collection('valoracionfisioterapias').findOne();
    console.log('Total valuations in unified collection:', count);
    console.log('Sample valuation:', JSON.stringify(first, null, 2));
    await mongoose.disconnect();
}

checkValuations();
