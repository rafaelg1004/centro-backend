module.exports = (sequelize, DataTypes) => {
  const TipoCampoHC = sequelize.define(
    "TipoCampoHC",
    {
      codigo: {
        type: DataTypes.STRING(50),
        primaryKey: true,
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      componente_ui: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "input",
      },
      activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "tipos_campo_hc",
      timestamps: true,
      underscored: true,
    }
  );

  return TipoCampoHC;
};

