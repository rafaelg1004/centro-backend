const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PacienteSchema = new Schema({
  // Datos RIPS Obligatorios (Res. 2275 de 2023)
  tipoDocumentoIdentificacion: { type: String, required: true }, // 'CC', 'TI', 'RC', etc.
  numDocumentoIdentificacion: { type: String, required: true, unique: true },
  nombres: { type: String, required: true },
  apellidos: { type: String, required: true },
  fechaNacimiento: { type: Date, required: true }, // Formato: AAAA-MM-DD
  codSexo: { type: String, required: true }, // 'M', 'F'
  codPaisResidencia: { type: String, default: "170" }, // 170 para Colombia
  codMunicipioResidencia: { type: String }, // Código DANE, ej: '05134'
  codZonaTerritorialResidencia: { type: String, default: "01" }, // '01' Urbana, '02' Rural
  tipoUsuario: { type: String, default: "04" }, // '04' Particular, '01' Contributivo

  // Datos Asistenciales Adicionales
  estadoCivil: { type: String },
  ocupacion: { type: String },
  aseguradora: { type: String }, // Mantenido para lógica de negocio
  datosContacto: {
    direccion: String,
    telefono: String,
    correo: String,
    nombreAcompanante: String,
    telefonoAcompanante: String,
    parentescoAcompanante: String
  },

  // Ley 1581 de 2012 - Habeas Data y Tratamiento de Datos
  consentimientoDatos: {
    aceptado: { type: Boolean, default: false },
    fechaFirma: Date,
    firmaUrl: String,
    auditTrail: {
      ip: String,
      dispositivo: String,
      hash: String
    }
  }
}, { timestamps: true });

module.exports = mongoose.models.Paciente || mongoose.model('Paciente', PacienteSchema);
