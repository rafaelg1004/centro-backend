const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  level: {
    type: String,
    enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'],
    default: 'INFO',
    required: true
  },
  category: {
    type: String,
    enum: ['AUTH', 'PACIENTE', 'VALORACION', 'CLASE', 'RIPS', 'API', 'SYSTEM', 'HC_SEGURIDAD'],
    required: true
  },
  action: {
    type: String,
    required: true
  },
  user: {
    type: String,
    default: 'desconocido'
  },
  paciente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paciente'
  },
  valoracion: {
    type: String,
    default: 'desconocido'
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ip: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'logs'
});

// Índices para optimizar consultas
logSchema.index({ timestamp: -1 });
logSchema.index({ category: 1, timestamp: -1 });
logSchema.index({ user: 1, timestamp: -1 });
logSchema.index({ level: 1, timestamp: -1 });

// Método estático para crear log
logSchema.statics.createLog = function (data) {
  return new this(data).save();
};

// Método para obtener logs con filtros
logSchema.statics.getLogs = function (filters = {}, options = {}) {
  const query = {};

  if (filters.category) query.category = filters.category;
  if (filters.level) query.level = filters.level;
  if (filters.user) query.user = filters.user;
  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
    if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0);
};

module.exports = mongoose.model('Log', logSchema);