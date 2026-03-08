const mongoose = require('mongoose');
const Paciente = require('./models/Paciente'); // Assuming models/Paciente.js exports the model correctly
require('dotenv').config();

async function findDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB.");

        // Find all non-adult patients
        const ninos = await Paciente.find({ esAdulto: false }).lean();
        console.log(`Total children found: ${ninos.length}`);

        const nameMap = {};
        const idMap = {};
        const duplicateNames = [];
        const duplicateIds = [];

        for (const nino of ninos) {
            // Check by ID
            if (nino.numDocumentoIdentificacion) {
                const id = nino.numDocumentoIdentificacion.trim();
                if (idMap[id]) {
                    idMap[id].push(nino);
                } else {
                    idMap[id] = [nino];
                }
            }

            // Check by Name (normalized)
            if (nino.nombres) {
                const fullName = `${nino.nombres || ''} ${nino.apellidos || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
                if (nameMap[fullName]) {
                    nameMap[fullName].push(nino);
                } else {
                    nameMap[fullName] = [nino];
                }
            }
        }

        // Collect duplicates
        for (const id in idMap) {
            if (idMap[id].length > 1) {
                duplicateIds.push({ id, count: idMap[id].length, records: idMap[id].map(r => ({ _id: r._id, nombres: r.nombres, apellidos: r.apellidos })) });
            }
        }

        for (const name in nameMap) {
            if (nameMap[name].length > 1) {
                duplicateNames.push({ name, count: nameMap[name].length, records: nameMap[name].map(r => ({ _id: r._id, id: r.numDocumentoIdentificacion, nombres: r.nombres, apellidos: r.apellidos })) });
            }
        }

        console.log("--- Duplicate IDs ---");
        console.log(JSON.stringify(duplicateIds, null, 2));

        console.log("--- Duplicate Names ---");
        console.log(JSON.stringify(duplicateNames, null, 2));

    } catch (error) {
        console.error("Error connecting or querying:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from DB.");
    }
}

findDuplicates();
