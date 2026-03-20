const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ValoracionFisioterapiaSchema = new Schema({
    paciente: { type: Schema.Types.ObjectId, ref: 'Paciente', required: true },

    // Tipo de valoración: 'Pediatría' | 'Piso Pélvico' | 'Lactancia' | 'Perinatal' | 'General'
    tipoPrograma: { type: String, default: null },

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
        familiares: String,
        ginecoObstetricos: {
            embarazoAltoRiesgo: String,
            diabetesNoControlada: String,
            historiaAborto: String,
            semanasGestacion: String,
            fum: String,
            tipoParto: String
        }
    },

    // --- 4. MÓDULOS ESPECÍFICOS (Se llenan según la especialidad) ---

    moduloPediatria: {
        prenatales: {
            gestacionPlaneada: Boolean, gestacionControlada: Boolean, metodosAnticonceptivos: Boolean,
            intentoAborto: Boolean, vomito1erTrim: Boolean, sustancias: Boolean, rayosX: Boolean,
            convulsiones: Boolean, desnutricion: Boolean, anemia: Boolean, maltrato: Boolean,
            hipertension: Boolean, diabetes: Boolean
        },
        perinatales: {
            tipoParto: String, formaParto: String, tiempoGestacion: String, lugarParto: String,
            atendidaOportunamente: String, medicoTratante: String, pesoAlNacer: String,
            tallaAlNacer: String, recibioCurso: String
        },
        recienNacido: {
            llantoAlNacer: Boolean, problemasRespiratorios: Boolean, incubadora: Boolean,
            lactanciaMaterna: String, tiempoLactancia: String, hospitalarios: String,
            patologicos: String, familiares: String, traumaticos: String, farmacologicos: String,
            quirurgicos: String, toxicosAlergicos: String
        },
        habitos: {
            recomendacionesMedicas: String, problemasSueno: String, duermeCon: String,
            patronSueno: String, pesadillas: String, siesta: String, miedos: String,
            cambioAlimentacion: String, problemasSuccion: Boolean, problemasMasticacion: Boolean,
            problemasDeglucion: Boolean, problemasComer: String, alimentosPreferidos: String,
            alimentosNoGustan: String
        },
        desarrolloSocial: {
            viveConPadres: String, permaneceCon: String, prefiereA: String,
            relacionHermanos: String, emociones: String, juegaCon: String,
            juegosPrefiere: String, relacionDesconocidos: String
        },
        rutinaDiaria: String,
        hitos: {
            controlCefalico: { si: String, tiempo: String, obs: String },
            rolados: { si: String, tiempo: String, obs: String },
            sedente: { si: String, tiempo: String, obs: String },
            gateo: { si: String, tiempo: String, obs: String },
            bipedo: { si: String, tiempo: String, obs: String },
            marcha: { si: String, tiempo: String, obs: String }
        },
        examen: {
            fc: String, fr: String, temperatura: String, tejidoTegumentario: String,
            reflejos: String, anormales: String, patologicos: String, tonoMuscular: String,
            controlMotor: String, desplazamientos: String, sensibilidad: String,
            perfilSensorial: String, deformidades: String, aparatosOrtopedicos: String,
            sistemaPulmonar: String, problemasAsociados: String
        },
        autorizacionImagen: { type: Boolean, default: false },

        // Mantener campos antiguos por compatibilidad si existen datos
        desarrolloMotor: {
            sostieneCabeza: String, seVoltea: String, seSientaSinApoyo: String,
            gateo: String, sePoneDePie: String, marcha: String, correSalta: String
        },
        motricidadFina: {
            sigueObjetos: String, llevaObjetosBoca: String, pasaObjetosEntreManos: String,
            pinzaSuperior: String, encajaPiezas: String, garabatea: String
        },
        lenguaje: {
            balbucea: String, diceMamaPapa: String, senalaQueQuiere: String,
            entiendeOrdenes: String, usaFrases: String
        },
        socioemocional: {
            sonrieSocialmente: String, respondeNombre: String, interesaOtrosNinos: String,
            juegoSimbolico: String, seDespide: String
        },
        emocionesExpresadas: [String],
        relacionEntorno: String
    },

    moduloPisoPelvico: {
        // 1. Antecedentes y Estilo de Vida
        deporteActualidad: String, // Tipo, intensidad, frecuencia
        avdTrabajo: [String], // Checkboxes: Bipedestación, Sedestación, Cargas, etc.
        avdObservaciones: String,
        farmacologicos: {
            seleccion: [String], // Antihipertensivo, Antidepresivo, etc.
            otros: String,
            infoMedicacion: String
        },
        alergias: String,
        analiticaReciente: String, // Sangre, orina, citología
        patologiaCardiorrespiratoria: String,
        patologiaNeurologica: String,
        traumaticos: [String], // Accidente tráfico, Caída coxis, etc.
        enfCronica: {
            seleccion: [String], // Diabetes, Hipotiroidismo, etc.
            observaciones: String
        },
        ets: { presente: String, observaciones: String },
        psicologicos: { seleccion: [String], observaciones: String }, // Duelos, Ruptura
        quirurgicos: { seleccion: [String], observaciones: String },
        familiares: String,
        toxicos: String,

        // 2. Dinámica Obstétrica / Ginecológica
        obstetrica: {
            numEmbarazos: Number, numAbortos: Number, numPartosVaginales: Number, numCesareas: Number,
            hijos: [{
                nombre: String, fechaNac: Date, peso: String, talla: String, tipoParto: String, semanaGestacion: String
            }]
        },
        actividadFisicaGestacion: String,
        medicacionGestacion: String,
        trabajoParto: {
            dilatacion: { tipo: String, posicion: String, duracion: String },
            expulsivo: { tipo: String, posicion: String, duracion: String },
            tecnicaExpulsivo: [String], // Kristeller, Episiotomia, etc.
            observaciones: String
        },
        actividadFisicaPostparto: String,

        // 3. Síntomas Actuales
        episodiosIncontinencia: {
            urinariaTrasParto: String, fecalTrasParto: String, gasesVaginales: String, bultoVaginal: String
        },
        dinamicaMenstrual: {
            menarquia: String, menopausia: String, diasMenstruacion: String, intervaloPeriodo: String,
            caracteristicasSangrado: [String], // Fluido, Espeso, Coágulos, etc.
            algias: [String], // Ovulatorio, Premenstrual
            usoDuranteSangrado: [String], // Copa, Tampones, etc.
            observaciones: String
        },
        dolor: { siente: String, ubicacion: String, perpetuadores: String, calmantes: String },
        anticonceptivo: { tipo: [String], intentosEmbarazo: String, dificultadesFecundacion: String },

        // 4. Dinámica Miccional (ICIQ-SF y funcional)
        dinamicaMiccional: {
            usaProtector: String, ropaInterior: String,
            numMiccionesDia: String, numMiccionesNoche: String, cadaCuantasHoras: String,
            deseoMiccional: String, sensacionVaciado: String, posturaMiccional: String,
            formaMiccion: [String], empuje: { comenzar: Boolean, terminar: Boolean },
            tipoIncontinencia: { esfuerzo: [String], urgencia: Boolean, mixta: Boolean },
            dolorAlOrinar: String
        },
        icicq_frecuencia: String,
        icicq_cantidad: String,
        icicq_impacto: String,
        icicq_cuandoPierde: [String],

        // 5. Dinámica Defecatoria y Sexual
        dinamicaDefecatoria: {
            frecuencia: { dia: String, noche: String, semana: String },
            postura: String, forma: [String], cierrePrecoz: String,
            dolor: String, bristol: String, gases: String
        },
        dinamicaSexual: {
            lubricacion: String, orgasmos: String, disfuncion: String,
            iuPenetracion: Boolean, resolucionOrgasmo: String,
            tipoRelacion: String, masturbacion: String, historiaSexual: String,
            conflictos: [String], relacionesDolor: [String], // Dispareunia, etc.
            dolorLocalizacion: { introito: String, fondo: String, irradiado: String, perineal: String }
        },

        // 6. Evaluación Física
        habitos: { tipoDieta: String, ingestaLiquida: String, horarioSueno: String },
        evaluacionFisica: {
            marcha: String, postura: String, diafragmaOrofaringeo: String, diafragmaToracico: String,
            testingCentroFrenico: String, diafragmaPelvico: String, abdomenTos: String,
            diastasis: { supra: String, umbi: String, infra: String },
            movilidad: String, psoasAductorPiramidal: String, testDinamicos: String,
            palpacion: String, pielCicatriz: String
        },
        evaluacionPerinealExterna: {
            vulva: String, mucosa: String, labios: String, lubricacion: String, flujo: String, ph: String,
            vagina: String, diametroApertura: String, clitoris: String, capuchon: String, muevoVulva: String,
            sensibilidad: String, hemorroidesVarices: String, cicatrices: String, cirugiasEsteticas: String,
            glandulas: String, elasticidad: String, distancias: String, nucleoCentral: String,
            contraccion: String, reflejoTos: String, pruritoEscozor: String, neurologica: String,
            reflejos: [String] // Clitorideo, Anal, etc.
        },
        evaluacionInterna: {
            cupulas: String, tonoGeneral: String, fuerzaOxford: { global: String, derecha: String, izquierda: String },
            perfect: { power: String, endurance: String, repetitions: String, fast: String, ect: String }
        },
        trpExopelvicos: mongoose.Schema.Types.Mixed, // Mapeo de ligamentos
        prolapso: { vesicocele: String, uretrocele: String, uterocele: String, rectocele: String, proctocele: String, elitrocele: String, sindromeDescendente: String },
        trpEndopelvicos: mongoose.Schema.Types.Mixed
    },

    moduloLactancia: {
        tipoLactancia: String, // 'prenatal' | 'postparto'

        // 1. Datos Personales / Antecedentes (Prenatal)
        ocupacion: String,
        nivelEducativo: String,
        medicoTratante: String,
        acompanante: { nombre: String, telefono: String },
        antecedentes: {
            hospitalarios: String,
            patologicos: String,
            familiares: String,
            traumaticos: String,
            farmacologicos: String,
            quirurgicos: String,
            toxicosAlergicos: String
        },
        obstetricos: {
            numEmbarazos: Number, numAbortos: Number, numPartosVaginales: Number, numCesareas: Number, instrumentado: String,
            ultimoParto: { fecha: Date, peso: String, talla: String, episiotomia: String, desgarro: String },
            espacioIntergenesico: String,
            actividadFisicaGesta: String,
            complicaciones: String
        },
        ginecologicos: { cirugiasPrevias: String, prolapsos: String, hormonales: String, anticonceptivos: String },

        // 2. Datos del Bebé (Postparto)
        bebe: {
            nombre: String, fechaNac: Date, edadActual: String, tipoParto: String,
            pesoNacer: String, pesoActual: String, controladoPediatria: String,
            condicionesMedicas: String, requiereFormula: String, tipoAlimentacion: String, // Exclusiva, Mixta, Formula
            institucionNacimiento: String, medicoBebre: String
        },
        infoEmbarazo: String,
        infoParto: String,

        // 3. Historia de Lactancia
        experienciaPrevia: String,
        comoFueExperiencia: String,
        dificultadesPresentadas: String,
        conocimientoExpectativa: { deseaAmamantar: String, queEsperasAsesoria: String, queSabesLactancia: String },
        aspectosFisicos: {
            pechos: [String], // Normales, Dolorosos, Secrecion, Cirugias
            formaPezon: String, // Normal, Plano, Invertido, Otro
            observacionesFisicas: String
        },
        apoyoFamiliarLactancia: String, // Si, No, Parcial

        // Historia Lactancia Actual (Postparto)
        lactanciaActual: {
            inicioPrimeraHora: String, pielAPiel: String, dolorosa: String, localizacionDolor: String,
            grietasHeridas: String, sienteAgarreCorrecto: String, frecuenciaAlimentacion: String,
            duracionToma: String, usoBiberonesChupos: String, orientacionPrevia: String
        },

        // 4. Observación de la Toma (Postparto)
        observacionToma: {
            seleccion: [String], // Buen agarre, Posición adecuada, Dificultad succion, etc.
            comentarios: String
        },

        // 5. Evaluación Emocional (Postparto)
        evaluacionEmocional: {
            comoSeSiente: String,
            estadoAnimo: [String], // Tranquila, Frustrada, Ansiosa, Segura
            apoyoEnCasa: { tiene: String, quien: String },
            necesitaApoyoAdicional: String
        },

        planIntervencion: String,
        visitaCierre: String
    },

    moduloPerinatal: {
        // 1. Antecedentes
        hospitalarios: String,
        traumaticos: String,
        toxicoAlergicos: String,
        haTenidoEmbarazos: String,
        numEmbarazos: Number,
        numAbortos: Number,
        numPartosVaginales: Number,
        instrumentado: String,
        numCesareas: Number,
        fechaObstetrico: Date,
        pesoObstetrico: String,
        tallaObstetrico: String,
        episiotomia: String,
        desgarro: String,
        espacioEntreEmbarazos: String,
        actividadFisicaPrevia: String,
        complicacionesPrevias: String,
        cirugiasPreviasGine: String,
        prolapsos: String,
        hormonales: String,
        anticonceptivos: String,

        // 2. Estado de Salud (PARMED-X)
        abortosAnteriores: String,
        otrasComplicacionesGesta: String,
        explicacionComplicaciones: String,
        numGestacionesPrevias: Number,
        condicionActual: {
            fatigaMarcada: String,
            sangradoVaginal: String,
            debilidadMareo: String,
            dolorAbdominal: String,
            sudoracionEspontanea: String,
            doloresCabeza: String,
            sudoracionPantorrilla: String,
            ausenciaMovFetales: String,
            dejarGanarPeso: String,
            explicacion: String
        },
        actividadUltimoMes: {
            actividades: String,
            intensidad: String,
            frecuencia: String,
            tiempo: String,
            levantarPesos: String,
            subirEscaleras: String,
            caminarOcasionalmente: String,
            bipedestacion: String,
            mantenerSentada: String,
            actividadNormal: String
        },
        actividadFisicaDeseada: String,
        contraindicacionesRelativas: {
            rupturaMembranas: String,
            hemorragiaPersistente: String,
            hipertensionEmbarazo: String,
            cervixIncompetente: String,
            restriccionCrecimiento: String,
            embarazoAltoRiesgo: String,
            diabetesNoControlada: String,
            cambioActividad: String
        },
        contraindicacionesAbsolutas: {
            historiaAborto: String,
            enfermedadCardioRespiratoria: String,
            anemia: String,
            malnutricion: String,
            embarazoGemelar: String,
            diabetesNoControladaAbsoluta: String
        },
        actividadFisicaAprobada: String, // 'aprobada' | 'contraindicada'
        observacionesSalud: String,

        // 3. Evaluación Fisioterapéutica
        abdomen: String,
        patronRespiratorio: String,
        diafragma: String,
        piel: String,
        movilidad: String,
        psoasSecuencia: String,
        dolor: String,
        palpacionAbdomenBajo: String,
        observacionPisoPelvico: String,
        sensibilidadPisoPelvico: String,
        reflejosPisoPelvico: String,
        compartimentoAnterior: String,
        compartimentoMedio: String,
        compartimentoPosterior: String,
        dinamicasPisoPelvico: String,
        fuerzaPisoPelvico: String,

        // 4. Diagnóstico y Plan
        visitaCierre: String,
        planElegido: String // 'educacion' | 'fisico' | 'ambos' | 'intensivo'
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
    _datosLegacy: { type: mongoose.Schema.Types.Mixed, select: false }
}, { timestamps: true, strict: false });

module.exports = mongoose.models.ValoracionFisioterapia || mongoose.model('ValoracionFisioterapia', ValoracionFisioterapiaSchema);
