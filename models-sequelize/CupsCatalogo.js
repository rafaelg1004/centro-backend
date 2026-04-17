// ============================================
// MODELO: CUPS_CATALOGO (Catálogo extendido CUPS)
// ============================================
module.exports = (sequelize, DataTypes) => {
  const CupsCatalogo = sequelize.define('CupsCatalogo', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    codigo_cups: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    capitulo: DataTypes.STRING(200),
    seccion: DataTypes.STRING(200),
    categoria: DataTypes.STRING(200),
    subcategoria: DataTypes.STRING(200),
    procedimiento: DataTypes.STRING(500),
    lista: DataTypes.STRING(50),
    institucion: DataTypes.STRING(200),
    vigencia_desde: DataTypes.DATEONLY,
    vigencia_hasta: DataTypes.DATEONLY,
    costo: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    uvrs: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    datos_adicionales: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'cups_catalogos',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['codigo_cups'] },
      { fields: ['activo'] },
      { fields: ['categoria'] },
      { fields: ['capitulo'] }
    ]
  });

  // Métodos estáticos
  CupsCatalogo.buscarPorCodigo = async function(codigo) {
    return await this.findOne({
      where: { codigo_cups: codigo, activo: true }
    });
  };

  CupsCatalogo.buscarPorDescripcion = async function(query) {
    const { Op } = require('sequelize');
    return await this.findAll({
      where: {
        activo: true,
        [Op.or]: [
          { descripcion: { [Op.iLike]: `%${query}%` } },
          { procedimiento: { [Op.iLike]: `%${query}%` } }
        ]
      },
      order: [['descripcion', 'ASC']],
      limit: 20
    });
  };

  CupsCatalogo.obtenerActivos = async function() {
    return await this.findAll({
      where: { activo: true },
      order: [['codigo_cups', 'ASC']]
    });
  };

  CupsCatalogo.obtenerPorCategoria = async function(categoria) {
    return await this.findAll({
      where: { categoria, activo: true },
      order: [['descripcion', 'ASC']]
    });
  };

  return CupsCatalogo;
};
