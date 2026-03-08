const mongoose = require('mongoose');
require('dotenv').config();

async function inspectMissingNames() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const patients = await db.collection('pacientes').find({ nombres: 'SIN NOMBRE ASIGNADO' }).toArray();
    console.log(`Encontrados ${patients.length} pacientes sin nombre asignado.`);

    for (const p of patients) {
        console.log(`\n--- Paciente ID: ${p._id}, MIG: ${p.numDocumentoIdentificacion} ---`);
        console.log(`Migrado de: ${p._migradoDesde}`);

        // Buscar el documento original
        if (p._migradoDesde && p._refOriginal) {
            const original = await db.collection(p._migradoDesde).findOne({ _id: p._refOriginal });
            if (original) {
                // Imprimir todas las llaves y valores (solo el primer nivel y buscar llaves como 'firma', 'nombre', 'paciente')
                for (const key of Object.keys(original)) {
                    if (key.toLowerCase().includes('nombre') || key.toLowerCase().includes('firma') || key.toLowerCase().includes('cedula') || key.toLowerCase().includes('doc')) {
                        console.log(`  ORIGINAL [${key}]:`, JSON.stringify(original[key]).substring(0, 100));
                    }
                    if (typeof original[key] === 'object' && original[key] !== null && !Array.isArray(original[key])) {
                        for (const subKey of Object.keys(original[key])) {
                            if (subKey.toLowerCase().includes('nombre') || subKey.toLowerCase().includes('firma') || subKey.toLowerCase().includes('cedula') || subKey.toLowerCase().includes('doc')) {
                                console.log(`  ORIGINAL [${key}.${subKey}]:`, JSON.stringify(original[key][subKey]).substring(0, 100));
                            }
                        }
                    }
                }
            } else {
                console.log('Documento original no encontrado por _refOriginal');
            }
        }
    }

    await mongoose.disconnect();
}

inspectMissingNames();
