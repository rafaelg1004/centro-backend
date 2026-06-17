const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('centro_estimulacion');
    const pacientesCollection = db.collection('pacientes');
    
    const emilio = await pacientesCollection.findOne({ nombres: { $regex: /Emilio/, $options: 'i' } });
    if (emilio) {
       console.log(`Emilio ID: ${emilio._id}`);
       console.log(`Emilio Timestamp: ${emilio._id.getTimestamp()}`);
    } else {
       console.log("No se encontró a Emilio en Mongo");
    }
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
