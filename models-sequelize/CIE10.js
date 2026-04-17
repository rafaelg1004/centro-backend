// ============================================
// MODELO: CIE10 (Catálogo de diagnósticos)
// ============================================
module.exports = (sequelize, DataTypes) => {
  const CIE10 = sequelize.define('CIE10', {
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
      type: DataTypes.STRING(500),
      allowNull: false
    },
    descripcion: DataTypes.TEXT,
    categoria: DataTypes.STRING(100),
    sexo_restringido: {
      type: DataTypes.STRING(1)
    },
    edad_minima: DataTypes.INTEGER,
    edad_maxima: DataTypes.INTEGER,
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'cie10s',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['codigo'] },
      { fields: ['activo'] },
      { fields: ['categoria'] }
    ]
  });

  // Métodos estáticos
  CIE10.buscarPorCodigo = async function(codigo) {
    return await this.findOne({
      where: { codigo, activo: true }
    });
  };

  CIE10.buscarPorNombre = async function(query) {
    const { Op } = require('sequelize');
    return await this.findAll({
      where: {
        activo: true,
        nombre: { [Op.iLike]: `%${query}%` }
      },
      order: [['nombre', 'ASC']],
      limit: 20
    });
  };

  CIE10.obtenerActivos = async function() {
    return await this.findAll({
      where: { activo: true },
      order: [['codigo', 'ASC']]
    });
  };

  return CIE10;
};
