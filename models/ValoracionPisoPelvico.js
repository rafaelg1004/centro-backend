const mongoose = require('mongoose');

const ligamentosMusculosExo = [
  "LIGAMENTO ILIO LUMBAR LIL",
  "LIGAMENTO SACRO ILIACO LSI",
  "LIGAMENTO SACROCIATICO LSC",
  "LIGAMENTO SACROTUBEROSO LST",
  "LIGAMENTO SACROCOCCIGEO LSC",
  "DXTORACICO DXOG",
  "RECTO ABDOMINAL",
  "OBLICUO EXTERNO",
  "OBLICUO INTERNO",
  "PSOAS ILIACO",
  "ERECTORES",
  "CUADRADO LUMBAR",
  "GLUTEO MAYOR",
  "GLUTEO MENOR",
  "ISQUIOTIBIALES",
  "PIRAMIDAL",
  "GLUTEO MEDIO",
  "SARTORIO",
  "PELVITROCANTEREOS",
  "CUADRADO CRURAL",
  "ADUCTORES",
  "CINTURA ESCAPULAR",
  "CUELLO/HOMBRO",
  "INTERESCAPULARES",
  "OTRO MUSCULO"
];

const prolapsos = [
  "VESICOCELE",
  "URETROCELE",
  "UTEROCELE",
  "RECTOCELE",
  "PROCTOCELE",
  "ELITROCELE___ENTEROCELE",
  "SINDROME_PERINEO_DESCENDENTE"
];

const ligEndopelvicos = [
  "LIG URACO 12",
  "LIG REDONDO",
  "LIG ANCHO 3-9",
  "LIG CARDINAL 4-8",
  "LIG UTEROSACRO 5-7 RODEA AMPOLLA RECTAL",
  "LIG ANOCOCCIGEO /SACROCOGCIGEO",
  "NUCLEO FIBROSO CENTRAL PERINEAL",
  "TRANSVERSO SUPERFICIAL/ PROF",
  "BULBO CAVERNOSO",
  "ISQUICAVERNOSO",
  "DUG ESFINTER URETRALEXTERNO/COMPRESOR URETRAL /URETROVAGINAL",
  "PUBOURETRAL PU",
  "PUBOVAGINAL PV",
  "ESFINTER ANAL /PUBORECTAL EAE",
  "PUBOCOCCIGEO PC",
  "OBTURATOR INTERNO/ PIRAMIDAL OI",
  "ILIOCOCCIGEO IL",
  "COCCIGEO"
];

