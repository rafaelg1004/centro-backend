const mongoose = require('mongoose');
require('dotenv').config();

async function cleanOutput() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const valoraciones = await db.collection('valoracionfisioterapias').find({}).toArray();
    let unassigned = 0;

    for (const v of valoraciones) {
        let p = null;
        if (v.paciente) {
            try {
                p = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(v.paciente) });
            } catch (e) { }
        }
        if (!p) {
            unassigned++;
        }
    }
    console.log('Total unassigned patients in valoraciones:', unassigned);
    await mongoose.disconnect();
}
cleanOutput();
