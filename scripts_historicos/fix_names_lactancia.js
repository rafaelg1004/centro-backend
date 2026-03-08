const mongoose = require('mongoose');
require('dotenv').config();

async function fixNames() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const legacy = await db.collection('valoracioningresoadultoslactancias').find().toArray();
    for (const l of legacy) {
        const docNum = l.cedula || l.documento;
        if (docNum) {
            const result = await db.collection('pacientes').updateOne(
                { numDocumentoIdentificacion: String(docNum).trim() },
                { $set: { nombres: l.nombres, esAdulto: true } }
            );
            if (result.modifiedCount > 0) {
                console.log(`Updated names for ${l.nombres} (${docNum})`);
            }
        }
    }
    await mongoose.disconnect();
}
fixNames();
