// ============================================
// MODELO: SESION_MENSUAL
// ============================================
module.exports = (sequelize, DataTypes) => {
  const SesionMensual = sequelize.define('SesionMensual', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    descripcion_general: DataTypes.TEXT,
    firma_fisioterapeuta: DataTypes.TEXT,
    bloqueada: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    fecha_bloqueo: DataTypes.DATE,
    sello_integridad: DataTypes.STRING(256),
    audit_trail: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'sesiones_mensuales',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['fecha'] }
    ]
  });

  return SesionMensual;
};
