// ============================================
// MODELO: USUARIO (Autenticación)
// ============================================
module.exports = (sequelize, DataTypes) => {
  const Usuario = sequelize.define(
    "Usuario",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING(200),
      },
      password_hash: {
        type: DataTypes.STRING(256),
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      rol: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "usuario",
      },
      activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      ultimo_acceso: DataTypes.DATE,
      registro_medico: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      firma_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      two_factor_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      two_factor_secret: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      intentos_fallidos: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      bloqueado_hasta: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      datos_perfil: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
    },
    {
      tableName: "usuarios",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["username"] },
        { fields: ["activo"] },
        { fields: ["rol"] },
      ],
    },
  );

  // Métodos estáticos
  Usuario.buscarPorUsername = async function (username) {
    return await this.findOne({
      where: { username, activo: true },
    });
  };

  Usuario.buscarPorEmail = async function (email) {
    return await this.findOne({
      where: { email, activo: true },
    });
  };

  // Métodos de instancia
  Usuario.prototype.registrarAcceso = async function () {
    this.ultimo_acceso = new Date();
    await this.save();
  };

  Usuario.prototype.tieneRol = function (rolRequerido) {
    return this.rol === rolRequerido || this.rol === "admin";
  };

  return Usuario;
};
