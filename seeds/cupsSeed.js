const mongoose = require('mongoose');
const CodigoCUPS = require('../models/CodigoCUPS');
const ripsConfig = require('../ripsConfig');

// Datos de CUPS para fisioterapia perinatal
const cupsData = [
    // CONSULTAS
    {
        codigo: '890264',
        nombre: 'CONSULTA DE PRIMERA VEZ POR FISIOTERAPIA',
        tipoServicio: 'consulta',
        categoria: 'fisioterapia',
        valor: 90000,
        claveInterna: 'valoracionInicial',
        finalidad: '11',
        grupoServicio: '01',
        modalidad: '09'
    },
    {
        codigo: '890264',
        nombre: 'VALORACIÓN DE PISO PÉLVICO - PRIMERA VEZ',
        tipoServicio: 'consulta',
        categoria: 'pisoPelvico',
        valor: 100000,
        claveInterna: 'valoracionPisoPelvis',
        finalidad: '11',
        grupoServicio: '01',
        modalidad: '09'
    },
    {
        codigo: '890264',
        nombre: 'VALORACIÓN DE LACTANCIA - PRIMERA VEZ',
        tipoServicio: 'consulta',
        categoria: 'lactancia',
        valor: 90000,
        claveInterna: 'valoracionLactancia',
        finalidad: '11',
        grupoServicio: '01',
        modalidad: '09'
    },
    {
        codigo: '890384',
        nombre: 'CONSULTA DE CONTROL O DE SEGUIMIENTO POR FISIOTERAPIA',
        tipoServicio: 'consulta',
        categoria: 'fisioterapia',
        valor: 70000,
        claveInterna: 'consultaControl',
        finalidad: '11',
        grupoServicio: '01',
        modalidad: '09'
    },

    // PROCEDIMIENTOS / SESIONES
    {
        codigo: '931000',
        nombre: 'FISIOTERAPIA INTEGRAL / SESIÓN INDIVIDUAL',
        tipoServicio: 'procedimiento',
        categoria: 'fisioterapia',
        valor: 45000,
        claveInterna: 'terapiaFisicaIndividual',
        finalidad: '44',
        grupoServicio: '04',
        modalidad: '01'
    },
    {
        codigo: '933900',
        nombre: 'ACTIVIDADES DE INTEGRACIÓN SENSORIAL / CLASES GRUPALES',
        tipoServicio: 'procedimiento',
        categoria: 'pediatria',
        valor: 35000,
        claveInterna: 'terapiaFisicaGrupal',
        finalidad: '44',
        grupoServicio: '04',
        modalidad: '02'
    },
    {
        codigo: '938610',
        nombre: 'ENTRENAMIENTO FUNCIONAL DE MÚSCULOS DE PISO PÉLVICO',
        tipoServicio: 'procedimiento',
        categoria: 'pisoPelvico',
        valor: 50000,
        claveInterna: 'reeducacionPisoPelvis',
        finalidad: '44',
        grupoServicio: '04',
        modalidad: '01'
    },
    {
        codigo: '890384',
        nombre: 'SESIÓN DE EDUCACIÓN PERINATAL (CONTROL)',
        tipoServicio: 'procedimiento',
        categoria: 'prenatal',
        valor: 50000,
        claveInterna: 'preparacionParto',
        finalidad: '05',
        grupoServicio: '04',
        modalidad: '01'
    }
];

async function seedCUPS() {
    try {
        console.log('🌱 Iniciando seed de códigos CUPS...');

        // Conectar si no está conectado (para script independiente)
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dmamitas');
        }

        for (const item of cupsData) {
            await CodigoCUPS.findOneAndUpdate(
                { claveInterna: item.claveInterna },
                item,
                { upsert: true, new: true }
            );
        }

        console.log('✅ Seed de CUPS completado exitosamente.');
    } catch (error) {
        console.error('❌ Error en seed de CUPS:', error);
    }
}

// Permitir ejecución directa
if (require.main === module) {
    seedCUPS().then(() => mongoose.disconnect());
}

module.exports = seedCUPS;