const ValoracionPisoPelvicoSchema = new mongoose.Schema({
  paciente: { type: mongoose.Schema.Types.ObjectId, ref: "PacienteAdulto", required: true },
  
  // Datos específicos de esta valoración (NO del paciente)
  // Los siguientes campos YA están en PacienteAdulto: acompanante, telefonoAcompanante, nombreBebe, semanasGestacion, fum, fechaProbableParto
  fecha: String,
  hora: String,
  motivoConsulta: String,
  // Paso 2: Estado de Salud
  temperatura: String,
  ta: String,
  fr: String,
  fc: String,
  pesoPrevio: String,
  pesoActual: String,
  talla: String,
  imc: String,
  deporteActual: String,
  observacionesActividad: String,
  observacionesAvd: String,
  infoMedicacion: String,
  farmacoOtros: String,
  alergias: String,
  ultimaAnalitica: String,
  patologiaCardio: String,
  patologiaNeuro: String,
  observacionesTrauma: String,
  avd_bipedestación: Boolean,
  avd_sedestación: Boolean,
  avd_cargas: Boolean,
  avd_conducción: Boolean,
  avd_marcha: Boolean,
  avd_oficina: Boolean,
  avd_homeworking: Boolean,
  farmaco_antihipertensivo: Boolean,
  farmaco_antidepresivo: Boolean,
  farmaco_ansiolítico: Boolean,
  farmaco_antibiótico: Boolean,
  farmaco_vitaminas: Boolean,
  farmaco_antioxidantes: Boolean,
  farmaco_complementación_natural: Boolean,
  trauma_accidente_de_tráfico: Boolean,
  trauma_caída_sobre_coxis: Boolean,
  trauma_caída_sobre_espalda: Boolean,
  trauma_golpe_abdominal: Boolean,
  trauma_golpe_en_la_cabeza: Boolean,

  // Paso 3: Enfermedad Crónica
  cronica_diabetes: Boolean,
  cronica_hipotiroidismo: Boolean,
  cronica_hipertiroidismo: Boolean,
  cronica_hipertenso: Boolean,
  cronica_hipercolesterolemia: Boolean,
  cronica_asma: Boolean,
  cronica_artrosis: Boolean,
  cronica_osteoporosis: Boolean,
  cronica_hernia_cervical: Boolean,
  cronica_hernia_dorsal: Boolean,
  cronica_hernia_lumbar: Boolean,
  cronica_hernia_abdominal: Boolean,
  cronica_hernia_inguinal: Boolean,
  observacionesCronica: String,
  observacionesETS: String,
  psico_duelos: Boolean,
  psico_ruptura_relación: Boolean,
  observacionesPsico: String,
  qx_cirugía_torácica: Boolean,
  qx_cirugía_abdominal: Boolean,
  qx_cirugía_pélvica: Boolean,
  qx_cirugía_hernia: Boolean,
  qx_proceso_oncológico: Boolean,
  observacionesQx: String,
  familiares: String,
  toxicos: String,

  // Paso 4: Dinámica Obstétrica/Ginecológica
  numEmbarazos: String,
  numAbortos: String,
  numPartosVaginales: String,
  numCesareas: String,
  hijos: [
    {
      nombre: String,
      fechaNacimiento: String,
      peso: String,
      talla: String,
      tipoParto: String,
      semana: String
    }
  ],
  actividadFisicaGestacion: String,
  medicacionGestacion: String,
  trabajoPartoDilatacion: String,
  trabajoPartoExpulsivo: String,
  tecnicaExpulsivo_kristeller: Boolean,
  tecnicaExpulsivo_episiotomía_sin_desgarro: Boolean,
  tecnicaExpulsivo_episiotomía_con_desgarro: Boolean,
  tecnicaExpulsivo_vacuum: Boolean,
  tecnicaExpulsivo_fórceps: Boolean,
  tecnicaExpulsivo_espátulas: Boolean,
  tecnicaExpulsivo_respetado: Boolean,
  tecnicaExpulsivo_eutócico: Boolean,
  tecnicaExpulsivo_natural: Boolean,
  tecnicaExpulsivo_hipopresivo_con_grupo_sinergistas: Boolean,
  tecnicaExpulsivo_desgarro_sin_episiotomía: Boolean,
  observacionesDinamica: String,
  actividadFisicaPostparto: String,
  incontinenciaUrinaria: Boolean,
  incontinenciaFecal: Boolean,
  gasesVaginales: Boolean,
  bultoVaginal: Boolean,

  // Paso 5: Dinámica Menstrual
  edadMenarquia: String,
  edadMenopausia: String,
  diasMenstruacion: String,
  intervaloPeriodo: String,
  caracSangrado_fluido: Boolean,
  caracSangrado_espeso: Boolean,
  caracSangrado_entrecortado: Boolean,
  caracSangrado_coágulos: Boolean,
  caracSangrado_oxidado: Boolean,
  caracSangrado_olor_sangre: Boolean,
  caracSangrado_olor_lubricación: Boolean,
  sintomaMenstrual_todos_los_días: Boolean,
  sintomaMenstrual_síndrome_ovulatorio: Boolean,
  sintomaMenstrual_síndrome_premenstrual: Boolean,
  algiasPeriodo: String,
  observacionesMenstrual: String,
  productoMenstrual_copa_menstrual: Boolean,
  productoMenstrual_tampones: Boolean,
  productoMenstrual_compresa_desechable: Boolean,
  productoMenstrual_compresa_reutilizable: Boolean,
  productoMenstrual_bragas_menstruales: Boolean,
  productoMenstrual_anillo_vaginal: Boolean,
  dolorMenstrual: Boolean,
  ubicacionDolorMenstrual: String,
  factoresPerpetuadores: String,
  factoresCalmantes: String,
  anticonceptivo_píldora: Boolean,
  anticonceptivo_diu: Boolean,
  anticonceptivo_preservativo: Boolean,
  anticonceptivo_parches: Boolean,
  anticonceptivo_diafragma: Boolean,
  anticonceptivo_anillo_vaginal: Boolean,
  tipoAnticonceptivo: String,
  intentosEmbarazo: String,
  noMeQuedoEmbarazada: Boolean,
  fecundacionInVitro: Boolean,
  tratamientoHormonal: Boolean,
  inseminacionArtificial: Boolean,

  // Paso 6: Dinámica Miccional
  protectorMiccional: String,
  ropaInterior: String,
  numMiccionesDia: String,
  cadaCuantasHoras: String,
  numMiccionesNoche: String,
  caracMiccion_normal: Boolean,
  caracMiccion_irritativo: Boolean,
  caracMiccion_urgente: Boolean,
  caracMiccion_doloroso: Boolean,
  deseoMiccional: String,
  vaciadoCompleto: Boolean,
  vaciadoIncompleto: Boolean,
  posturaSentado: Boolean,
  posturaHiperpresivo: Boolean,
  formaMiccion_constante: Boolean,
  formaMiccion_cortada: Boolean,
  formaMiccion_lateralizada: Boolean,
  formaMiccion_inclinada_anterior: Boolean,
  formaMiccion_explosiva: Boolean,
  formaMiccion_aspersor: Boolean,
  formaMiccion_bifurcada: Boolean,
  formaMiccion_débil: Boolean,
  empujarComenzar: Boolean,
  empujarTerminar: Boolean,
  incontinenciaEsfuerzoRie: Boolean,
  incontinenciaEsfuerzoSalta: Boolean,
  incontinenciaEsfuerzoCorre: Boolean,
  incontinenciaEsfuerzoOtros: String,
  incontinenciaUrgencia: Boolean,
  incontinenciaMixta: Boolean,
  dolorOrinar: String,

  // Paso 7: ICIQ-SF
  icicq_frecuencia: String,
  icicq_cantidad: String,
  icicq_impacto: String,
  icicq_cuando_nunca: Boolean,
  icicq_cuando_antes_de_llegar_al_servicio: Boolean,
  icicq_cuando_al_toser_o_estornudar: Boolean,
  icicq_cuando_mientras_duerme: Boolean,
  icicq_cuando_al_realizar_esfuerzos_físicos_ejercicio: Boolean,
  icicq_cuando_cuando_termina_de_orinar_y_ya_se_ha_vestido: Boolean,
  icicq_cuando_sin_motivo_evidente: Boolean,
  icicq_cuando_de_forma_continua: Boolean,

  // Paso 8: Dinámica Defecatoria, Sexual, Nutricional, Sueño, Dolor, Exámenes
  numDefecacionesDia: String,
  numDefecacionesNoche: String,
  numDefecacionesSemana: String,
  posturaDefecatoria_sedestación_vertical: Boolean,
  posturaDefecatoria_inclinado_hacia_delante: Boolean,
  posturaDefecatoria_cuclillas: Boolean,
  formaDefecacion_normal: Boolean,
  formaDefecacion_hiperpresivo: Boolean,
  formaDefecacion_dolorosa: Boolean,
  formaDefecacion_cortada: Boolean,
  formaDefecacion_sensación_vaciado_incompleto: Boolean,
  formaDefecacion_cierre_de_ano_antes_de_completar_vaciado: Boolean,
  dolorDefecacion: String,
  escalaBristol: String,
  gases_ausentes: Boolean,
  gases_pocos: Boolean,
  gases_esporádicos: Boolean,
  gases_frecuentes: Boolean,
  gases_diarios: Boolean,
  gases_constantes: Boolean,
  lubricacion_liquida_blanquecina: Boolean,
  lubricacion_densa_granulada: Boolean,
  lubricacion_mal_olor: Boolean,
  lubricacion_ausente: Boolean,
  orgasmo_ausente: Boolean,
  orgasmo_orgasmo_único: Boolean,
  orgasmo_orgasmo_múltiple: Boolean,
  orgasmo_orgasmo_corto: Boolean,
  orgasmo_orgasmo_doloroso: Boolean,
  disfuncionOrgasmica_no_siente: Boolean,
  disfuncionOrgasmica_dolor_que_inhibe_el_orgasmo: Boolean,
  disfuncionOrgasmica_no_logra_clímax: Boolean,
  disfuncionOrgasmica_no_excitación_y_no_resolución: Boolean,
  disfuncionOrgasmica_frigidez: Boolean,
  iuPenetracion: String,
  dinamicaSexual_conflicto: Boolean,
  dinamicaSexual_ausencia_libido: Boolean,
  dinamicaSexual_promiscuo: Boolean,
  dinamicaSexual_no_tiene_pareja: Boolean,
  dinamicaSexual_a_distancia: Boolean,
  masturbacion: String,
  historiaSexual: String,
  factorEmocional_conflicto_familiar: Boolean,
  factorEmocional_conflicto_pareja_anterior: Boolean,
  factorEmocional_abuso: Boolean,
  factorEmocional_maltrato: Boolean,
  factorEmocional_miedo: Boolean,
  factorEmocional_tabú_cultural: Boolean,
  factorEmocional_tabú_religioso: Boolean,
  factorEmocional_autoconocimiento: Boolean,
  dolorSexual_dispareunia: Boolean,
  dolorSexual_alodinia: Boolean,
  dolorSexual_hiperalgesia: Boolean,
  dolorSexual_ardor: Boolean,
  dolorSexual_picazón: Boolean,
  relacionesSexuales: String,
  dolorIntroito: String,
  dolorFondo: String,
  dolorIrradiado: String,
  dolorPerineal: String,
  ingestaLiquida: String,
  tiposLiquidos: String,
  ingestasSolidas: String,
  tipoDieta: String,
  horarioSueno: String,
  horasSueno: String,
  suenoContinuo: String,
  suenoInterrumpido: String,
  inicioDolor: String,
  localizacionDolor: String,
  tipoDolor: String,
  intensidadDolor: String,
  aumentaCon: String,
  disminuyeCon: String,
  examenesPaciente: String,

  // Paso 9: Evaluación Fisioterapéutica
  marcha: String,
  postura: String,
  diafragmaOrofaringeo: String,
  diafragmaToracico: String,
  testingCentroFrenico_8: Boolean,
  testingCentroFrenico_9: Boolean,
  testingCentroFrenico_10: Boolean,
  testingCentroFrenico_11: Boolean,
  testingCentroFrenico_12: Boolean,
  testingCentroFrenico_1: Boolean,
  testingCentroFrenico_2: Boolean,
  testingCentroFrenico_3: Boolean,
  testingCentroFrenico_4: Boolean,
  testingPilares: String,
  testingArcoCostal: String,
  diafragmaPelvico: String,
  tipoPelvis: String,
  abdomenTestTos: String,
  diastasis: String,
  supraumbilical: String,
  umbilical: String,
  infraumbilical: String,
  movilidad: String,
  testDinamicos: String,
  vulva: String,
  mucosa: String,
  labios: String,
  lubricacionPerineal: String,
  flujoOlorColor: String,
  phVaginal: String,
  vagina: String,
  diametroIntroito: String,
  clitoris: String,
  capuchonDolor: String,
  vulvaClitoris: String,
  sensibilidadLados: String,
  hemorroidesVarices: String,
  cicatrices: String,
  cirugiasEsteticas: String,
  glandulasSkene: String,
  glandulasBartolini: String,
  elasticidadOrquilla: String,
  uretraVaginaAno: String,
  distanciaAnoVulvar: String,
  diametroBituberoso: String,
  nucleoCentralPerine: String,
  contraccionObservar: String,
  reflejoTosAno: Boolean,
  prurito: Boolean,
  escozor: Boolean,
  valoracionNeuro_reflejo_clitorideo: Boolean,
  valoracionNeuro_reflejo_bulvocavernoso: Boolean,
  valoracionNeuro_reflejo_anal: Boolean,
  valoracionNeuro_rolling_test: Boolean,
  valoracionNeuro_maniobra_de_valsalva: Boolean,
  valoracionNeuro_sensibilidad_cutánea: Boolean,
  valoracionNeuro_signo_de_tinel_internoexterno: Boolean,

  // Paso 10: Palpación Interna y PERFECT
  cupulaDerecha: Boolean,
  cupulaIzquierda: Boolean,
  tonoGeneral: String,
  tonoObservaciones: String,
  capacidadContractil: String,
  oxfordGlobal: String,
  oxfordDerecha: String,
  oxfordIzquierda: String,
  perfectPower: String,
  perfectEndurance: String,
  perfectRepetitions: String,
  perfectFast: String,
  perfectECT: String,

  // Paso 11: Evaluación TRP Exopélvicos, Prolapso, Endopélvicos
  // Exopélvicos
  ...Object.fromEntries(
    ligamentosMusculosExo.flatMap(nombre => [
      [`exo_${nombre}_izq_activo`, Boolean],
      [`exo_${nombre}_izq_latente`, Boolean],
      [`exo_${nombre}_der_activo`, Boolean],
      [`exo_${nombre}_der_latente`, Boolean],
    ])
  ),
  // Prolapso
  ...Object.fromEntries(
    prolapsos.map(nombre => [`prolapso_${nombre}_grado`, String])
  ),
  // Endopélvicos
  ...Object.fromEntries(
    ligEndopelvicos.map(nombre => [`endo_${nombre}_presente`, Boolean])
  ),
  dolorTRP: String,
  diagnosticoFisio: String,
  planIntervencion: String,
  firmaPaciente: String,
  firmaFisioterapeuta: String,
  firmaAutorizacion: String,

  // Paso 12: Consentimiento
  consentimientoFecha: String,
  consentimientoCiudad: String,
  consentimientoNombre: String,
  consentimientoCC: String,
  consentimientoFirma: String,
}, { timestamps: true });

module.exports = mongoose.model('ValoracionPisoPelvico', ValoracionPisoPelvicoSchema);