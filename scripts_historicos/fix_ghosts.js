const mongoose = require('mongoose');
require('dotenv').config();

async function fixGhostPatients() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const result = await db.collection('pacientes').updateMany(
        {
            $or: [
                { nombres: 'SIN NOMBRE ASIGNADO' },
                { nombres: 'AUN SIN NOMBRE' }
            ]
        },
        {
            $set: {
                nombres: 'PACIENTE ELIMINADO',
                apellidos: '(Históricamente)',
                aseguradora: 'N/A'
            }
        }
    );

    console.log(`Fantasmas actualizados: ${result.modifiedCount}`);
    await mongoose.disconnect();
}
fixGhostPatients();
