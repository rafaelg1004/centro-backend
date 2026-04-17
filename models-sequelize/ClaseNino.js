// ============================================
// MODELO: CLASE_NINO (Relación muchos a muchos)
// ============================================
module.exports = (sequelize, DataTypes) => {
  const ClaseNino = sequelize.define('ClaseNino', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    clase_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'clases',
        key: 'id'
      }
    },
    paciente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'pacientes',
        key: 'id'
      }
    },
    firma: DataTypes.TEXT,
    numero_factura: DataTypes.STRING(50),
    audit_trail: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'clase_ninos',
    timestamps: true,
    underscored: true,
    updatedAt: false, // Solo created_at
    indexes: [
      { fields: ['clase_id'] },
      { fields: ['paciente_id'] },
      { fields: ['clase_id', 'paciente_id'], unique: true }
    ]
  });

  return ClaseNino;
};
