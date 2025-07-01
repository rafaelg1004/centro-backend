const mongoose = require('mongoose');

const ValoracionIngresoSchema = new mongoose.Schema({
  paciente: { type: mongoose.Schema.Types.ObjectId, ref: "Paciente", required: true }, // referencia al paciente/niño

  // Elimina los campos duplicados de datos generales aquí

  // Paso 1 (solo los campos propios de la valoración, no del paciente)
  fecha: String,
  hora: String,
  motivoDeConsulta: String,

  // Paso 2
  antecedentesPrenatales: [String],
  tipoParto: String,
  tiempoGestacion: String,
  lugarParto: String,
  atendida: String,
  medicoParto: String,
  pesoNacimiento: String,
  tallaNacimiento: String,
  recibioCurso: String,
  recienNacido: [String],
  lactancia: String,
  tiempoLactancia: String,
  hospitalarios: String,
  patologicos: String,
  familiares: String,
  traumaticos: String,
  farmacologicos: String,
  quirurgicos: String,
  toxicos: String,
  dieta: String,

  // Paso 3 - Desarrollo Personal y Hábitos
  problemasSueno: String,
  descripcionSueno: String,
  duermeCon: String,
  patronSueno: String,
  pesadillas: String,
  siesta: String,
  dificultadesComer: String,
  motivoComida: String,
  problemasComer: String,
  detalleProblemasComer: String,
  alimentosPreferidos: String,
  alimentosNoLeGustan: String,
  viveConPadres: String,
  permaneceCon: String,
  prefiereA: String,
  relacionHermanos: String,
  emociones: String,
  juegaCon: String,
  juegosPreferidos: String,
  relacionDesconocidos: String,
  rutinaDiaria: [
    {
      desde: String,
      hasta: String,
      actividad: String
    }
  ],

  // Paso 4
  ontologico_ControlCefalico_si: Boolean,
  tiempo_ControlCefalico: String,
  observaciones_ControlCefalico: String,
  ontologico_Rolados_si: Boolean,
  tiempo_Rolados: String,
  observaciones_Rolados: String,
  ontologico_Sedente_si: Boolean,
  tiempo_Sedente: String,
  observaciones_Sedente: String,
  ontologico_Gateo_si: Boolean,
  tiempo_Gateo: String,
  observaciones_Gateo: String,
  ontologico_Bipedo_si: Boolean,
  tiempo_Bipedo: String,
  observaciones_Bipedo: String,
  ontologico_Marcha_si: Boolean,
  tiempo_Marcha: String,
  observaciones_Marcha: String,

  frecuenciaCardiaca: String,
  frecuenciaRespiratoria: String,
  temperatura: String,
  tejidoTegumentario: String,
  reflejosOsteotendinosos: String,
  reflejosAnormales: String,
  reflejosPatologicos: String,
  tonoMuscular: String,
  controlMotor: String,
  desplazamientos: String,
  sensibilidad: String,
  perfilSensorial: String,
  deformidades: String,
  aparatosOrtopedicos: String,
  sistemaPulmonar: String,
  problemasAsociados: String,

  // Paso 5
  diagnostico: String,
  planTratamiento: String,

  // Paso 6 - Firmas
  nombreAcudiente: String,
  cedulaAcudiente: String,
  firmaRepresentante: String,
  nombreFisioterapeuta: String,
  cedulaFisioterapeuta: String,
  firmaProfesional: String,

  // Paso 7 - Autorización de imagen
  autorizacionNombre: String,
  autorizacionRegistro: String,
  ciudadFirma: String,
  diaFirma: String,
  mesFirma: String,
  anioFirma: String,
  cedulaAutorizacion: String,
  firmaAutorizacion: String, // base64

  // Paso 8 - Consentimiento informado
  consentimiento_nombreAcudiente: String,
  consentimiento_ccAcudiente: String,
  consentimiento_lugarExpedicion: String,
  consentimiento_nombreNino: String,
  consentimiento_registroCivil: String,
  consentimiento_fecha: String,
  consentimiento_firmaAcudiente: String, // base64
  consentimiento_ccFirmaAcudiente: String,
  consentimiento_firmaFisio: String,     // base64
  consentimiento_ccFirmaFisio: String,
},
{
  timestamps: true
});

module.exports = mongoose.model('ValoracionIngreso', ValoracionIngresoSchema);

