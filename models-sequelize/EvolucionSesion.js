// ============================================
// MODELO: EVOLUCION_SESION
// ============================================
module.exports = (sequelize, DataTypes) => {
  const EvolucionSesion = sequelize.define('EvolucionSesion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    valoracion_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'valoraciones_fisioterapia',
        key: 'id'
      }
    },
    paciente_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'pacientes',
        key: 'id'
      }
    },
    // Datos RIPS
    fecha_inicio_atencion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    cod_procedimiento: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    via_ingreso_servicio_salud: {
      type: DataTypes.STRING(2),
      defaultValue: '02'
    },
    finalidad_tecnologia_salud: {
      type: DataTypes.STRING(2),
      allowNull: false
    },
    cod_diagnostico_principal: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    vr_servicio: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    // Datos asistenciales
    numero_sesion: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    descripcion_evolucion: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    objetivo_sesion: DataTypes.TEXT,
    plan_siguiente_sesion: DataTypes.TEXT,
    observaciones: DataTypes.TEXT,
    // Firmas
    firmas: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    // Seguridad
    bloqueada: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    fecha_bloqueo: DataTypes.DATE,
    sello_integridad: DataTypes.STRING(256),
    audit_trail: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'evoluciones_sesion',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['valoracion_id'] },
      { fields: ['paciente_id'] },
      { fields: ['numero_sesion'] },
      { fields: ['fecha_inicio_atencion'] }
    ]
  });

  // Métodos estáticos
  EvolucionSesion.obtenerPorValoracion = async function(valoracionId) {
    return await this.findAll({
      where: { valoracion_id: valoracionId },
      order: [['numero_sesion', 'ASC']]
    });
  };

  EvolucionSesion.obtenerPorPaciente = async function(pacienteId) {
    return await this.findAll({
      where: { paciente_id: pacienteId },
      order: [['fecha_inicio_atencion', 'DESC']]
    });
  };

  EvolucionSesion.obtenerUltimaSesion = async function(valoracionId) {
    return await this.findOne({
      where: { valoracion_id: valoracionId },
      order: [['numero_sesion', 'DESC']]
    });
  };

  EvolucionSesion.getNextNumeroSesion = async function(valoracionId) {
    const ultima = await this.obtenerUltimaSesion(valoracionId);
    return ultima ? ultima.numero_sesion + 1 : 1;
  };

  return EvolucionSesion;
};
