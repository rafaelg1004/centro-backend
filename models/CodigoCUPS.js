/**
 * Modelo de Códigos CUPS (Clasificación Única de Procedimientos en Salud)
 * Resolución 1036 de 2022 - Ministerio de Salud Colombia
 */

const mongoose = require('mongoose');

const CodigoCUPSSchema = new mongoose.Schema({
  // Código CUPS oficial
  codigo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Nombre del procedimiento/servicio
  nombre: {
    type: String,
    required: true,
    trim: true
  },

  // Descripción detallada
  descripcion: {
    type: String,
    trim: true
  },

  // Tipo de servicio según RIPS
  tipoServicio: {
    type: String,
    enum: ['consulta', 'procedimiento', 'valoracion'],
    required: true
  },

  // Categoría específica del centro
  categoria: {
    type: String,
    enum: ['fisioterapia', 'prenatal', 'postnatal', 'pisoPelvico', 'pediatria', 'lactancia', 'general'],
    required: true
  },

  // Valor del servicio en pesos colombianos
  valor: {
    type: Number,
    default: 0,
    min: 0
  },

  // Código de finalidad según Resolución 1036
  finalidad: {
    type: String,
    default: '11' // Valoración integral por defecto
  },

  // Código diagnóstico CIE-10 asociado por defecto
  diagnosticoCIE: {
    type: String,
    default: 'Z51.4' // Fisioterapia por defecto
  },

  // Grupo de servicios según RIPS
  grupoServicio: {
    type: String,
    enum: ['01', '02', '03', '04', '05'], // 01=consultas, 02=medicamentos, 03=intervenciones, 04=procedimientos, 05=otros
    default: '04' // Procedimientos por defecto
  },

  // Modalidad del servicio
  modalidad: {
    type: String,
    enum: ['01', '02', '09'], // 01=individual, 02=grupal, 09=consulta externa
    default: '01'
  },

  // Si el código está activo
  activo: {
    type: Boolean,
    default: true
  },

  // Clave interna para mapeo (ej: 'consultaGeneral', 'terapiaFisicaIndividual')
  claveInterna: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
CodigoCUPSSchema.index({ tipoServicio: 1, categoria: 1 });
CodigoCUPSSchema.index({ activo: 1 });

// Método estático para obtener código por clave interna
CodigoCUPSSchema.statics.obtenerPorClave = async function(claveInterna) {
  return await this.findOne({ claveInterna, activo: true });
};

// Método estático para obtener todos los códigos activos
CodigoCUPSSchema.statics.obtenerActivos = async function() {
  return await this.find({ activo: true }).sort({ categoria: 1, nombre: 1 });
};

// Método estático para obtener códigos por categoría
CodigoCUPSSchema.statics.obtenerPorCategoria = async function(categoria) {
  return await this.find({ categoria, activo: true }).sort({ nombre: 1 });
};

// Método estático para obtener códigos por tipo de servicio
CodigoCUPSSchema.statics.obtenerPorTipoServicio = async function(tipoServicio) {
  return await this.find({ tipoServicio, activo: true }).sort({ nombre: 1 });
};

module.exports = mongoose.model('CodigoCUPS', CodigoCUPSSchema);
