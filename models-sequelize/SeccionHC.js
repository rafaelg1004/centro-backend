module.exports = (sequelize, DataTypes) => {
  const SeccionHC = sequelize.define(
    "SeccionHC",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      plantilla_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      titulo: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      orden: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      siempre_visible: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "secciones_hc",
      timestamps: true,
      underscored: true,
    }
  );

  return SeccionHC;
};

