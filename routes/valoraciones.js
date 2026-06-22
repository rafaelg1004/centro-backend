const express = require("express");
const router = express.Router();
const {
  ValoracionFisioterapia,
  EvolucionSesion,
  Paciente,
} = require("../models-sequelize");
const { Op } = require("sequelize");
const { eliminarImagenesValoracion } = require("../utils/s3Utils");
const logger = require("../utils/logger");
const { verificarBloqueo } = require("../utils/hcMiddleware");

// Middleware para logging de acceso a valoraciones
const logAccesoValoracionMiddleware = (accion) => {
  return (req, res, next) => {
    const usuario =
      req.usuario && req.usuario.username
        ? req.usuario.username
        : "desconocido";
    const clientIP =
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const valoracionId = req.params.id || "multiple";
    let pacienteId = "desconocido";
    if (req.params.pacienteId) pacienteId = req.params.pacienteId;
    else if (req.body && req.body.paciente) pacienteId = req.body.paciente;
    else if (req.query && req.query.pacienteId)
      pacienteId = req.query.pacienteId;

    logger.logValoracion(accion, {
      user: usuario,
      paciente: pacienteId,
      valoracion: valoracionId,
      ip: clientIP,
      userAgent,
      details: {
        metodo: req.method,
        endpoint: req.originalUrl,
      },
    });

    next();
  };
};

// Middleware para validar que no se guarden imÃ¡genes base64
const validarImagenes = (req, res, next) => {
  const data = req.body;
  const camposImagen = [
    "firmaProfesional",
    "firmaRepresentante",
    "firmaAcudiente",
    "firmaFisioterapeuta",
    "firmaAutorizacion",
    "consentimiento_firmaAcudiente",
    "consentimiento_firmaFisio",
  ];

  for (const campo of camposImagen) {
    if (data[campo] && data[campo].toString().startsWith("data:image")) {
      return res.status(400).json({
        error: `El campo ${campo} contiene datos base64. Las imÃ¡genes deben subirse a S3 primero.`,
      });
    }
  }
  next();
};

