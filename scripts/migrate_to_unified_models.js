/**
 * SCRIPT DE MIGRACIÓN DE DATOS - D'Mamitas & Babies
 * Refactorización a Estructura Normativa (RIPS JSON / Res. 2275 - HC Res. 3100)
 * 
 * Este script migra los datos de las colecciones legadas a los nuevos modelos unificados.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dmamitas';

// === IMPORTAR LOS NUEVOS MODELOS ===
const Paciente = require('../models/Paciente');
const ValoracionFisioterapia = require('../models/ValoracionFisioterapia');
const EvolucionSesion = require('../models/EvolucionSesion');
const Clase = require('../models/Clase');
const SesionMensual = require('../models/SesionMensual');
const PagoPaquete = require('../models/PagoPaquete');
const Log = require('../models/Log');

async function migrate() {
    try {
        console.log('🚀 Iniciando proceso de migración...');
        await mongoose.connect(mongoUri);
        console.log('✅ Conectado a la base de datos.');

        const db = mongoose.connection.db;
        const patientMapping = {}; // OldID -> NewID
        const assessmentMapping = {}; // OldID -> NewID

        // ==========================================
        // 1. MIGRAR PACIENTES (NIÑOS Y ADULTOS)
        // ==========================================
        console.log('\n--- 👥 Migrando Pacientes ---');

        // a) Pacientes Niños (Colección 'pacientes')
        const pediatricPatients = await db.collection('pacientes').find({}).toArray();
        console.log(`👶 Encontrados ${pediatricPatients.length} pacientes pediátricos.`);

        for (const p of pediatricPatients) {
            // Evitar duplicados si ya existe por número de documento
            const docNum = p.registroCivil || p.cedula || p._id.toString();

            let newP = await Paciente.findOne({ numDocumentoIdentificacion: docNum });
            if (!newP) {
                // Dividir nombres si es posible (heurística simple)
                const nameParts = p.nombres.trim().split(' ');
                const nombresArr = nameParts.slice(0, Math.ceil(nameParts.length / 2));
                const apellidosArr = nameParts.slice(Math.ceil(nameParts.length / 2));

                newP = new Paciente({
                    nombres: nombresArr.join(' '),
                    apellidos: apellidosArr.join(' ') || 'SIN APELLIDO',
                    tipoDocumentoIdentificacion: p.tipoDocumento || 'RC',
                    numDocumentoIdentificacion: docNum,
                    fechaNacimiento: p.fechaNacimiento ? new Date(p.fechaNacimiento) : new Date(2000, 0, 1),
                    codSexo: (p.genero && p.genero.toLowerCase().startsWith('f')) ? 'F' : 'M',
                    datosContacto: {
                        direccion: p.direccion || '',
                        telefono: p.telefono || p.celular || '',
                        nombreAcompanante: p.nombreMadre || p.nombrePadre || ''
                    },
                    aseguradora: p.aseguradora || 'PARTICULAR'
                });
                await newP.save();
            }
            patientMapping[p._id.toString()] = newP._id;
        }

        // b) Pacientes Adultos (Colección 'pacienteadultos')
        const adultPatients = await db.collection('pacienteadultos').find({}).toArray();
        console.log(`👩 Encontrados ${adultPatients.length} pacientes adultos.`);

        for (const p of adultPatients) {
            const docNum = p.cedula || p._id.toString();
            let newP = await Paciente.findOne({ numDocumentoIdentificacion: docNum });

            if (!newP) {
                const nameParts = p.nombres.trim().split(' ');
                const nombresArr = nameParts.slice(0, Math.ceil(nameParts.length / 2));
                const apellidosArr = nameParts.slice(Math.ceil(nameParts.length / 2));

                newP = new Paciente({
                    nombres: nombresArr.join(' '),
                    apellidos: apellidosArr.join(' ') || 'SIN APELLIDO',
                    tipoDocumentoIdentificacion: p.tipoDocumento || 'CC',
                    numDocumentoIdentificacion: docNum,
                    fechaNacimiento: p.fechaNacimiento ? new Date(p.fechaNacimiento) : new Date(1990, 0, 1),
                    codSexo: (p.genero && p.genero.toLowerCase().startsWith('m')) ? 'M' : 'F',
                    estadoCivil: p.estadoCivil,
                    ocupacion: p.ocupacion,
                    datosContacto: {
                        direccion: p.direccion || '',
                        telefono: p.telefono || p.celular || '',
                        nombreAcompanante: p.acompanante || '',
                        telefonoAcompanante: p.telefonoAcompanante || ''
                    },
                    aseguradora: p.aseguradora || 'PARTICULAR'
                });
                await newP.save();
            }
            patientMapping[p._id.toString()] = newP._id;
        }

        // ==========================================
        // 2. MIGRAR VALORACIONES (HISTORIA CLÍNICA)
        // ==========================================
        console.log('\n--- 📝 Migrando Valoraciones ---');

        // a) Valoraciones Pediátricas
        const valoracionesPed = await db.collection('valoracioningresos').find({}).toArray();
        console.log(`🧩 Migrando ${valoracionesPed.length} valoraciones pediátricas...`);
        for (const v of valoracionesPed) {
            const pId = patientMapping[v.paciente?.toString()];
            if (!pId) continue;

            const newV = new ValoracionFisioterapia({
                paciente: pId,
                fechaInicioAtencion: v.fecha ? new Date(v.fecha) : v.createdAt || new Date(),
                codConsulta: '890201', // Valoración inicial pediatría (CUPS común)
                finalidadTecnologiaSalud: '44', // Rehabilitación
                causaMotivoAtencion: '21',
                codDiagnosticoPrincipal: 'Z514', // Fisioterapia
                motivoConsulta: v.motivoConsulta || 'Consulta pediátrica',
                moduloPediatria: {
                    desarrolloMotor: {
                        sostieneCabeza: v.sostieneCabeza_si ? 'Si' : 'No',
                        gateo: v.gateo_si ? 'Si' : 'No',
                        marcha: v.marcha_si ? 'Si' : 'No'
                    },
                    conclusion: {
                        nivelDesarrolloAcorde: v.conclusionDesarrollo === 'Si',
                        areasRequierenAcompanamiento: v.observacionesConclusiones
                    }
                },
                planTratamiento: v.objetivoTratamiento || 'Plan de estimulación',
                diagnosticoFisioterapeutico: v.diagnostico || 'Evaluación inicial',
                bloqueada: v.bloqueada || false,
                selloIntegridad: v.selloIntegridad,
                auditTrail: v.auditTrail || {}
            });
            await newV.save();
            assessmentMapping[v._id.toString()] = newV._id;
        }

        // b) Valoraciones Piso Pelvico
        const valoracionesPP = await db.collection('valoracionpisopelvicos').find({}).toArray();
        console.log(`🧩 Migrando ${valoracionesPP.length} valoraciones de piso pélvico...`);
        for (const v of valoracionesPP) {
            const pId = patientMapping[v.paciente?.toString()];
            if (!pId) continue;

            const newV = new ValoracionFisioterapia({
                paciente: pId,
                fechaInicioAtencion: v.fecha ? new Date(v.fecha) : v.createdAt || new Date(),
                codConsulta: '890201',
                finalidadTecnologiaSalud: '44',
                causaMotivoAtencion: '21',
                codDiagnosticoPrincipal: 'N393', // Incontinencia por esfuerzo (común en PP)
                motivoConsulta: v.motivoConsulta || 'Piso pélvico',
                moduloPisoPelvico: {
                    icicq_frecuencia: v.icicq_frecuencia,
                    icicq_cantidad: v.icicq_cantidad,
                    icicq_impacto: v.icicq_impacto,
                    evaluacionFisica: {
                        oxfordGlobal: v.oxfordGlobal,
                        perfectPower: v.perfectPower
                    }
                },
                planTratamiento: v.planIntervencion || 'Rehabilitación perineal',
                diagnosticoFisioterapeutico: v.diagnosticoFisio || 'Disfunción de piso pélvico',
                bloqueada: v.bloqueada || false,
                selloIntegridad: v.selloIntegridad,
                auditTrail: v.auditTrail || {}
            });
            await newV.save();
            assessmentMapping[v._id.toString()] = newV._id;
        }

        // c) Valoraciones Lactancia / Adultos
        const valoracionesLac = await db.collection('valoracioningresoadultoslactancias').find({}).toArray();
        console.log(`🧩 Migrando ${valoracionesLac.length} valoraciones de lactancia/adultos...`);
        for (const v of valoracionesLac) {
            const pId = patientMapping[v.paciente?.toString()];
            // Lactancia a veces usa campos de paciente heredados si no tiene ref, pero asumimos que tiene ref
            if (!pId) continue;

            const newV = new ValoracionFisioterapia({
                paciente: pId,
                fechaInicioAtencion: v.fecha ? new Date(v.fecha) : v.createdAt || new Date(),
                codConsulta: '890201',
                finalidadTecnologiaSalud: '44',
                causaMotivoAtencion: '21',
                codDiagnosticoPrincipal: 'Z391', // Atención y examen de madre lactante
                motivoConsulta: v.motivoConsulta || 'Asesoría en lactancia',
                moduloLactancia: {
                    experienciaLactancia: v.experienciaLactancia,
                    formaPezon: v.formaPezon,
                    pechosDolorosos: v.pechosDolorosos
                },
                planTratamiento: v.planIntervencion || 'Plan de lactancia',
                diagnosticoFisioterapeutico: v.afeccionesMedicas || 'Evaluación de lactancia',
                bloqueada: v.bloqueada || false,
                selloIntegridad: v.selloIntegridad,
                auditTrail: v.auditTrail || {}
            });
            await newV.save();
            assessmentMapping[v._id.toString()] = newV._id;
        }

        // ==========================================
        // 3. MIGRAR SESIONES (EVOLUCIONES)
        // ==========================================
        console.log('\n--- 📋 Migrando Evoluciones ---');

        const sesionesPerinatal = await db.collection('sesionperinatalpacientes').find({}).toArray();
        console.log(`🔄 Migrando ${sesionesPerinatal.length} sesiones perinatales...`);
        for (const s of sesionesPerinatal) {
            const pId = patientMapping[s.paciente?.toString()];
            if (!pId) continue;

            // Buscar valoración asociada (podría no existir en el mapeo si era vieja)
            // En este caso, creamos una evolución huérfana o ligada a la última valoración del paciente
            let vId = null;
            // Intento encontrar una valoración para este paciente
            const valAsoc = await ValoracionFisioterapia.findOne({ paciente: pId }).sort({ createdAt: -1 });
            vId = valAsoc ? valAsoc._id : null;

            if (!vId) {
                console.warn(`⚠️ Sesión sin valoración para paciente ${s.paciente}. Saltando o creando valoración base.`);
                continue;
            }

            const newS = new EvolucionSesion({
                valoracionAsociada: vId,
                paciente: pId,
                fechaInicioAtencion: s.fecha ? new Date(s.fecha) : s.createdAt || new Date(),
                codProcedimiento: '931000', // Terapia física (CUPS común)
                finalidadTecnologiaSalud: '44',
                codDiagnosticoPrincipal: valAsoc.codDiagnosticoPrincipal,
                numeroSesion: 1, // Placeholder
                descripcionEvolucion: s.nombreSesion || 'Evolución de terapia',
                firmas: {
                    paciente: {
                        firmaUrl: s.firmaPaciente,
                        timestamp: s.createdAt
                    }
                },
                bloqueada: s.bloqueada || false,
                selloIntegridad: s.selloIntegridad,
                auditTrail: s.auditTrail || {}
            });
            await newS.save();
        }

        // ==========================================
        // 4. ACTUALIZAR REFERENCIAS EN OTROS MODELOS
        // ==========================================
        console.log('\n--- 🔁 Actualizando Referencias en otros modelos ---');

        // Clases
        const clases = await Clase.find({});
        for (const c of clases) {
            if (c.ninos && c.ninos.length > 0) {
                c.ninos.forEach(item => {
                    if (item.nino && patientMapping[item.nino.toString()]) {
                        item.paciente = patientMapping[item.nino.toString()];
                    }
                });
                await c.save();
            }
        }

        // Sesiones Mensuales
        const sm = await SesionMensual.find({});
        for (const s of sm) {
            if (s.asistentes && s.asistentes.length > 0) {
                s.asistentes.forEach(item => {
                    if (item.nino && patientMapping[item.nino.toString()]) {
                        item.paciente = patientMapping[item.nino.toString()];
                    }
                });
                await s.save();
            }
        }

        // Pagos
        await PagoPaquete.find({}).then(async docs => {
            for (const d of docs) {
                if (d.nino && patientMapping[d.nino.toString()]) {
                    d.paciente = patientMapping[d.nino.toString()];
                    await d.save();
                }
            }
        });

        // Logs
        const logs = await Log.find({});
        for (const l of logs) {
            if (l.paciente && patientMapping[l.paciente.toString()]) {
                l.paciente = patientMapping[l.paciente.toString()];
                await l.save();
            }
        }

        console.log('\n✅ MIGRACIÓN COMPLETADA CON ÉXITO.');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:', error);
        process.exit(1);
    }
}

migrate();
