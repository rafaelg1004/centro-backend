const mongoose = require('mongoose');
require('dotenv').config();

async function debugVal() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const v = await db.collection('valoracionfisioterapias').findOne({ _id: new mongoose.Types.ObjectId('699d027828eb413688bf25f0') });
    console.log('Valuation:', JSON.stringify(v, null, 2));
    await mongoose.disconnect();
}

debugVal();
