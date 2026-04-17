// ============================================
// MODELO: PAGO_PAQUETE
// ============================================
module.exports = (sequelize, DataTypes) => {
  const PagoPaquete = sequelize.define('PagoPaquete', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    paciente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'pacientes',
        key: 'id'
      }
    },
    numero_factura: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    clases_pagadas: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    clases_usadas: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    fecha_pago: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'pago_paquetes',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['paciente_id'] },
      { fields: ['numero_factura'] }
    ]
  });

  // Métodos estáticos
  PagoPaquete.obtenerPorPaciente = async function(pacienteId) {
    return await this.findAll({
      where: { paciente_id: pacienteId },
      order: [['fecha_pago', 'DESC']]
    });
  };

  PagoPaquete.obtenerActivosPorPaciente = async function(pacienteId) {
    const { Op } = require('sequelize');
    return await this.findAll({
      where: {
        paciente_id: pacienteId,
        clases_usadas: { [Op.lt]: sequelize.col('clases_pagadas') }
      },
      order: [['fecha_pago', 'DESC']]
    });
  };

  // Métodos de instancia
  PagoPaquete.prototype.getClasesDisponibles = function() {
    return this.clases_pagadas - this.clases_usadas;
  };

  PagoPaquete.prototype.tieneClasesDisponibles = function() {
    return this.clases_usadas < this.clases_pagadas;
  };

  return PagoPaquete;
};
