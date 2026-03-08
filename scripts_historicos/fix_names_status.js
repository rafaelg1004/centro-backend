const mongoose = require('mongoose');
require('dotenv').config();

async function deepDeepFixNamesStatus() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const patients = await db.collection('pacientes').find({
        $or: [
            { nombres: 'AUN SIN NOMBRE' },
            { nombres: 'SIN NOMBRE ASIGNADO' },
            { nombres: { $regex: /MIG_/ } }
        ]
    }).toArray();

    console.log(`Pacientes sin nombre aún encontrados: ${patients.length}`);
    for (const p of patients) {
        console.log(`- ${p.nombres} | Doc: ${p.numDocumentoIdentificacion}`);
    }

    await mongoose.disconnect();
}
deepDeepFixNamesStatus();
