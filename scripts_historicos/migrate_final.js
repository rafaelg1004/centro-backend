const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to DB for DEEP migration');

    const db = mongoose.connection.db;
    const Paciente = db.collection('pacientes');
    const ValoracionUnificada = db.collection('valoracionfisioterapias');

    // --- 1. STANDARDIZE CURRENT UNIFIED PATIENTS ---
    console.log('--- 1. Standardizing current unified patients ---');
    const allUnifiedPatients = await Paciente.find().toArray();
    for (const p of allUnifiedPatients) {
        const docNum = p.numDocumentoIdentificacion || p.registroCivil || p.cedula;
        const tipoDoc = p.tipoDocumentoIdentificacion || p.tipoDocumento || (p.cedula ? 'CC' : 'RC');
        const esAdulto = ['CC', 'CE', 'PA', 'PE'].includes(tipoDoc) || p.esAdulto === true;

        await Paciente.updateOne(
            { _id: p._id },
            {
                $set: {
                    numDocumentoIdentificacion: docNum,
                    tipoDocumentoIdentificacion: tipoDoc,
                    esAdulto: esAdulto,
                    nombres: p.nombres || 'SIN NOMBRE',
                    apellidos: p.apellidos || ''
                }
            }
        );
    }
    console.log('Standardized existing pazienti.');

    // --- 2. MIGRATING LEGACY ADULT PATIENTS ---
    console.log('--- 2. Migrating legacy adult patients ---');
    const legacyPacientes = await db.collection('pacienteadultos').find().toArray();
    const patientIdMap = {}; // oldId -> newId

    for (const lp of legacyPacientes) {
        const docNum = lp.cedula || lp.numDocumentoIdentificacion;
        if (!docNum) continue;

        let existing = await Paciente.findOne({ numDocumentoIdentificacion: docNum });
        if (!existing) {
            const newDoc = {
                tipoDocumentoIdentificacion: lp.tipoDocumentoIdentificacion || 'CC',
                numDocumentoIdentificacion: docNum,
                nombres: lp.nombres || 'SIN NOMBRE',
                apellidos: lp.apellidos || '',
                fechaNacimiento: lp.fechaNacimiento || new Date(1990, 0, 1),
                codSexo: (lp.genero === 'Masculino' || lp.codSexo === 'M') ? 'M' : 'F',
                codPaisResidencia: "170",
                codZonaTerritorialResidencia: "01",
                tipoUsuario: "04",
                esAdulto: true,
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
            await Paciente.updateOne({ _id: existing._id }, { $set: { esAdulto: true } });
        }
    }

    // Map remaining unified patients (children) to themselves in the map to simplify valuation migration
    const allPacientes = await Paciente.find().toArray();
    for (const p of allPacientes) {
        patientIdMap[p._id.toString()] = p._id;
    }

    // --- 3. MIGRATING ALL VALUATIONS ---
    const valuationSources = [
        { col: 'valoracioningresos', cups: '890203', label: 'General/Lactancia' },
        { col: 'valoracionpisopelvicos', cups: '890202', label: 'Piso Pélvico' },
        { col: 'valoracioningresoadultoslactancias', cups: '890201', label: 'Lactancia Legacy' },
        { col: 'consentimientoperinatals', cups: '890204', label: 'Perinatal' }
    ];

    for (const source of valuationSources) {
        console.log(`--- Migrating ${source.label} ---`);
        const legacyValuations = await db.collection(source.col).find().toArray();
        for (const lv of legacyValuations) {
            const oldPid = lv.paciente?.toString() || lv.idPaciente?.toString() || lv.nino?.toString();
            const newPid = patientIdMap[oldPid];
            if (!newPid) {
                // If patient not found, maybe search by document in legacy session if available?
                // For now, skip if no patient reference
                continue;
            }

            // check if already exists in unified
            const exists = await ValoracionUnificada.findOne({ _datosLegacyId: lv._id.toString() });
            if (exists) continue;

            const isLactancia = source.cups === '890201' || lv.experienciaLactancia;
            const isPerinatal = source.cups === '890204';
            const isPisoPelvico = source.cups === '890202';

            const newV = {
                paciente: newPid,
                fechaInicioAtencion: lv.fecha || lv.fechaApertura || lv.createdAt || new Date(),
                codConsulta: source.cups,
                finalidadTecnologiaSalud: '44',
                causaMotivoAtencion: '21',
                codDiagnosticoPrincipal: lv.codDiagnosticoPrincipal || (isPerinatal ? 'Z348' : isPisoPelvico ? 'N393' : isLactancia ? 'Z391' : 'Z000'),
                motivoConsulta: lv.motivoConsulta || lv.motivo || (isPerinatal ? 'Evaluación perinatal' : 'Consulta'),
                enfermedadActual: lv.enfermedadActual,
                antecedentes: {
                    patologicos: lv.patologicos,
                    quirurgicos: lv.quirurgicos,
                    farmacologicos: lv.farmacologicos,
                    alergias: lv.toxicoAlergicos || lv.alergias,
                    traumaticos: lv.traumaticos,
                    ginecoObstetricos: {
                        semanasGestacion: lv.semanasGestacion,
                        fum: lv.fum,
                        numPartos: lv.partos,
                        numCesareas: lv.cesareas
                    }
                },
                diagnosticoFisioterapeutico: lv.afeccionesMedicas || lv.diagnosticoFisio || lv.motivoConsulta || 'Evaluación',
                planTratamiento: lv.planIntervencion || lv.planTratamiento || 'Seguimiento',
                bloqueada: lv.bloqueada || false,
                _datosLegacy: lv,
                _datosLegacyId: lv._id.toString(),
                createdAt: lv.createdAt || new Date()
            };

            // Specialized modules
            if (isPisoPelvico) {
                newV.moduloPisoPelvico = {
                    habitos: { ingestaLiquida: lv.ingestaLiquida },
                    evaluacionFisica: { oxfordGlobal: lv.oxfordGlobal }
                };
            }
            if (isLactancia) {
                newV.moduloLactancia = { experienciaLactancia: lv.experienciaLactancia };
            }

            await ValoracionUnificada.insertOne(newV);
        }
    }

    // --- 4. UPDATING OTHER COLLECTIONS ---
    console.log('--- 4. Updating cross-references ---');
    const collectionsToUpdate = ['clases', 'pagopaquetes', 'evolucionsesions', 'sesionmensuals', 'sesionperinatalpacientes'];
    for (const colName of collectionsToUpdate) {
        const col = db.collection(colName);
        const docs = await col.find().toArray();
        for (const doc of docs) {
            const pField = doc.paciente || doc.nino || doc.idPaciente || doc.pacienteId;
            if (!pField) continue;
            const oldIdStr = pField.toString();
            if (patientIdMap[oldIdStr]) {
                const newId = patientIdMap[oldIdStr];
                const update = {};
                if (doc.paciente) update.paciente = newId;
                if (doc.nino) update.nino = newId;
                if (doc.idPaciente) update.idPaciente = newId;
                if (doc.pacienteId) update.pacienteId = newId;
                await col.updateOne({ _id: doc._id }, { $set: update });
            }
        }
    }

    console.log('✅✅✅ Deep Migration Completed Successfully.');
    await mongoose.disconnect();
}

migrate().catch(e => {
    console.error('❌ Migration Critical Failure:', e);
    process.exit(1);
});
