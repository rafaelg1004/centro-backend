module.exports = (sequelize, DataTypes) => {
  const ConfiguracionClinica = sequelize.define(
    "ConfiguracionClinica",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nombre_clinica: {
        type: DataTypes.STRING(200),
        allowNull: false,
        defaultValue: "D'Mamitas & Babies",
      },
      slogan: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: "Centro de Estimulación, Fisioterapia y Programas Perinatales",
      },
      nit: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "901XXXXXX-X",
      },
      direccion: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: "Calle 1 # 2-3",
      },
      telefono: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "+57 300 000 0000",
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: "contacto@dmamitas.com",
      },
      logo_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      codigo_habilitacion: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: "Sin Registro",
      },
      representante_legal: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: "Dra. Nombre Apellido",
      },
      registro_profesional_representante: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: "Registro Profesional No. XXXXXX",
      },
    },
    {
      tableName: "configuracion_clinica",
      timestamps: true,
      underscored: true,
    }
  );

  return ConfiguracionClinica;
};
