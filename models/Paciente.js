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
  esAdulto: { type: Boolean, default: false }, // Para facilitar filtros y lógica UI

  // Datos Asistenciales Adicionales (Adultos y General)
  estadoCivil: { type: String },
  ocupacion: { type: String },
  nivelEducativo: { type: String },
  aseguradora: { type: String },
  medicoTratante: { type: String },
  lugarNacimiento: { type: String },

  // Datos Maternos / Materno-Perinatales
  estadoEmbarazo: { type: String }, // 'gestacion' | 'posparto'
  nombreBebe: { type: String },
  fum: { type: String }, // Adultos/Materno
  semanasGestacion: { type: String }, // Adultos/Materno
  fechaProbableParto: { type: String }, // Adultos/Materno

  // Datos Asistenciales Adicionales (Niños/Pediátrico)
  nombreMadre: { type: String },
  edadMadre: { type: String },
  ocupacionMadre: { type: String },
  nombrePadre: { type: String },
  edadPadre: { type: String },
  ocupacionPadre: { type: String },
  pediatra: { type: String },
  peso: { type: String },
  talla: { type: String },


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
