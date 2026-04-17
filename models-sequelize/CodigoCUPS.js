// ============================================
// MODELO: CODIGO_CUPS
// ============================================
module.exports = (sequelize, DataTypes) => {
  const CodigoCUPS = sequelize.define('CodigoCUPS', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    nombre: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    descripcion: DataTypes.TEXT,
    tipo_servicio: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    categoria: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    valor: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    finalidad: {
      type: DataTypes.STRING(10),
      defaultValue: '11'
    },
    diagnostico_cie: {
      type: DataTypes.STRING(10),
      defaultValue: 'Z51.4'
    },
    grupo_servicio: {
      type: DataTypes.STRING(2),
      defaultValue: '04'
    },
    modalidad: {
      type: DataTypes.STRING(2),
      defaultValue: '01'
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    clave_interna: {
      type: DataTypes.STRING(50),
      unique: true
    }
  }, {
    tableName: 'codigos_cups',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['categoria'] },
      { fields: ['activo'] },
      { fields: ['clave_interna'] }
    ]
  });

  // Métodos estáticos
  CodigoCUPS.obtenerPorClave = async function(claveInterna) {
    return await this.findOne({
      where: { clave_interna: claveInterna, activo: true }
    });
  };

  CodigoCUPS.obtenerActivos = async function() {
    return await this.findAll({
      where: { activo: true },
      order: [['categoria', 'ASC'], ['nombre', 'ASC']]
    });
  };

  CodigoCUPS.obtenerPorCategoria = async function(categoria) {
    return await this.findAll({
      where: { categoria, activo: true },
      order: [['nombre', 'ASC']]
    });
  };

  CodigoCUPS.obtenerPorTipoServicio = async function(tipoServicio) {
    return await this.findAll({
      where: { tipo_servicio: tipoServicio, activo: true },
      order: [['nombre', 'ASC']]
    });
  };

  return CodigoCUPS;
};
