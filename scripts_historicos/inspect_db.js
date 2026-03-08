const mongoose = require('mongoose');
require('dotenv').config();

async function listCollections() {
    await mongoose.connect(process.env.MONGODB_URI);
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    for (const coll of collections) {
        const count = await mongoose.connection.db.collection(coll.name).countDocuments();
        console.log(`- ${coll.name}: ${count} documents`);
        if (count > 0) {
            const doc = await mongoose.connection.db.collection(coll.name).findOne();
            console.log(`  Sample keys: ${Object.keys(doc).join(', ')}`);
        }
    }

    await mongoose.disconnect();
}

listCollections().catch(console.error);
