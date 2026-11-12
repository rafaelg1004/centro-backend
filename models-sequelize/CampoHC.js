module.exports = (sequelize, DataTypes) => {
  const CampoHC = sequelize.define(
    "CampoHC",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      seccion_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      codigo_path: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      etiqueta: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      tipo_campo_codigo: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      requerido: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      solo_lectura: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      auto_now: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      placeholder: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      valor_defecto: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      configuracion_extra: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      orden: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "campos_hc",
      timestamps: true,
      underscored: true,
    }
  );

  return CampoHC;
};

