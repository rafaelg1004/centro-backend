const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('centro_estimulacion');
    const pacientesCollection = db.collection('pacientes');
    
    const ids = ['bada2d21-dcf3-46af-ac87-88c18bf9a8a5', '42151b11-f106-4f2f-bbd1-a4f589d978ee'];
    
    for (const id of ids) {
       console.log(`\n=================== ID in Mongo: ${id} ===================`);
       const p = await pacientesCollection.findOne({ _id: id });
       if (p) {
          console.log(`Found!`);
          console.log(JSON.stringify(p, null, 2));
       } else {
          console.log(`Not found.`);
          // Let's also search if the ID might be a string inside some other field or maybe it's in a different collection
          const val = await db.collection('valoraciones_fisioterapia').findOne({ _id: id });
          if (val) {
             console.log(`Found in valoraciones_fisioterapia!`);
             console.log(JSON.stringify(val, null, 2));
          }
       }
    }

  } finally {
    await client.close();
  }
}

run().catch(console.dir);
