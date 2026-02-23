const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ValoracionFisioterapiaSchema = new Schema({
    paciente: { type: Schema.Types.ObjectId, ref: 'Paciente', required: true },

    // --- 1. DATOS RIPS Y FHIR OBLIGATORIOS (Res. 2275/2023 y Res. 1888/2025) ---
    fechaInicioAtencion: { type: Date, required: true, default: Date.now },
    numAutorizacion: { type: String, default: null }, // Null si es particular
    codConsulta: { type: String, required: true }, // CUPS (Ej. 890201)
    modalidadGrupoServicioTecSal: { type: String, default: "09" }, // '09' Consulta Externa
    grupoServicios: { type: String, default: "01" },
    finalidadTecnologiaSalud: { type: String, required: true }, // Ej. '44' Rehabilitación
    causaMotivoAtencion: { type: String, required: true }, // Ej. '21' Enfermedad general
    codDiagnosticoPrincipal: { type: String, required: true }, // CIE-10 / CIE-11 (Ej. M545)
    tipoDiagnosticoPrincipal: { type: String, default: "01" }, // Impresión diagnóstica
    vrServicio: { type: Number, default: 0 },
    conceptoRecaudo: { type: String, default: "05" }, // '05' No aplica copago si es particular

    // --- 2. DATOS CLÍNICOS GENERALES ---
    motivoConsulta: { type: String, required: true },
    enfermedadActual: { type: String },
    signosVitales: {
        ta: String, fr: String, fc: String, temperatura: String,
        pesoPrevio: String, pesoActual: String, talla: String, imc: String
    },

    // --- 3. ANTECEDENTES AGRUPADOS ---
    antecedentes: {
        prenatales: [String],
        tipoParto: String,
        tiempoGestacion: String,
        lactancia: String,
        patologicos: String,
        quirurgicos: String,
        farmacologicos: String,
        alergias: String,
        traumaticos: String,
        ginecoObstetricos: {
            embarazoAltoRiesgo: String,
            diabetesNoControlada: String,
            historiaAborto: String,
            semanasGestacion: String,
            fum: String
        }
    },

    // --- 4. MÓDULOS ESPECÍFICOS (Se llenan según la especialidad) ---

    moduloPediatria: {
        desarrolloMotor: {
            sostieneCabeza: String,
            seVoltea: String,
            seSientaSinApoyo: String,
            gateo: String,
            sePoneDePie: String,
            marcha: String,
            correSalta: String
        },
        motricidadFina: {
            sigueObjetos: String,
            llevaObjetosBoca: String,
            pasaObjetosEntreManos: String,
            pinzaSuperior: String,
            encajaPiezas: String,
            garabatea: String
        },
        lenguaje: {
            balbucea: String,
            diceMamaPapa: String,
            senalaQueQuiere: String,
            entiendeOrdenes: String,
            usaFrases: String
        },
        socioemocional: {
            sonrieSocialmente: String,
            respondeNombre: String,
            interesaOtrosNinos: String,
            juegoSimbolico: String,
            seDespide: String
        },
        conclusion: {
            nivelDesarrolloAcorde: Boolean,
            areasRequierenAcompanamiento: String,
            estimulacionEntornoDiario: String,
            actividadesSugeridasCasa: String
        }
    },

    moduloPisoPelvico: {
        icicq_frecuencia: String,
        icicq_cantidad: String,
        icicq_impacto: String,
        habitos: {
            tipoDieta: String, ingestaLiquida: String, horarioSueno: String
        },
        evaluacionFisica: {
            dolorPerineal: String, diafragmaToracico: String, cupulaDerecha: Boolean,
            cupulaIzquierda: Boolean, oxfordGlobal: String, perfectPower: String
        },
        evaluacionMuscular: {
            prolapso_grado: String,
            endo_presente: Boolean
        }
    },

    moduloLactancia: {
        experienciaLactancia: String,
        dificultadesLactancia: String,
        deseaAmamantar: String,
        pechosNormales: Boolean,
        pechosDolorosos: Boolean,
        pechosSecrecion: Boolean,
        formaPezon: String
    },

    // --- 5. EXAMEN FÍSICO GENERAL Y PLAN ---
    examenFisico: {
        postura: String,
        marcha: String,
        tonoMuscular: String,
        controlMotor: String,
        perfilSensorial: String,
        tejidoTegumentario: String,
        reflejos: String
    },
    diagnosticoFisioterapeutico: { type: String, required: true },
    planTratamiento: { type: String, required: true },

    // --- 6. CUMPLIMIENTO LEGAL Y FIRMAS ELECTRÓNICAS (Ley 527 de 1999) ---
    firmas: {
        pacienteOAcudiente: {
            nombre: String, cedula: String, firmaUrl: String,
            timestamp: Date, ip: String
        },
        profesional: {
            nombre: String, registroMedico: String, firmaUrl: String,
            timestamp: Date
        }
    },
    // Seguridad, Inmutabilidad y Auditoría
    bloqueada: { type: Boolean, default: false },
    fechaBloqueo: Date,
    selloIntegridad: String, // Hash criptográfico (SHA-256)
    auditTrail: { type: Object, default: {} },
    // Campo para compatibilidad: almacena el formulario completo original
    // Útil en formularios con cientos de campos (piso pélvico, perinatal).
    // NOTA: No se expone en el listado general para no sobrecargar las consultas.
    _datosLegacy: { type: mongoose.Schema.Types.Mixed, select: false }
}, { timestamps: true });

module.exports = mongoose.models.ValoracionFisioterapia || mongoose.model('ValoracionFisioterapia', ValoracionFisioterapiaSchema);
