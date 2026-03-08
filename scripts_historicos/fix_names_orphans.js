const mongoose = require('mongoose');
require('dotenv').config();

async function findNames() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const patients = await db.collection('pacientes').find({ nombres: 'SIN NOMBRE ASIGNADO' }).toArray();

    for (const p of patients) {
        const _idOriginal = p._refOriginal;
        const _migradoDesde = p._migradoDesde;

        if (_migradoDesde === 'consentimientoperinatals') {
            const doc = await db.collection('consentimientoperinatals').findOne({ _id: _idOriginal });
            if (doc) {
                const name = doc.nombrePaciente || doc.nombres || doc.firmaNombre || doc.consentimientoNombre || 'AUN SIN NOMBRE';
                const cc = doc.documentoPaciente || doc.cedula || doc.consentimientoCC || null;
                console.log(`PERINATAL -> Update: ${p._id} Name: ${name} CC: ${cc}`);

                if (name !== 'AUN SIN NOMBRE' || cc) {
                    await db.collection('pacientes').updateOne(
                        { _id: p._id },
                        { $set: { nombres: name, numDocumentoIdentificacion: cc || p.numDocumentoIdentificacion } }
                    );
                }
            }
        }
        else if (_migradoDesde === 'valoracionpisopelvicos') {
            const doc = await db.collection('valoracionpisopelvicos').findOne({ _id: _idOriginal });
            if (doc) {
                // Hay veces que no lo llenaban en los campos iniciales sino en el consentimiento final
                const name = doc.consentimientoNombre || doc.firmaNombre || doc.nombres || doc.nombrePaciente || 'PACIENTE PISO PELVICO';
                const cc = doc.consentimientoCC || doc.cedula || doc.documento || null;
                console.log(`PISO PELVICO -> Update: ${p._id} Name: ${name} CC: ${cc}`);

                if (name !== 'PACIENTE PISO PELVICO' || cc) {
                    await db.collection('pacientes').updateOne(
                        { _id: p._id },
                        { $set: { nombres: name, numDocumentoIdentificacion: cc || p.numDocumentoIdentificacion } }
                    );
                } else if (name === 'PACIENTE PISO PELVICO' && !cc && !doc.consentimientoNombre) {
                    // Try to extract from previous refs
                    if (doc.paciente) {
                        try {
                            const refP = await db.collection('pacienteadultos').findOne({ _id: new mongoose.Types.ObjectId(doc.paciente) });
                            if (refP) {
                                console.log(`Found ref PP: ${refP.nombres} CC: ${refP.cedula}`);
                                await db.collection('pacientes').updateOne(
                                    { _id: p._id },
                                    { $set: { nombres: refP.nombres, numDocumentoIdentificacion: refP.cedula || refP.documento || p.numDocumentoIdentificacion } }
                                );
                            }
                        } catch (e) { }
                    }
                }
            }
        }
    }
    await mongoose.disconnect();
}
findNames();
