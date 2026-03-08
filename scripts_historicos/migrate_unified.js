const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for migration');

    const db = mongoose.connection.db;
    const Paciente = db.collection('pacientes');
    const ValoracionUnificada = db.collection('valoracionfisioterapias');

    // 1. MIGRACIÓN DE PACIENTES ADULTOS
    console.log('--- Migrating Patients ---');
    const legacyPacientes = await db.collection('pacienteadultos').find().toArray();
    const patientIdMap = {}; // oldId -> newId

    for (const lp of legacyPacientes) {
        const docNum = lp.cedula || lp.numDocumentoIdentificacion;
        if (!docNum) continue;

        // Check if exists in new collection
        let existing = await Paciente.findOne({ numDocumentoIdentificacion: docNum });
        if (!existing) {
            const newDoc = {
                tipoDocumentoIdentificacion: lp.tipoDocumentoIdentificacion || 'CC',
                numDocumentoIdentificacion: docNum,
                nombres: lp.nombres || 'SIN NOMBRE',
                apellidos: lp.apellidos || '',
                fechaNacimiento: lp.fechaNacimiento || new Date(1990, 0, 1),
                codSexo: lp.genero === 'Masculino' ? 'M' : 'F',
                codPaisResidencia: "170",
                codZonaTerritorialResidencia: "01",
                tipoUsuario: "04",
                estadoCivil: lp.estadoCivil,
                ocupacion: lp.ocupacion,
                aseguradora: lp.aseguradora,
                fum: lp.fum,
                semanasGestacion: lp.semanasGestacion,
                fechaProbableParto: lp.fechaProbableParto,
                datosContacto: {
                    direccion: lp.direccion,
                    telefono: lp.telefono || lp.celular,
                    nombreAcompanante: lp.acompanante,
                    telefonoAcompanante: lp.telefonoAcompanante
                },
                createdAt: lp.createdAt || new Date(),
                updatedAt: lp.updatedAt || new Date()
            };
            const result = await Paciente.insertOne(newDoc);
            patientIdMap[lp._id.toString()] = result.insertedId;
        } else {
            patientIdMap[lp._id.toString()] = existing._id;
            // Optionally update existing with missing data
            await Paciente.updateOne({ _id: existing._id }, {
                $set: {
                    estadoCivil: existing.estadoCivil || lp.estadoCivil,
                    ocupacion: existing.ocupacion || lp.ocupacion,
                    fum: existing.fum || lp.fum,
                    semanasGestacion: existing.semanasGestacion || lp.semanasGestacion,
                    fechaProbableParto: existing.fechaProbableParto || lp.fechaProbableParto
                }
            });
        }
    }
    console.log(`Migrated/Mapped ${Object.keys(patientIdMap).length} adult patients.`);

    // 2. MIGRACIÓN DE VALORACIONES (GENERAL/LACTANCIA)
    console.log('--- Migrating Valuations (General/Lactancia) ---');
    const legacyValuations = await db.collection('valoracioningresos').find().toArray();
    for (const lv of legacyValuations) {
        const oldPid = lv.paciente?.toString();
        const newPid = patientIdMap[oldPid] || lv.paciente; // Simple fallback if already unified
        if (!newPid) continue;

        const isLactancia = lv.experienciaLactancia || lv.pechosNormales !== undefined;

        const newV = {
            paciente: newPid,
            fechaInicioAtencion: lv.fecha || lv.createdAt || new Date(),
            codConsulta: isLactancia ? '890201' : '890203',
            finalidadTecnologiaSalud: '44',
            causaMotivoAtencion: '21',
            codDiagnosticoPrincipal: lv.codDiagnosticoPrincipal || (isLactancia ? 'Z391' : 'Z000'),
            motivoConsulta: lv.motivoConsulta || 'Consulta general',
            enfermedadActual: lv.enfermedadActual,
            antecedentes: {
                patologicos: lv.patologicos,
                quirurgicos: lv.quirurgicos,
                farmacologicos: lv.farmacologicos,
                alergias: lv.toxicoAlergicos,
                traumaticos: lv.traumaticos,
                ginecoObstetricos: {
                    semanasGestacion: lv.semanasGestacion,
                    fum: lv.fum
                }
            },
            moduloLactancia: isLactancia ? {
                experienciaLactancia: lv.experienciaLactancia,
                comoFueExperiencia: lv.comoFueExperiencia,
                dificultadesLactancia: lv.dificultadesLactancia,
                deseaAmamantar: lv.deseaAmamantar,
                pechosNormales: lv.pechosNormales,
                pechosDolorosos: lv.pechosDolorosos,
                pechosSecrecion: lv.pechosSecrecion,
                formaPezon: lv.formaPezon
            } : undefined,
            diagnosticoFisioterapeutico: lv.afeccionesMedicas || lv.motivoConsulta || 'Evaluación',
            planTratamiento: lv.planIntervencion || 'Seguimiento',
            _datosLegacy: lv,
            bloqueada: lv.bloqueada || false,
            createdAt: lv.createdAt || new Date()
        };
        await ValoracionUnificada.insertOne(newV);
    }

    // 3. MIGRACIÓN DE VALORACIONES (PISO PÉLVICO)
    console.log('--- Migrating Valuations (Piso Pélvico) ---');
    const legacyPP = await db.collection('valoracionpisopelvicos').find().toArray();
    for (const lv of legacyPP) {
        const oldPid = lv.paciente?.toString();
        const newPid = patientIdMap[oldPid] || lv.paciente;
        if (!newPid) continue;

        const newV = {
            paciente: newPid,
            fechaInicioAtencion: lv.fecha || lv.createdAt || new Date(),
            codConsulta: '890202',
            finalidadTecnologiaSalud: '44',
            causaMotivoAtencion: '21',
            codDiagnosticoPrincipal: lv.codDiagnosticoPrincipal || 'N393',
            motivoConsulta: lv.motivoConsulta || 'Piso pélvico',
            signosVitales: {
                ta: lv.ta, fr: lv.fr, fc: lv.fc, temperatura: lv.temperatura,
                pesoActual: lv.pesoActual, talla: lv.talla, imc: lv.imc
            },
            moduloPisoPelvico: {
                icicq_frecuencia: lv.icicq_frecuencia,
                icicq_cantidad: lv.icicq_cantidad,
                icicq_impacto: lv.icicq_impacto,
                habitos: {
                    tipoDieta: lv.tipoDieta, ingestaLiquida: lv.ingestaLiquida, horarioSueno: lv.horarioSueno
                },
                evaluacionFisica: {
                    oxfordGlobal: lv.oxfordGlobal, perfectPower: lv.perfectPower
                }
            },
            diagnosticoFisioterapeutico: lv.diagnosticoFisio || 'Disfunción PP',
            planTratamiento: lv.planIntervencion || 'Rehabilitación',
            _datosLegacy: lv,
            createdAt: lv.createdAt || new Date()
        };
        await ValoracionUnificada.insertOne(newV);
    }

    // 4. ACTUALIZACIÓN DE REFERENCIAS EN OTRAS COLECCIONES
    console.log('--- Updating References ---');
    const collectionsToUpdate = ['clases', 'pagopaquetes', 'evolucionsesions', 'sesionmensuals'];
    for (const colName of collectionsToUpdate) {
        const col = db.collection(colName);
        const docs = await col.find().toArray();
        console.log(`Updating ${colName}...`);
        for (const doc of docs) {
            const pField = doc.paciente || doc.nino || doc.idPaciente;
            if (!pField) continue;
            const oldIdStr = pField.toString();
            if (patientIdMap[oldIdStr]) {
                const newId = patientIdMap[oldIdStr];
                const update = {};
                if (doc.paciente) update.paciente = newId;
                if (doc.nino) update.nino = newId;
                if (doc.idPaciente) update.idPaciente = newId;
                await col.updateOne({ _id: doc._id }, { $set: update });
            }
        }
    }

    console.log('Migration completed successfully.');
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
