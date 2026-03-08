const mongoose = require('mongoose');
require('dotenv').config();

async function checkDeadRefs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const deadRefs = [
        "689f4e6ecd318f8eb1fd28b5",
        "689cceba9fdb5de416bdcdc9",
        "689cd4f15d86ef866c1b359f"  // example from earlier
    ];

    for (const ref of deadRefs) {
        console.log(`\nBuscando ${ref}:`);
        let colls = ['pacientes', 'pacienteadultos', 'usuarios'];
        for (const c of colls) {
            try {
                const doc = await db.collection(c).findOne({ _id: new mongoose.Types.ObjectId(ref) });
                if (doc) {
                    console.log(` ENCONTRO EN ${c}:`, doc.nombres || doc.nombre || doc.nombrePaciente || doc.nombresApellidos);
                }
            } catch (e) { }
        }
    }

    await mongoose.disconnect();
}
checkDeadRefs();
