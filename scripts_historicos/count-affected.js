require('dotenv').config();
const mongoose = require('mongoose');
const Paciente = require('./models/Paciente');
const PacienteAdulto = require('./models/PacienteAdulto');
const Clase = require('./models/Clase');

async function countRecords() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const countNinos = await Paciente.countDocuments();
        const countAdultos = await PacienteAdulto.countDocuments();
        const countClases = await Clase.countDocuments();

        console.log('--- Resumen de Datos Comprometidos ---');
        console.log(`Pacientes (Menores): ${countNinos}`);
        console.log(`Pacientes (Adultos): ${countAdultos}`);
        console.log(`Registros de Clases: ${countClases}`);
        console.log('--------------------------------------');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

countRecords();
