module.exports = (sequelize, DataTypes) => {
  const PlantillaHC = sequelize.define(
    "PlantillaHC",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      codigo: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      nombre: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      tipo_programa: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      es_seguimiento: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      activa: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      orden: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "plantillas_hc",
      timestamps: true,
      underscored: true,
    }
  );

  return PlantillaHC;
};

