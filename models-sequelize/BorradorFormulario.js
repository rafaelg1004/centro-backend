// ============================================
// MODELO: BORRADOR FORMULARIO (Autoguardado)
// ============================================
module.exports = (sequelize, DataTypes) => {
  const BorradorFormulario = sequelize.define('BorradorFormulario', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    usuarioId: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    pacienteId: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    nombrePaciente: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    tipoFormulario: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    datos: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'borradores_formularios',
    timestamps: true, // adds createdAt and updatedAt
    underscored: true
  });

  return BorradorFormulario;
};
