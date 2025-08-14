const mongoose = require("mongoose");

// Sesiones del programa perinatal (10 sesiones)
const SesionPerinatalSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  fecha: { type: String, required: false }, // No required - puede estar vacía
  firmaPaciente: { type: String }, // URL de S3 (no required para permitir sesiones sin firma)
});

// Modelo principal
const ConsentimientoPerinatalSchema = new mongoose.Schema({
  paciente: { type: mongoose.Schema.Types.ObjectId, ref: "PacienteAdulto", required: true }, // <-- referencia a paciente adulto

  // Paso 1: Datos básicos
  fecha: String,
  hora: String,
  motivoConsulta: String,
  tipoPrograma: { type: String, enum: ['educacion', 'fisico', 'intensivo', 'ambos'] }, // Tipo de programa seleccionado

  // Paso 2: Antecedentes
  hospitalarios: String,
  patologicos: String,
  familiares: String,
  traumaticos: String,
  farmacologicos: String,
  quirurgicos: String,
  toxicoAlergicos: String,
  numEmbarazos: Number,
  numAbortos: Number,
  numPartosVaginales: Number,
  instrumentado: String,
  numCesareas: Number,
  fechaObstetrico: String,
  peso: String,
  talla: String,
  episiotomia: String,
  desgarro: String,
  espacioEntreEmbarazos: String,
  actividadFisica: String,
  complicaciones: String,
  cirugiasPrevias: String,
  prolapsos: String,
  hormonales: String,
  anticonceptivos: String,

  // Paso 3: Estado de salud
  temperatura: String,
  ta: String,
  fr: String,
  fc: String,
  pesoPrevio: String,
  pesoActual: String,
  tallaEstadoSalud: String,
  imc: String,
  abortosAnteriores: String,
  otrasComplicaciones: String,
  explicacionComplicaciones: String,
  numGestacionesPrevias: Number,
  fatigaMarcada: String,
  sangradoVaginal: String,
  debilidadMareo: String,
  dolorAbdominal: String,
  sudoracionEspontanea: String,
  doloresCabeza: String,
  sudoracionPantorrilla: String,
  ausenciaMovFetales: String,
  dejarGanarPeso: String,
  explicacionCondicionActual: String,
  actividadesFisicas: String,
  intensidad: String,
  frecuencia: String,
  tiempo: String,
  levantarPesos: String,
  subirEscaleras: String,
  caminarOcasionalmente: String,
  bipedestacion: String,
  mantenerSentada: String,
  actividadNormal: String,
  actividadFisicaDeseada: String,
  rupturaMembranas: String,
  hemorragiaPersistente: String,
  hipertensionEmbarazo: String,
  cervixIncompetente: String,
  restriccionCrecimiento: String,
  embarazoAltoRiesgo: String,
  diabetesNoControlada: String,
  cambioActividad: String,
  historiaAborto: String,
  enfermedadCardioRespiratoria: String,
  anemia: String,
  malnutricion: String,
  embarazoGemelar: String,
  diabetesNoControladaAbsoluta: String,
  actividadFisicaAprobada: String,
  observaciones: String,

  // Paso 4: Evaluación fisioterapéutica
  postura: String,
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

  // Paso 5: Diagnóstico y plan de intervención
  diagnosticoFisioterapeutico: String,
  planIntervencion: String,
  visitaCierre: String,
  firmaPaciente: String, // Firma digital del paciente para diagnóstico
  firmaFisioterapeuta: String, // Firma digital del fisioterapeuta para diagnóstico
  firmaAutorizacion: String, // Firma digital para autorización de imágenes

  // Paso 6: Consentimiento físico
  firmaPacienteConsentimiento: String,
  firmaFisioterapeutaConsentimiento: String,

  // Paso 7: Consentimiento educación perinatal (10 sesiones)
  sesiones: { type: [SesionPerinatalSchema], default: [] }, // Array de sesiones (puede estar vacío)
  firmaPacienteGeneral: String, // Firma general paciente
  firmaFisioterapeutaGeneral: String, // Firma general fisioterapeuta

  // Paso 8: Consentimiento intensivo (si aplica)
  sesionesIntensivo: [SesionPerinatalSchema], // 3 sesiones intensivo (opcional)
  firmaPacienteGeneralIntensivo: String,
  firmaFisioterapeutaGeneralIntensivo: String,
  
  // Firmas adicionales para diferentes tipos de programa
  firmaPacienteFisico: String, // Firma para programa físico
  firmaFisioterapeutaFisico: String, // Firma fisioterapeuta para programa físico
  firmaPacienteEducacion: String, // Firma para programa intensivo/educación
  firmaFisioterapeutaEducacion: String, // Firma fisioterapeuta para programa intensivo/educación

  fechaRegistro: { type: Date, default: Date.now },
});

module.exports = mongoose.models.ConsentimientoPerinatal || mongoose.model("ConsentimientoPerinatal", ConsentimientoPerinatalSchema);