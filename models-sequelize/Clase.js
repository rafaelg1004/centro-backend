// ============================================
// MODELO: CLASE
// ============================================
module.exports = (sequelize, DataTypes) => {
  const Clase = sequelize.define('Clase', {
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
    descripcion: DataTypes.TEXT,
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
    tableName: 'clases',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['fecha'] }
    ]
  });

  // Métodos estáticos
  Clase.obtenerPorFecha = async function(fecha) {
    return await this.findAll({
      where: { fecha },
      order: [['created_at', 'DESC']]
    });
  };

  Clase.obtenerPorRangoFechas = async function(fechaInicio, fechaFin) {
    const { Op } = require('sequelize');
    return await this.findAll({
      where: {
        fecha: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      },
      order: [['fecha', 'ASC']]
    });
  };

  return Clase;
};
