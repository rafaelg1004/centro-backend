// ============================================
// MODELO: LOG (Auditoría)
// ============================================
module.exports = (sequelize, DataTypes) => {
  const Log = sequelize.define('Log', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    level: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'INFO',
      validate: {
        isIn: [['INFO', 'WARN', 'ERROR', 'DEBUG']]
      }
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['AUTH', 'PACIENTE', 'VALORACION', 'CLASE', 'RIPS', 'API', 'SYSTEM', 'HC_SEGURIDAD']]
      }
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    username: {
      type: DataTypes.STRING(100),
      defaultValue: 'desconocido'
    },
    paciente_id: {
      type: DataTypes.UUID,
      references: {
        model: 'pacientes',
        key: 'id'
      }
    },
    valoracion_id: {
      type: DataTypes.STRING(100)
    },
    details: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    ip: DataTypes.STRING(50),
    user_agent: DataTypes.TEXT
  }, {
    tableName: 'logs',
    timestamps: true,
    underscored: true,
    updatedAt: false, // Los logs no se actualizan
    indexes: [
      { fields: ['timestamp'] },
      { fields: ['category'] },
      { fields: ['level'] },
      { fields: ['username'] },
      { fields: ['paciente_id'] }
    ]
  });

  // Métodos estáticos
  Log.createLog = async function(data) {
    return await this.create(data);
  };

  Log.getLogs = async function(filters = {}, options = {}) {
    const { Op } = require('sequelize');
    const where = {};

    if (filters.category) where.category = filters.category;
    if (filters.level) where.level = filters.level;
    if (filters.user) where.username = filters.user;
    if (filters.paciente_id) where.paciente_id = filters.paciente_id;
    
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp[Op.gte] = new Date(filters.startDate);
      if (filters.endDate) where.timestamp[Op.lte] = new Date(filters.endDate);
    }

    return await this.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: options.limit || 100,
      offset: options.skip || 0
    });
  };

  return Log;
};
