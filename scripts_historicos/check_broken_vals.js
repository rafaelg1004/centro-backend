const mongoose = require('mongoose');
require('dotenv').config();

async function checkVals() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const valoraciones = await db.collection('valoracionfisioterapias').find({}).toArray();
    let broken = 0;

    for (const v of valoraciones) {
        if (!v.paciente) {
            console.log(`HUÉRFANA TOTAL: ${v._id} Tipo: ${v.codConsulta}`);
            broken++;
        } else {
            const p = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(v.paciente) });
            if (!p) {
                console.log(`PUNTERO ROTO: Vals ${v._id} -> Paciente ${v.paciente}`);
                broken++;
            } else if (p.nombres === 'SIN NOMBRE ASIGNADO' || p.nombres === 'AUN SIN NOMBRE') {
                console.log(`TIENE PACIENTE VACÍO: Vals ${v._id} -> Pac ${p._id} (${p.numDocumentoIdentificacion})`);
                broken++;
            }
        }
    }
    console.log(`Valoraciones que tendrían problemas en frontend: ${broken}`);

    await mongoose.disconnect();
}
checkVals();
