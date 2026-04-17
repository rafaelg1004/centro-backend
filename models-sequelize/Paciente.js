// ============================================
// MODELO: PACIENTE
// ============================================
module.exports = (sequelize, DataTypes) => {
  const Paciente = sequelize.define(
    "Paciente",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // Datos RIPS Obligatorios
      tipo_documento_identificacion: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      num_documento_identificacion: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      nombres: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      apellidos: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      fecha_nacimiento: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      cod_sexo: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      cod_pais_residencia: {
        type: DataTypes.STRING(3),
        defaultValue: "170",
      },
      cod_municipio_residencia: {
        type: DataTypes.STRING(50),
      },
      cod_zona_territorial_residencia: {
        type: DataTypes.STRING(2),
        defaultValue: "01",
      },
      tipo_usuario: {
        type: DataTypes.STRING(2),
        defaultValue: "04",
      },
      es_adulto: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Datos Asistenciales
      estado_civil: DataTypes.STRING(50),
      ocupacion: DataTypes.STRING(100),
      nivel_educativo: DataTypes.STRING(100),
      aseguradora: DataTypes.STRING(100),
      medico_tratante: DataTypes.STRING(100),
      lugar_nacimiento: DataTypes.STRING(100),
      // Datos Maternos
      estado_embarazo: DataTypes.STRING(50),
      nombre_bebe: DataTypes.STRING(100),
      fum: DataTypes.STRING(50),
      semanas_gestacion: DataTypes.STRING(50),
      fecha_probable_parto: DataTypes.STRING(50),
      // Datos Pediátricos
      nombre_madre: DataTypes.STRING(100),
      edad_madre: DataTypes.STRING(50),
      ocupacion_madre: DataTypes.STRING(100),
      nombre_padre: DataTypes.STRING(100),
      edad_padre: DataTypes.STRING(50),
      ocupacion_padre: DataTypes.STRING(100),
      pediatra: DataTypes.STRING(100),
      peso: DataTypes.STRING(50),
      talla: DataTypes.STRING(50),
      // JSONB para campos complejos
      datos_contacto: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      consentimiento_datos: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
    },
    {
      tableName: "pacientes",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["num_documento_identificacion"] },
        { fields: ["nombres"] },
        { fields: ["apellidos"] },
        { fields: ["es_adulto"] },
      ],
    },
  );

  // Métodos de clase
  Paciente.buscarPorDocumento = async function (documento) {
    return await this.findOne({
      where: { num_documento_identificacion: documento },
    });
  };

  Paciente.buscarPorNombre = async function (query) {
    const { Op } = require("sequelize");
    return await this.findAll({
      where: {
        [Op.or]: [
          { nombres: { [Op.iLike]: `%${query}%` } },
          { apellidos: { [Op.iLike]: `%${query}%` } },
          { num_documento_identificacion: { [Op.iLike]: `%${query}%` } },
        ],
      },
      order: [["nombres", "ASC"]],
      limit: 20,
    });
  };

  // Método de instancia para obtener nombre completo
  Paciente.prototype.getNombreCompleto = function () {
    return `${this.nombres} ${this.apellidos}`.trim();
  };

  // Método para calcular edad
  Paciente.prototype.getEdad = function () {
    if (!this.fecha_nacimiento) return 0;
    const hoy = new Date();
    const nacimiento = new Date(this.fecha_nacimiento);

    if (this.es_adulto) {
      let edad = hoy.getFullYear() - nacimiento.getFullYear();
      if (
        hoy.getMonth() < nacimiento.getMonth() ||
        (hoy.getMonth() === nacimiento.getMonth() &&
          hoy.getDate() < nacimiento.getDate())
      ) {
        edad--;
      }
      return edad;
    } else {
      return (
        (hoy.getFullYear() - nacimiento.getFullYear()) * 12 +
        (hoy.getMonth() - nacimiento.getMonth())
      );
    }
  };

  return Paciente;
};
