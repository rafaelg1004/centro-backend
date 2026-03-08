const mongoose = require('mongoose');
require('dotenv').config();

async function deepAudit() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log('--- REPORTE DE VOLUMEN DE DATOS ---');

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        if (count > 0) {
            console.log(`Colección: ${col.name.padEnd(30)} | Documentos: ${count}`);
        }
    }

    const pacientesActuales = await db.collection('pacientes').countDocuments();
    console.log(`\nTotal en 'pacientes' (Unificada): ${pacientesActuales}`);

    // Buscar colecciones que puedan tener los +3000 pacientes
    const legacyNames = ['pacientebf', 'pacientes_backup', 'pacientes_old', 'users', 'clientes', 'afiliados'];
    for (const name of legacyNames) {
        if (collections.find(c => c.name === name)) {
            const c = await db.collection(name).countDocuments();
            console.log(`⚠️ Posible origen de datos (${name}): ${c} registros`);
        }
    }

    await mongoose.disconnect();
}

deepAudit();
