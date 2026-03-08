const mongoose = require('mongoose');
require('dotenv').config();

async function runUnifiedMigration() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log('--- INICIANDO MIGRACIÓN UNIFICADA DE PACIENTES ---');

    // Mapeo de colecciones y si son adultos
    const legacyCollections = [
        { name: 'valoracioningresos', esAdulto: false }, // Niños
        { name: 'valoracioningresoadultoslactancias', esAdulto: true }, // Adultos
        { name: 'valoracionpisopelvicos', esAdulto: true }, // Adultos
        { name: 'consentimientoperinatals', esAdulto: true } // Maternas (Adultos)
    ];

    let totalMigrados = 0;
    let totalExistentes = 0;

    for (const { name, esAdulto } of legacyCollections) {
        console.log(`\nProcesando colección: ${name}...`);

        try {
            const docs = await db.collection(name).find().toArray();

            for (const doc of docs) {
                // Determinar ID / Documento
                let documentoIdentificacion = doc.registroCivil || doc.cedula || doc.documento || (doc._datosLegacy && (doc._datosLegacy.cedula || doc._datosLegacy.registroCivil));
                let documentoTipo = 'CC';
                if (!esAdulto) documentoTipo = 'RC';

                // Determinar Nombres
                let nombres = doc.nombres || doc.nombrePaciente || (doc._datosLegacy && doc._datosLegacy.nombres) || 'SIN NOMBRE ASIGNADO';
                let apellidos = doc.apellidos || (doc._datosLegacy && doc._datosLegacy.apellidos) || '';

                // Si paciente es un ObjectId, intentar obtenerlo de la DB vieja por si acaso
                const patientRef = doc.paciente || doc.nino;

                // Buscar si ya existe por Documento primero
                let existePaciente = null;

                if (documentoIdentificacion) {
                    existePaciente = await db.collection('pacientes').findOne({ numDocumentoIdentificacion: String(documentoIdentificacion).trim() });
                }

                if (!existePaciente && patientRef) {
                    // Intentar por ID (caso raro si cambiaron la ref de coleccion)
                    try {
                        existePaciente = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(patientRef) });
                    } catch (e) { }
                }

                if (existePaciente) {
                    totalExistentes++;
                    // Si ya existe pero no estaba marcado como adulto y deberia
                    if (esAdulto && !existePaciente.esAdulto) {
                        await db.collection('pacientes').updateOne(
                            { _id: existePaciente._id },
                            { $set: { esAdulto: true } }
                        );
                    }

                    /*
                    // Vincular la valoracion original en el modelo unificado (opcional: ya la tabla valoracionfisioterapias deberia existir per se si se migró)
                    */
                } else {
                    // MIGRAR COMO NUEVO PACIENTE
                    // Generar un doc si no lo traía
                    const numDocFinal = documentoIdentificacion ? String(documentoIdentificacion).trim() : `MIG_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                    const nuevoPaciente = {
                        tipoDocumentoIdentificacion: documentoTipo,
                        numDocumentoIdentificacion: numDocFinal,
                        nombres: nombres,
                        apellidos: apellidos,
                        esAdulto: esAdulto,
                        codSexo: esAdulto ? 'F' : (doc.genero && doc.genero.toLowerCase().startsWith('m') ? 'M' : 'F'),
                        fechaNacimiento: new Date(1980, 0, 1), // Fecha default
                        datosContacto: {
                            telefono: doc.celular || doc.telefono || (doc._datosLegacy && doc._datosLegacy.celular),
                            direccion: doc.direccion,
                            nombreAcompanante: doc.acompanante || doc.nombreMadre || doc.madreNombre
                        },
                        aseguradora: doc.aseguradora,
                        createdAt: doc.createdAt || new Date(),
                        _migradoDesde: name,
                        _refOriginal: doc._id
                    };

                    const result = await db.collection('pacientes').insertOne(nuevoPaciente);

                    // Actualizar la referencia del paciente en el documento origen (opcional, pero util para limpiar)
                    // await db.collection(name).updateOne({ _id: doc._id }, { $set: { paciente: result.insertedId } });

                    // Tambien actualizar en la coleccion de valoraciones unificadas si existe!
                    await db.collection('valoracionfisioterapias').updateMany(
                        { "_datosLegacy._id": doc._id },
                        { $set: { paciente: result.insertedId } }
                    );

                    totalMigrados++;
                }
            }
        } catch (e) {
            console.error(`Error procesando colección ${name}:`, e.message);
        }
    }

    console.log(`\n--- RESUMEN ---`);
    console.log(`Migrados como nuevos pacientes: ${totalMigrados}`);
    console.log(`Omitidos (Ya existían): ${totalExistentes}`);

    await mongoose.disconnect();
}

runUnifiedMigration();
