module.exports = (sequelize, DataTypes) => {
  const OpcionCampoHC = sequelize.define(
    "OpcionCampoHC",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      campo_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      valor: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      etiqueta: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      orden: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      tableName: "opciones_campo_hc",
      timestamps: true,
      underscored: true,
    }
  );

  return OpcionCampoHC;
};

