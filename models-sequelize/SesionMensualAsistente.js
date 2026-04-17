// ============================================
// MODELO: SESION_MENSUAL_ASISTENTES
// ============================================
module.exports = (sequelize, DataTypes) => {
  const SesionMensualAsistente = sequelize.define('SesionMensualAsistente', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sesion_mensual_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'sesiones_mensuales',
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
    observaciones: DataTypes.TEXT
  }, {
    tableName: 'sesion_mensual_asistentes',
    timestamps: true,
    underscored: true,
    updatedAt: false,
    indexes: [
      { fields: ['sesion_mensual_id'] },
      { fields: ['paciente_id'] },
      { fields: ['sesion_mensual_id', 'paciente_id'], unique: true }
    ]
  });

  return SesionMensualAsistente;
};
