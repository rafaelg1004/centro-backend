const mongoose = require('mongoose');
require('dotenv').config();

async function migrateSessions() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const EvolucionSesion = db.collection('evolucionsesions');
    const legacySessions = await db.collection('sesionperinatalpacientes').find().toArray();

    console.log(`Migrating ${legacySessions.length} perinatal sessions...`);

    for (const ls of legacySessions) {
        // Check if already migrated
        const exists = await EvolucionSesion.findOne({ _datosLegacyId: ls._id.toString() });
        if (exists) continue;

        const newS = {
            paciente: ls.paciente,
            fechaInicioAtencion: ls.fechaRegistro || new Date(),
            codProcedimiento: '890204', // Perinatal
            finalidadTecnologiaSalud: '44',
            codDiagnosticoPrincipal: 'Z348',
            descripcionEvolucion: ls.nombreSesion || `Sesión Perinatal (${ls.tipoPrograma})`,
            firmas: {
                paciente: { firmaUrl: ls.firmaPaciente, timestamp: ls.fechaRegistro }
            },
            bloqueada: ls.estado === 'cerrada',
            _datosLegacyId: ls._id.toString(),
            _datosLegacy: ls,
            createdAt: ls.fechaRegistro || new Date()
        };
        await EvolucionSesion.insertOne(newS);
    }

    console.log('✅ Sessions migrated.');
    await mongoose.disconnect();
}

migrateSessions().catch(console.error);
