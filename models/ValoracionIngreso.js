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
  rutinaDiaria: String,

  // Paso 4 - Desarrollo Ontológico
  // Motricidad Gruesa
  sostieneCabeza_si: Boolean,
  sostieneCabeza_no: Boolean,
  sostieneCabeza_observaciones: String,
  
  seVoltea_si: Boolean,
  seVoltea_no: Boolean,
  seVoltea_observaciones: String,
  
  seSientaSinApoyo_si: Boolean,
  seSientaSinApoyo_no: Boolean,
  seSientaSinApoyo_observaciones: String,
  
  gatea_si: Boolean,
  gatea_no: Boolean,
  gatea_observaciones: String,
  
  sePoneDePerApoyado_si: Boolean,
  sePoneDePerApoyado_no: Boolean,
  sePoneDePerApoyado_observaciones: String,
  
  caminaSolo_si: Boolean,
  caminaSolo_no: Boolean,
  caminaSolo_observaciones: String,
  
  correSalta_si: Boolean,
  correSalta_no: Boolean,
  correSalta_observaciones: String,

  // Motricidad Fina
  sigueObjetosMirada_si: Boolean,
  sigueObjetosMirada_no: Boolean,
  sigueObjetosMirada_observaciones: String,
  
  llevaObjetosBoca_si: Boolean,
  llevaObjetosBoca_no: Boolean,
  llevaObjetosBoca_observaciones: String,
  
  pasaObjetosEntreManos_si: Boolean,
  pasaObjetosEntreManos_no: Boolean,
  pasaObjetosEntreManos_observaciones: String,
  
  pinzaSuperior_si: Boolean,
  pinzaSuperior_no: Boolean,
  pinzaSuperior_observaciones: String,
  
  encajaPiezasGrandes_si: Boolean,
  encajaPiezasGrandes_no: Boolean,
  encajaPiezasGrandes_observaciones: String,
  
  dibujaGarabatos_si: Boolean,
  dibujaGarabatos_no: Boolean,
  dibujaGarabatos_observaciones: String,

  // Lenguaje y Comunicación
  balbucea_si: Boolean,
  balbucea_no: Boolean,
  balbucea_observaciones: String,
  
  diceMamaPapa_si: Boolean,
  diceMamaPapa_no: Boolean,
  diceMamaPapa_observaciones: String,
  
  senalaQueQuiere_si: Boolean,
  senalaQueQuiere_no: Boolean,
  senalaQueQuiere_observaciones: String,
  
  dice5a10Palabras_si: Boolean,
  dice5a10Palabras_no: Boolean,
  dice5a10Palabras_observaciones: String,
  
  entiendeOrdenesSimples_si: Boolean,
  entiendeOrdenesSimples_no: Boolean,
  entiendeOrdenesSimples_observaciones: String,
  
  usaFrases2Palabras_si: Boolean,
  usaFrases2Palabras_no: Boolean,
  usaFrases2Palabras_observaciones: String,

  // Socioemocional
  sonrieSocialmente_si: Boolean,
  sonrieSocialmente_no: Boolean,
  sonrieSocialmente_observaciones: String,
  
  respondeNombre_si: Boolean,
  respondeNombre_no: Boolean,
  respondeNombre_observaciones: String,
  
  interesaOtrosNinos_si: Boolean,
  interesaOtrosNinos_no: Boolean,
  interesaOtrosNinos_observaciones: String,
  
  juegoSimbolico_si: Boolean,
  juegoSimbolico_no: Boolean,
  juegoSimbolico_observaciones: String,
  
  seDespideLanzaBesos_si: Boolean,
  seDespideLanzaBesos_no: Boolean,
  seDespideLanzaBesos_observaciones: String,

  // Conclusión General
  nivelDesarrolloAcorde_si: Boolean,
  nivelDesarrolloAcorde_no: Boolean,
  areasRequierenAcompanamiento: String,
  actividadesSugeridasCasa: String,
  estimulacionEntornoDiario: String,
  seguimientoSugeridoFecha: String,

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

  // Paso 5 - Diagnóstico Fisioterapéutico y Plan de Tratamiento
  diagnosticoFisioterapeutico: String, // "opcion1" o "opcion2"
  planTratamiento: String, // "opcion1" o "opcion2"

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
  firmaAutorizacion: String, // base64 - solo del paciente/acudiente

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

