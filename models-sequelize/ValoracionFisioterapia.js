// ============================================
// MODELO: VALORACION_FISIOTERAPIA
// ============================================
module.exports = (sequelize, DataTypes) => {
  const ValoracionFisioterapia = sequelize.define(
    "ValoracionFisioterapia",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      paciente_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "pacientes",
          key: "id",
        },
      },
      creado_por: DataTypes.UUID,

      // Tipo de programa
      tipo_programa: DataTypes.STRING(50),

      // Datos RIPS
      fecha_inicio_atencion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      num_autorizacion: DataTypes.STRING(50),
      cod_consulta: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      modalidad_grupo_servicio_tec_sal: {
        type: DataTypes.STRING(2),
        defaultValue: "09",
      },
      grupo_servicios: {
        type: DataTypes.STRING(2),
        defaultValue: "01",
      },
      finalidad_tecnologia_salud: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      causa_motivo_atencion: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      cod_diagnostico_principal: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      tipo_diagnostico_principal: {
        type: DataTypes.STRING(2),
        defaultValue: "01",
      },
      vr_servicio: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },
      concepto_recaudo: {
        type: DataTypes.STRING(2),
        defaultValue: "05",
      },

      // Datos clínicos
      motivo_consulta: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      enfermedad_actual: DataTypes.TEXT,
      signos_vitales: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },

      // Antecedentes
      antecedentes: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },

      // Módulos específicos (JSONB para flexibilidad)
      modulo_pediatria: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      modulo_piso_pelvico: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      modulo_lactancia: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      modulo_perinatal: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },

      // Examen físico
      examen_fisico: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      diagnostico_fisioterapeutico: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      plan_tratamiento: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // Firmas
      firmas: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },

      // Seguridad
      bloqueada: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      fecha_bloqueo: DataTypes.DATE,
      sello_integridad: DataTypes.STRING(256),
      audit_trail: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      datos_legacy: {
        type: DataTypes.JSONB,
      },
    },
    {
      tableName: "valoraciones_fisioterapia",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["paciente_id"] },
        { fields: ["tipo_programa"] },
        { fields: ["fecha_inicio_atencion"] },
        { fields: ["cod_diagnostico_principal"] },
      ],
    },
  );

  // Métodos estáticos
  ValoracionFisioterapia.obtenerPorPaciente = async function (pacienteId) {
    return await this.findAll({
      where: { paciente_id: pacienteId },
      order: [["fecha_inicio_atencion", "DESC"]],
    });
  };

  ValoracionFisioterapia.obtenerPorTipoPrograma = async function (
    pacienteId,
    tipoPrograma,
  ) {
    return await this.findAll({
      where: {
        paciente_id: pacienteId,
        tipo_programa: tipoPrograma,
      },
      order: [["fecha_inicio_atencion", "DESC"]],
    });
  };

  ValoracionFisioterapia.obtenerAbiertas = async function (pacienteId) {
    return await this.findAll({
      where: {
        paciente_id: pacienteId,
        bloqueada: false,
      },
      order: [["fecha_inicio_atencion", "DESC"]],
    });
  };

  // Métodos de instancia
  ValoracionFisioterapia.prototype.estaBloqueada = function () {
    return this.bloqueada === true;
  };

  ValoracionFisioterapia.prototype.getResumen = function () {
    return {
      id: this.id,
      tipo_programa: this.tipo_programa,
      fecha: this.fecha_inicio_atencion,
      diagnostico: this.cod_diagnostico_principal,
      bloqueada: this.bloqueada,
    };
  };

  return ValoracionFisioterapia;
};