const generarSesionesPerinatales = (planRaw) => {
  let sesiones = [];
  let sesionesIntensivo = [];

  const plan = String(planRaw || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (plan === "educacion" || plan === "ambos" || plan === "educativa") {
    const nombres = [
      "Sesión No. 1: Introducción y Autocuidado",
      "Sesión No. 2: Parto Vaginal",
      "Sesión No. 3: Cesárea y Postparto",
      "Sesión No. 4: Lactancia",
      "Sesión No. 5: Cuidados del Recién Nacido",
      "Sesión No. 6: Técnicas de Confort",
      "Sesión No. 7: Estimulación Prenatal",
      "Sesión No. 8: Abuelos",
      "Visita en Clínica",
      "Visita de Cierre",
    ];
    sesiones = nombres.map((n) => ({
      nombre: n,
      fecha: "",
      firmaPaciente: "",
    }));
  }

  if (plan === "fisico") {
    // Para la física no le ponemos nombre, solo numeración
    for (let i = 1; i <= 8; i++) {
      sesiones.push({
        nombre: `Sesión No. ${i}`,
        fecha: "",
        firmaPaciente: "",
      });
    }
  }

  if (plan === "intensivo" || plan === "educacion intensiva") {
    const nombres = [
      "Sesión No. 1: Introducción y Autocuidado, Cuidados del recién Nacido, Estimulación Prenatal",
      "Sesión No. 2: Trabajo de Parto, Cesárea",
      "Sesión No. 3: Lactancia, Postparto",
    ];
    sesionesIntensivo = nombres.map((n) => ({
      nombre: n,
      fecha: "",
      firmaPaciente: "",
    }));
  }

  if (plan === "ambos") {
    // Si es ambos, el intensivo (o segunda parte) son las 8 sesiones físicas
    for (let i = 1; i <= 8; i++) {
      sesionesIntensivo.push({
        nombre: `Sesión No. ${i} (Acondicionamiento Físico)`,
        fecha: "",
        firmaPaciente: "",
      });
    }
  }

  return { sesiones, sesionesIntensivo };
};

const crearSesionesEnCascada = async (valId, pacienteId, plan, valoracionPadre = {}) => {
  const { sesiones, sesionesIntensivo } = generarSesionesPerinatales(plan);
  const todas = [...sesiones, ...sesionesIntensivo];

  // Heredar RIPS de la valoración padre si están disponibles; si no, usar valores seguros por defecto
  const codProcedimiento = valoracionPadre.cod_consulta || valoracionPadre.codConsulta || "890211";
  const finalidad = valoracionPadre.finalidad_tecnologia_salud || valoracionPadre.finalidadTecnologiaSalud || "44";
  const diagnostico = valoracionPadre.cod_diagnostico_principal || valoracionPadre.codDiagnosticoPrincipal || "Z348";

  const docs = todas.map((s, idx) => ({
    valoracionAsociada: valId,
    paciente: pacienteId,
    fechaInicioAtencion: new Date(), // Se inicializa con la fecha actual (requerido por RIPS)
    codProcedimiento,
    finalidadTecnologiaSalud: finalidad,
    codDiagnosticoPrincipal: diagnostico,
    numeroSesion: idx + 1,
    descripcionEvolucion: s.nombre,
    firmas: {
      paciente: { firmaUrl: "", timestamp: null },
      profesional: {
        nombre: "Ft. Dayan Ivonne Villegas Gamboa",
        registroMedico: "52862625",
        timestamp: null,
      },
    },
  }));

  if (docs.length > 0) {
    await EvolucionSesion.bulkCreate(docs);
    console.log(
      `✅ Creadas ${docs.length} sesiones (Evoluciones) para la valoración ${valId}`,
    );
  }
};

const mapValoracionData = (body) => {
  const mapped = { ...body }; // Keep original fields just in case

  if (body.paciente) mapped.paciente_id = body.paciente;
  if (body.tipoPrograma !== undefined) mapped.tipo_programa = body.tipoPrograma;
  if (body.fechaInicioAtencion !== undefined) mapped.fecha_inicio_atencion = body.fechaInicioAtencion;
  if (body.fecha_inicio_atencion !== undefined) mapped.fecha_inicio_atencion = body.fecha_inicio_atencion;
  if (body.numAutorizacion !== undefined) mapped.num_autorizacion = body.numAutorizacion;
  if (body.codConsulta !== undefined) mapped.cod_consulta = body.codConsulta;
  if (body.modalidadGrupoServicioTecSal !== undefined) mapped.modalidad_grupo_servicio_tec_sal = body.modalidadGrupoServicioTecSal;
  if (body.grupoServicios !== undefined) mapped.grupo_servicios = body.grupoServicios;
  if (body.finalidadTecnologiaSalud !== undefined) mapped.finalidad_tecnologia_salud = body.finalidadTecnologiaSalud;
  if (body.causaMotivoAtencion !== undefined) mapped.causa_motivo_atencion = body.causaMotivoAtencion;
  if (body.codDiagnosticoPrincipal !== undefined) mapped.cod_diagnostico_principal = body.codDiagnosticoPrincipal;
  if (body.cod_diagnostico_principal !== undefined) mapped.cod_diagnostico_principal = body.cod_diagnostico_principal;
  if (body.tipoDiagnosticoPrincipal !== undefined) mapped.tipo_diagnostico_principal = body.tipoDiagnosticoPrincipal;
  if (body.vrServicio !== undefined) mapped.vr_servicio = body.vrServicio;
  if (body.conceptoRecaudo !== undefined) mapped.concepto_recaudo = body.conceptoRecaudo;
  if (body.motivoConsulta !== undefined) mapped.motivo_consulta = body.motivoConsulta;
  if (body.enfermedadActual !== undefined) mapped.enfermedad_actual = body.enfermedadActual;
  if (body.signosVitales !== undefined) mapped.signos_vitales = body.signosVitales;
  if (body.moduloPediatria !== undefined) mapped.modulo_pediatria = body.moduloPediatria;
  if (body.moduloPisoPelvico !== undefined) mapped.modulo_piso_pelvico = body.moduloPisoPelvico;
  if (body.moduloLactancia !== undefined) mapped.modulo_lactancia = body.moduloLactancia;
  if (body.moduloPerinatal !== undefined) mapped.modulo_perinatal = body.moduloPerinatal;
  if (body.examenFisico !== undefined) mapped.examen_fisico = body.examenFisico;
  if (body.diagnosticoFisioterapeutico !== undefined) mapped.diagnostico_fisioterapeutico = body.diagnosticoFisioterapeutico;
  if (body.planTratamiento !== undefined) mapped.plan_tratamiento = body.planTratamiento;
  if (body.fechaBloqueo !== undefined) mapped.fecha_bloqueo = body.fechaBloqueo;
  if (body.selloIntegridad !== undefined) mapped.sello_integridad = body.selloIntegridad;
  if (body.auditTrail !== undefined) mapped.audit_trail = body.auditTrail;

  return mapped;
};

/**
 * @route   POST /api/valoraciones
 * @desc    Crear una nueva valoraciÃ³n unificada (PediatrÃ­a, Piso PÃ©lvico o Lactancia)
 */
router.post("/", validarImagenes, async (req, res) => {
  try {
    console.log(
      "📬 RECIBIDA PETICIÓN POST /valoraciones:",
      JSON.stringify(req.body, null, 2),
    );
    const { paciente, codConsulta } = req.body;

    // Guardar payload crudo como backup para auditoría
    try {
      await sequelize.query(
        `INSERT INTO raw_inputs_backups (endpoint, method, paciente_id, payload) VALUES ($1, $2, $3, $4)`,
        {
          bind: ['/valoraciones', 'POST', paciente || null, req.body]
        }
      );
    } catch (auditErr) {
      console.error("[AUDIT] Error guardando raw_inputs_backups:", auditErr);
    }

    if (!paciente) {
      return res.status(400).json({
        error: "PACIENTE_REQUERIDO",
        mensaje: "El campo paciente es obligatorio",
      });
    }

    // Verificar si ya existe una valoraciÃ³n Activa/Reciente para este paciente y tipo
    const valoracionExistente = await ValoracionFisioterapia.findOne({
      where: { paciente_id: paciente, cod_consulta: codConsulta },
    });

    if (valoracionExistente && !req.body.permitirDuplicado) {
      return res.status(409).json({
        error: "VALORACION_DUPLICADA",
        mensaje:
          "Este paciente ya tiene una valoraciÃ³n registrada de este tipo.",
        valoracionExistente: {
          id: valoracionExistente.id,
          fecha: valoracionExistente.fecha_inicio_atencion,
        },
      });
    }

    // Autocreación de sesiones para Perinatal si tiene plan
    let planParaSesiones = null;
    if (req.body.codConsulta === "890211") {
      const plan = req.body.moduloPerinatal?.planElegido;

      console.log("🔍 Validando creación de sesiones perinatales:", { plan });

      if (plan) {
        planParaSesiones = plan;
        // No sobreescribir tipoPrograma: debe conservarse como 'Perinatal' para detección correcta del esquema
      } else {
        console.log(
          "⚠️ No se programaron sesiones independientes: falta definir el plan.",
        );
      }
    }

    const dataToSave = mapValoracionData(req.body);

    const valoracionGuardada = await ValoracionFisioterapia.create({
      ...dataToSave,
      fecha_inicio_atencion: dataToSave.fecha_inicio_atencion || new Date(),
      creado_por: req.usuario?.id || null,
    });

    // Crear sesiones (Evoluciones/Citas) si procede
    if (planParaSesiones) {
      try {
        await crearSesionesEnCascada(
          valoracionGuardada.id,
          valoracionGuardada.paciente,
          planParaSesiones,
          valoracionGuardada.toJSON ? valoracionGuardada.toJSON() : valoracionGuardada,
        );
      } catch (errSes) {
        console.error("❌ Error creando sesiones en cascada:", errSes);
      }
    }

    res.status(201).json(valoracionGuardada);
  } catch (error) {
    console.error("Error al guardar valoraciÃ³n:", error);
    res
      .status(500)
      .json({ mensaje: "Error en el servidor", error: error.message });
  }
});

/**
 * @route   GET /api/valoraciones
 * @desc    Obtener listado unificado de valoraciones con filtros RIPS
 */
router.get(
  "/",
  logAccesoValoracionMiddleware("LISTAR_VALORACIONES"),
  async (req, res) => {
    try {
      const {
        busqueda,
        fechaInicio,
        fechaFin,
        pagina = 1,
        limite = 500,
        modulo,
      } = req.query;
      const skip = (parseInt(pagina) - 1) * parseInt(limite);

      let whereClause = {};

      if (busqueda) {
        const pacientesCoincidentes = await Paciente.findAll({
          where: {
            [Op.or]: [
              { nombres: { [Op.iLike]: `%${busqueda}%` } },
              { apellidos: { [Op.iLike]: `%${busqueda}%` } },
              { num_documento_identificacion: { [Op.iLike]: `%${busqueda}%` } },
            ],
          },
          attributes: ["id"],
        });
        whereClause.paciente_id = {
          [Op.in]: pacientesCoincidentes.map((p) => p.id),
        };
      }

      if (modulo) {
        // Filtro por tipo de mÃ³dulo (especialidad) - usando JSONB para mÃ³dulos
        if (modulo === "pediatria")
          whereClause.modulo_pediatria = { [Op.ne]: null };
        if (modulo === "pisoPelvico")
          whereClause.modulo_piso_pelvico = { [Op.ne]: null };
        if (modulo === "lactancia")
          whereClause.modulo_lactancia = { [Op.ne]: null };
        if (modulo === "perinatal") whereClause.cod_consulta = "890211";
      }

      if (fechaInicio || fechaFin) {
        whereClause.fecha_inicio_atencion = {};
        if (fechaInicio)
          whereClause.fecha_inicio_atencion[Op.gte] = new Date(fechaInicio);
        if (fechaFin)
          whereClause.fecha_inicio_atencion[Op.lte] = new Date(fechaFin);
      }

      const total = await ValoracionFisioterapia.count({ where: whereClause });
      const valoraciones = await ValoracionFisioterapia.findAll({
        where: whereClause,
        include: [
          {
            model: Paciente,
            as: "paciente",
            attributes: [
              "id",
              "nombres",
              "apellidos",
              "num_documento_identificacion",
            ],
          },
          {
            model: require("../models-sequelize").Usuario,
            as: "creador",
            attributes: ["nombre"]
          }
        ],
        order: [["created_at", "DESC"]],
        offset: skip,
        limit: parseInt(limite),
      });

      const tieneModuloPoblado = (obj) => {
        if (!obj || typeof obj !== "object") return false;
        const json = JSON.stringify(obj);
        if (json === "{}") return false;

        // Eliminamos estructuras vacías de Mongoose y valores por defecto
        const clean = json
          .replace(/[{}":,\[\]\s]/g, "")
          .replace(/false|null|undefined/g, "");
        // Para Piso Pelvico, Mongoose suele meter habitos, evaluacionFisica, etc como llaves aunque esten vacios
        const keysToIgnore = [
          "habitos",
          "evaluacionFisica",
          "evaluacionMuscular",
          "prenatales",
          "perinatales",
          "recienNacido",
          "desarrolloSocial",
          "hitos",
          "examen",
          "desarrolloMotor",
          "motricidadFina",
          "lenguaje",
          "socioemocional",
        ];
        let content = clean;
        keysToIgnore.forEach((k) => (content = content.split(k).join("")));

        return content.length > 0;
      };

      const mapiado = await Promise.all(
        valoraciones.map(async (v) => {
          // Prioridad absoluta al campo tipo_programa si existe
          let tipo = v.tipo_programa || null;

          if (!tipo) {
            // Detectar tipo basándose en contenido REAL de los módulos
            if (tieneModuloPoblado(v.modulo_lactancia)) {
              tipo = "Lactancia";
            } else if (tieneModuloPoblado(v.modulo_pediatria)) {
              tipo = "Pediatría";
            } else if (tieneModuloPoblado(v.modulo_piso_pelvico)) {
              tipo = "Piso Pélvico";
            }
            // Fallback por cod_consulta (retrocompatibilidad)
            else if (v.cod_consulta === "890211") {
              tipo = "Perinatal";
            } else if (v.cod_consulta === "890202") {
              tipo = "Piso Pélvico";
            } else {
              tipo = v.cod_consulta === "890201" ? "Pediatría" : "General";
            }
          }

          // Si es perinatal, adjuntar información de progreso de sesiones independientes
          let sesionesIndependientes = [];
          if (v.cod_consulta === "890211") {
            const rawSesiones = await EvolucionSesion.findAll({
              where: { valoracion_id: v.id },
              raw: true,
            });
            // Aliasing para retrocompatibilidad con la UI de arrays
            sesionesIndependientes = rawSesiones.map((s) => ({
              ...s,
              firmaPaciente: s.firmas?.paciente?.firmaUrl,
              nombre: s.descripcion_evolucion,
              fecha: s.fecha_inicio_atencion,
            }));
          }

          const vJson = v.toJSON ? v.toJSON() : v;

          return {
            ...vJson,
            tipo,
            sesiones: sesionesIndependientes.filter(
              (s) =>
                !s.descripcion_evolucion?.includes("Intensivo") &&
                !s.descripcion_evolucion?.includes("Físico"),
            ),
            sesionesIntensivo: sesionesIndependientes.filter(
              (s) =>
                s.descripcion_evolucion?.includes("Intensivo") ||
                s.descripcion_evolucion?.includes("Físico"),
            ),
          };
        }),
      );

      res.json({
        valoraciones: mapiado,
        paginacion: {
          total,
          pagina: parseInt(pagina),
          totalPaginas: Math.ceil(total / limite),
        },
      });
    } catch (error) {
      res.status(500).json({
        mensaje: "Error al obtener valoraciones",
        error: error.message,
      });
    }
  },
);

/**
 * @route   GET /api/valoraciones/verificar/:pacienteId
 * @desc    Check if patient already has a valuation
 */
router.get("/verificar/:pacienteId", async (req, res) => {
  try {
    const valoracion = await ValoracionFisioterapia.findOne({
      where: { paciente_id: req.params.pacienteId },
      order: [["fecha_inicio_atencion", "DESC"]],
    });
    if (valoracion) {
      res.json({
        tieneValoracion: true,
        valoracion: {
          id: valoracion.id,
          fecha: valoracion.fecha_inicio_atencion,
          motivoDeConsulta: valoracion.motivo_consulta || "No especificado",
        },
      });
    } else {
      res.json({ tieneValoracion: false });
    }
  } catch (error) {
    console.error("Error validando valoración previa:", error);
    res
      .status(500)
      .json({ mensaje: "Error al verificar valoración", error: error.message });
  }
});

/**
 * @route   GET /api/valoraciones/paciente/:pacienteId
 * @desc    Obtener todas las valoraciones de un paciente (Cualquier tipo)
 */
router.get("/paciente/:pacienteId", async (req, res) => {
  try {
    const pId = req.params.pacienteId;

    // 1. Obtener todas las valoraciones (incluyendo las migradas)
    const valoraciones = await ValoracionFisioterapia.findAll({
      where: { paciente_id: pId },
      order: [["fecha_inicio_atencion", "DESC"]],
    });

    const { tieneModuloPoblado: tmpPop } = {
      tieneModuloPoblado: (obj) => {
        if (!obj || typeof obj !== "object") return false;
        const json = JSON.stringify(obj);
        const clean = json
          .replace(/[{}":,\[\]\s]/g, "")
          .replace(/false|null|undefined/g, "");
        const keysToIgnore = [
          "habitos",
          "evaluacionFisica",
          "evaluacionMuscular",
          "prenatales",
          "perinatales",
          "recienNacido",
          "desarrolloSocial",
          "hitos",
          "examen",
          "desarrolloMotor",
          "motricidadFina",
          "lenguaje",
          "socioemocional",
        ];
        let content = clean;
        keysToIgnore.forEach((k) => (content = content.split(k).join("")));
        return content.length > 0;
      },
    };

    const mapiado = await Promise.all(
      valoraciones.map(async (v) => {
        let tipo = null;
        let ruta = "/valoraciones/";

        // Priorizar cod_consulta sobre tipoPrograma para mayor precisión
        // Nota: cod_consulta puede incluir descripción (ej. "890211 - CONSULTA..."), usar startsWith
        const codConsultaV = String(v.cod_consulta || '').split(' ')[0].trim();
        if (codConsultaV === "890211") tipo = "Perinatal";
        else if (codConsultaV === "890202") tipo = "Piso Pélvico";
        else if (codConsultaV === "890201") tipo = "Pediatría";
        else if (codConsultaV === "890203") tipo = "Lactancia";
        else if (v.tipoPrograma) {
          // Usar tipoPrograma solo si cod_consulta no está definido
          if (v.tipoPrograma.includes("Lactancia")) tipo = "Lactancia";
          else if (v.tipoPrograma.includes("Piso")) tipo = "Piso Pélvico";
          else if (v.tipoPrograma === "Perinatal") tipo = "Perinatal";
          else if (v.tipoPrograma === "Pediatría") tipo = "Pediatría";
        }

        // Si aún no hay tipo, revisar módulos poblados
        if (!tipo) {
          if (tmpPop(v.modulo_lactancia)) tipo = "Lactancia";
          else if (tmpPop(v.modulo_pediatria)) tipo = "Pediatría";
          else if (tmpPop(v.modulo_piso_pelvico)) tipo = "Piso Pélvico";
          else if (tmpPop(v.modulo_perinatal)) tipo = "Perinatal";
          else tipo = "General";
        }

        // Si es una valoración migrada, podemos añadir un distintivo
        if (v.legacy_id) {
          tipo += " (Migrado)";
        }

        let sesionesIndependientes = [];
        if (codConsultaV === "890211") {
          const rawSesiones = await EvolucionSesion.findAll({
            where: { valoracion_id: v.id },
          });
          sesionesIndependientes = rawSesiones.map((s) => ({
            ...s.toJSON(),
            firmaPaciente: s.firmas?.paciente?.firmaUrl,
            nombre: s.descripcion_evolucion,
            fecha: s.fecha_inicio_atencion,
          }));
        }

        return {
          ...v.toJSON(),
          tipo,
          ruta: `${ruta}${v.id}`,
          fecha: v.fecha_inicio_atencion,
          sesiones: sesionesIndependientes.filter(
            (s) =>
              !s.descripcion_evolucion?.includes("Intensivo") &&
              !s.descripcion_evolucion?.includes("Físico"),
          ),
          sesionesIntensivo: sesionesIndependientes.filter(
            (s) =>
              s.descripcion_evolucion?.includes("Intensivo") ||
              s.descripcion_evolucion?.includes("Físico"),
          ),
        };
      }),
    );

    res.json(mapiado);
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al obtener valoraciones", error: error.message });
  }
});

router.get(
  "/:id",
  logAccesoValoracionMiddleware("CONSULTAR_VALORACION"),
  async (req, res) => {
    try {
      // Obtener valoración sin include para evitar problemas de asociación
      const valoracion = await ValoracionFisioterapia.findByPk(req.params.id);
      if (!valoracion) return res.status(404).json({ error: "No encontrada" });

      const obj = valoracion.toJSON();

      // Obtener paciente por separado usando paciente_id
      console.log("[DEBUG] Valoracion paciente_id:", obj.paciente_id);
      if (obj.paciente_id) {
        try {
          const paciente = await Paciente.findByPk(obj.paciente_id);
          console.log("[DEBUG] Paciente encontrado:", paciente ? "SÍ" : "NO");
          if (paciente) {
            const pacienteData = paciente.toJSON();
            // Combinar nombres y apellidos para crear nombre_completo
            obj.paciente = {
              ...pacienteData,
              nombre_completo:
                `${pacienteData.nombres || ""} ${pacienteData.apellidos || ""}`.trim(),
            };
            console.log(
              "[DEBUG] Paciente datos:",
              JSON.stringify(obj.paciente, null, 2),
            );
          }
        } catch (pacienteError) {
          console.error("Error al obtener paciente:", pacienteError);
          // No fallar si no se puede obtener el paciente
        }
      }

      // Inyectar sesiones si es perinatal
      const codConsultaObj = String(obj.cod_consulta || '').split(' ')[0].trim();
      if (codConsultaObj === "890211") {
        const rawSesiones = await EvolucionSesion.findAll({
          where: { valoracion_id: obj.id },
        });
        const sesionesMapeadas = rawSesiones.map((s) => ({
          ...s.toJSON(),
          firmaPaciente: s.firmas?.paciente?.firmaUrl,
          nombre: s.descripcion_evolucion,
          fecha: s.fecha_inicio_atencion,
        }));
        obj.sesiones = sesionesMapeadas.filter(
          (s) =>
            !s.descripcion_evolucion?.includes("Intensivo") &&
            !s.descripcion_evolucion?.includes("Físico"),
        );
        obj.sesionesIntensivo = sesionesMapeadas.filter(
          (s) =>
            s.descripcion_evolucion?.includes("Intensivo") ||
            s.descripcion_evolucion?.includes("Físico"),
        );
      }

      res.json(obj);
    } catch (error) {
      res.status(500).json({ mensaje: "Error al obtener valoración", error });
    }
  },
);

router.delete(
  "/:id",
  logAccesoValoracionMiddleware("ELIMINAR_VALORACION"),
  verificarBloqueo(ValoracionFisioterapia, "ValoraciÃ³n"),
  async (req, res) => {
    try {
      const valoracion = await ValoracionFisioterapia.findByPk(req.params.id);
      if (!valoracion)
        return res.status(404).json({ mensaje: "No encontrada" });

      // Eliminar imÃ¡genes si existen
      const camposImagen = [
        "firmas.pacienteOAcudiente.firmaUrl",
        "firmas.profesional.firmaUrl",
      ];
      await eliminarImagenesValoracion(valoracion, camposImagen);

      await valoracion.destroy();
      res.json({ mensaje: "ValoraciÃ³n eliminada correctamente" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

router.put(
  "/:id",
  logAccesoValoracionMiddleware("ACTUALIZAR_VALORACION"),
  verificarBloqueo(ValoracionFisioterapia, "ValoraciÃ³n"),
  validarImagenes,
  async (req, res) => {
    try {
      const valoracionActual = await ValoracionFisioterapia.findByPk(
        req.params.id,
      );
      if (!valoracionActual)
        return res.status(404).json({ mensaje: "No encontrada" });

      // Guardar payload crudo como backup para auditoría
      try {
        await sequelize.query(
          `INSERT INTO raw_inputs_backups (endpoint, method, paciente_id, valoracion_id, payload) VALUES ($1, $2, $3, $4, $5)`,
          {
            bind: [`/valoraciones/${req.params.id}`, 'PUT', valoracionActual.paciente_id || null, req.params.id, req.body]
          }
        );
      } catch (auditErr) {
        console.error("[AUDIT] Error guardando raw_inputs_backups:", auditErr);
      }

      const {
        generarHash,
        obtenerMetadatosPista,
      } = require("../utils/auditUtils");

      // LÃ³gica de firmas y auditorÃ­a (Nueva estructura)
      if (req.body.firmas) {
        if (!req.body.auditTrail)
          req.body.auditTrail = valoracionActual.auditTrail || {};

        // Si hay nueva firma del profesional
        if (
          req.body.firmas.profesional?.firmaUrl &&
          req.body.firmas.profesional.firmaUrl !==
          valoracionActual.firmas?.profesional?.firmaUrl
        ) {
          req.body.auditTrail.firmaProfesional = obtenerMetadatosPista(req);
          req.body.auditTrail.firmaProfesional.registroProfesional =
            req.usuario?.registroMedico;
        }
      }

      // Sellado criptogrÃ¡fico si se bloquea
      if (req.body.bloqueada && !valoracionActual.bloqueada) {
        req.body.fechaBloqueo = new Date();
        req.body.selloIntegridad = generarHash({
          contenido: req.body,
          auditTrail: req.body.auditTrail,
          fechaBloqueo: req.body.fechaBloqueo,
        });
      }

      // Autocreación de sesiones en actualización si tiene plan y no existen
      let planDiferido = null;
      if (
        valoracionActual.cod_consulta === "890211" ||
        req.body.cod_consulta === "890211"
      ) {
        const plan =
          req.body.moduloPerinatal?.planElegido ||
          req.body.tipoPrograma ||
          valoracionActual.moduloPerinatal?.planElegido;

        // Consultar si ya existen sesiones (Evoluciones) para esta valoración
        const countSesiones = await EvolucionSesion.count({
          where: { valoracion_id: req.params.id },
        });
        const sinSesiones = countSesiones === 0;

        console.log(
          "🔍 Validando creación diferida de sesiones perinatales (PUT):",
          { plan, sinSesiones },
        );

        if (plan && sinSesiones) {
          planDiferido = plan;
          req.body.tipoPrograma = plan;
        }
      }

      const dataToUpdate = mapValoracionData(req.body);
      await valoracionActual.update(dataToUpdate);

      if (planDiferido) {
        try {
          const padreActualizado = {
            ...(valoracionActual.toJSON ? valoracionActual.toJSON() : valoracionActual),
            ...req.body,
          };
          await crearSesionesEnCascada(
            valoracionActual.id,
            valoracionActual.paciente_id,
            planDiferido,
            padreActualizado,
          );
        } catch (errSes) {
          console.error(
            "❌ Error creando sesiones diferidas en cascada:",
            errSes,
          );
        }
      }

      res.json({
        mensaje: "Actualizada correctamente",
        valoracion: valoracionActual.toJSON(),
      });
    } catch (error) {
      res
        .status(500)
        .json({ mensaje: "Error al actualizar", error: error.message });
    }
  },
);
module.exports = router;
