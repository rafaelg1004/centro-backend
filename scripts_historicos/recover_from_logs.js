const mongoose = require('mongoose');
require('dotenv').config();

async function recover() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const Paciente = db.collection('pacientes');

    // Buscar registros de creación de pacientes en los logs
    const patientLogs = await db.collection('logs').find({
        $or: [
            { "details.path": "/api/registro", "details.method": "POST" },
            { "details.path": "/api/pacientes", "details.method": "POST" }
        ]
    }).toArray();

    console.log(`Found ${patientLogs.length} patient creation logs.`);
    let restored = 0;

    for (const log of patientLogs) {
        const data = log.details?.body;
        if (!data) continue;

        const docNum = data.numDocumentoIdentificacion || data.registroCivil || data.cedula || data.numDocumento;
        if (!docNum) continue;

        // Verificar si ya existe el paciente
        const exists = await Paciente.findOne({ numDocumentoIdentificacion: String(docNum) });
        if (!exists) {
            const isAdult = ['CC', 'CE', 'PA', 'PE'].includes(data.tipoDocumentoIdentificacion) || !data.registroCivil;

            const newDoc = {
                tipoDocumentoIdentificacion: data.tipoDocumentoIdentificacion || (isAdult ? 'CC' : 'RC'),
                numDocumentoIdentificacion: String(docNum),
                nombres: data.nombres || 'RECU_LOG',
                apellidos: data.apellidos || '',
                fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : new Date(2000, 0, 1),
                codSexo: data.genero?.startsWith('M') ? 'M' : 'F',
                esAdulto: isAdult,
                datosContacto: {
                    direccion: data.direccion,
                    telefono: data.celular || data.telefono,
                    nombreAcompanante: data.nombreMadre || data.nombrePadre
                },
                aseguradora: data.aseguradora,
                createdAt: log.timestamp || new Date(),
                _recoveredFromLog: true
            };
            await Paciente.insertOne(newDoc);
            restored++;
        }
    }

    console.log(`Restoration complete. ${restored} records added.`);
    await mongoose.disconnect();
}

recover();
