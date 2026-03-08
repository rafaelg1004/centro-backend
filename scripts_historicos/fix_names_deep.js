const mongoose = require('mongoose');
require('dotenv').config();

async function deepDeepFixNames() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const patients = await db.collection('pacientes').find({ nombres: 'AUN SIN NOMBRE' }).toArray();

    // Y los que esten sin nombre en general
    const morePatients = await db.collection('pacientes').find({ nombres: 'SIN NOMBRE ASIGNADO' }).toArray();

    const allP = [...patients, ...morePatients];
    console.log(`Buscando solución final para ${allP.length} pacientes`);

    for (const p of allP) {
        if (!p._migradoDesde || !p._refOriginal) continue;

        const doc = await db.collection(p._migradoDesde).findOne({ _id: p._refOriginal });
        if (doc && doc.paciente) {
            // El campo paciente en esos docs apuntaba a una de las colecciones de pacientes originales
            try {
                // intentemos pacienteadultos
                let ref = await db.collection('pacienteadultos').findOne({ _id: new mongoose.Types.ObjectId(doc.paciente) });

                // Si no, probemos en la original de pacientes (niños) legacy 
                if (!ref) {
                    ref = await db.collection('pacientes_legacy_backup').findOne({ _id: new mongoose.Types.ObjectId(doc.paciente) });
                }

                // Si nada, buscamos directamente sobre la coleccion pacientes a ver si lo creamos como un duplicado
                if (!ref && doc.paciente.toString().length === 24) {
                    ref = await db.collection('pacientes').findOne({ _refOriginal: new mongoose.Types.ObjectId(doc.paciente) });
                }

                if (ref) {
                    const realName = ref.nombres || ref.nombrePaciente || 'PACIENTE RECUPERADO DE REFERENCIA';
                    const realDoc = ref.cedula || ref.registroCivil || ref.numDocumentoIdentificacion || ref.documento;

                    console.log(`¡ENCONTRADO VIA REF! ${doc.paciente} -> ${realName} - ${realDoc}`);
                    await db.collection('pacientes').updateOne(
                        { _id: p._id },
                        { $set: { nombres: realName, apellidos: ref.apellidos || '', numDocumentoIdentificacion: realDoc || p.numDocumentoIdentificacion } }
                    );
                } else {
                    console.log(`REF ${doc.paciente} NO LLEVA A NINGUN LADO en pacienteadultos.`);
                }
            } catch (e) {
                console.log(`Error parsing OID para ${doc.paciente}`);
            }
        }
    }
    await mongoose.disconnect();
}
deepDeepFixNames();
