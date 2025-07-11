const mongoose = require('mongoose');

const ValoracionIngresoAdultosLactanciaSchema = new mongoose.Schema({
  // Copia aquí todos los campos del formulario, ejemplo:
  nombres: String,
  cedula: String,
  telefono: String,
  correo: String,
  fecha: String,
  hora: String,
  motivoConsulta: String,
  genero: String,
  lugarNacimiento: String,
  fechaNacimiento: String,
  edad: String,
  estadoCivil: String,
  direccion: String,
  celular: String,
  ocupacion: String,
  nivelEducativo: String,
  medicoTratante: String,
  aseguradora: String,
  acompanante: String,
  telefonoAcompanante: String,
  nombreBebe: String,
  semanasGestacion: String,
  fum: String,
  fechaProbableParto: String,
  hospitalarios: String,
  patologicos: String,
  familiares: String,
  traumaticos: String,
  farmacologicos: String,
  quirurgicos: String,
  toxicoAlergicos: String,
  numEmbarazos: String,
  numAbortos: String,
  numPartosVaginales: String,
  instrumentado: String,
  numCesareas: String,
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
  experienciaLactancia: String,
  comoFueExperiencia: String,
  dificultadesLactancia: String,
  deseaAmamantar: String,
  expectativasAsesoria: String,
  conocimientosLactancia: String,
  pechosNormales: Boolean,
  pechosDolorosos: Boolean,
  pechosSecrecion: Boolean,
  pechosCirugias: Boolean,
  formaPezon: String,
  otraFormaPezon: String,
  observacionesFisicas: String,
  medicamentosActuales: String,
  afeccionesMedicas: String,
  apoyoFamiliar: String,
  planIntervencion: String,
  visitaCierre: String,
  firmaPaciente: String,
  firmaFisioterapeutaPlanIntervencion: String,
  firmaAutorizacion: String,
  fechaSesion1: String,
  firmaPacienteSesion1: String,
  fechaSesion2: String,
  firmaPacienteSesion2: String,
  firmaFisioterapeutaPrenatal: String,
  firmaPacientePrenatalFinal: String,

  // Consentimiento informado para asesoría en lactancia
  fechaConsentimientoLactancia: String,
  firmaConsentimientoLactancia: String,
  firmaProfesionalConsentimientoLactancia: String,
  nombreProfesionalConsentimientoLactancia: String,
  registroProfesionalConsentimientoLactancia: String,
}, { timestamps: true });

module.exports = mongoose.model('ValoracionIngresoAdultosLactancia', ValoracionIngresoAdultosLactanciaSchema);