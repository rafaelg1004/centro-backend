/**
 * RUTA LEGACY: /api/consentimientos-perinatales
 *
 * Proxy de compatibilidad hacia el modelo unificado `ValoracionFisioterapia`.
 * Los consentimientos perinatales son una valoración fisica de tipo Perinatal.
 */
const express = require("express");
const router = express.Router();
const { ValoracionFisioterapia, Paciente } = require("../models-sequelize");
const { Op } = require("sequelize");
const { eliminarImagenesValoracion } = require("../utils/s3Utils");
const { verificarBloqueo } = require("../utils/hcMiddleware");
const logger = require("../utils/logger");

const CUPS_PERINATAL = "890204"; // Código CUPS para evaluación perinatal/prenatal

const bloquearBase64 = (req, res, next) => {
  const camposImagen = [
    "firmaPaciente",
    "firmaFisioterapeuta",
    "firmaAutorizacion",
    "firmaPacienteConsentimiento",
    "firmaPacienteGeneral",
  ];
  for (const campo of camposImagen) {
    if (
      req.body[campo] &&
      typeof req.body[campo] === "string" &&
      req.body[campo].startsWith("data:image")
    ) {
      return res
        .status(400)
        .json({ error: `El campo ${campo} contiene base64. Use URL de S3.` });
    }
  }
  // Verificar en arrays de sesiones
  if (req.body.sesiones && Array.isArray(req.body.sesiones)) {
    for (let i = 0; i < req.body.sesiones.length; i++) {
      if (req.body.sesiones[i].firmaPaciente?.startsWith("data:image")) {
        return res
          .status(400)
          .json({ error: `sesiones[${i}].firmaPaciente contiene base64.` });
      }
    }
  }
  next();
};

// Crear consentimiento perinatal
router.post("/", bloquearBase64, async (req, res) => {
  try {
    if (!req.body.paciente) {
      return res
        .status(400)
        .json({ error: "El campo paciente es obligatorio" });
    }

    // Verificar duplicado
    const existe = await ValoracionFisioterapia.findOne({
      where: { paciente_id: req.body.paciente, cod_consulta: CUPS_PERINATAL },
    });

    if (existe) {
      return res.status(409).json({
        error: "VALORACION_DUPLICADA",
        mensaje: "Este paciente ya tiene un consentimiento perinatal.",
        valoracionExistente: {
          id: existe.id,
          fecha: existe.fecha_inicio_atencion,
        },
      });
    }

    const guardada = await ValoracionFisioterapia.create({
      paciente_id: req.body.paciente,
      fecha_inicio_atencion: req.body.fecha
        ? new Date(req.body.fecha)
        : new Date(),
      cod_consulta: CUPS_PERINATAL,
      finalidad_tecnologia_salud: "44",
      causa_motivo_atencion: "21",
      cod_diagnostico_principal: req.body.codDiagnosticoPrincipal || "Z348",
      motivo_consulta: req.body.motivoConsulta || "Evaluación perinatal",
      antecedentes: {
        quirurgicos: req.body.quirurgicos,
        farmacologicos: req.body.farmacologicos,
        alergias: req.body.toxicoAlergicos,
        traumaticos: req.body.traumaticos,
        gineco_obstetricos: {
          embarazo_alto_riesgo: req.body.embarazoAltoRiesgo,
          diabetes_no_controlada: req.body.diabetesNoControlada,
          historia_aborto: req.body.historiaAborto,
          semanas_gestacion: req.body.semanasGestacion,
        },
      },
      diagnostico_fisioterapeutico:
        req.body.diagnosticoFisioterapeutico || "Evaluación perinatal",
      plan_tratamiento: req.body.planIntervencion || "Programa perinatal",
      // Guardar datos legacy completos (formulario es muy extenso)
      _datos_legacy: req.body,
      bloqueada: req.body.bloqueada || false,
      audit_trail: req.body.auditTrail || {},
    });

    res.status(201).json(guardada);
  } catch (error) {
    console.error("Error al crear consentimiento:", error);
    res
      .status(500)
      .json({ mensaje: "Error en el servidor", error: error.message });
  }
});

// Obtener todos los consentimientos
router.get("/", async (req, res) => {
  try {
    const { busqueda, pagina = 1, limite = 15 } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    let whereClause = { cod_consulta: CUPS_PERINATAL };

    if (busqueda) {
      const pacientes = await Paciente.findAll({
        where: {
          [Op.or]: [
            { nombres: { [Op.iLike]: `%${busqueda}%` } },
            { num_documento_identificacion: { [Op.iLike]: `%${busqueda}%` } },
          ],
        },
        attributes: ["id"],
      });
      whereClause.paciente_id = { [Op.in]: pacientes.map((p) => p.id) };
    }

    const total = await ValoracionFisioterapia.count({ where: whereClause });
    const valoraciones = await ValoracionFisioterapia.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
      offset,
      limit: parseInt(limite),
    });

    res.json({
      valoraciones,
      paginacion: {
        total,
        pagina: parseInt(pagina),
        totalPaginas: Math.ceil(total / limite),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        mensaje: "Error al obtener consentimientos",
        error: error.message,
      });
  }
});

// Obtener consentimientos de un paciente adulto específico
router.get("/paciente/:pacienteId", async (req, res) => {
  try {
    const valoraciones = await ValoracionFisioterapia.findAll({
      where: {
        paciente_id: req.params.pacienteId,
        cod_consulta: CUPS_PERINATAL,
      },
      order: [["created_at", "DESC"]],
    });
    res.json(valoraciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener consentimiento por ID
router.get("/:id", async (req, res) => {
  try {
    const v = await ValoracionFisioterapia.findByPk(req.params.id);
    if (!v) return res.status(404).json({ error: "No encontrado" });
    res.json(v);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar consentimiento
router.put(
  "/:id",
  verificarBloqueo(ValoracionFisioterapia, "Consentimiento Perinatal"),
  bloquearBase64,
  async (req, res) => {
    try {
      const {
        generarHash,
        obtenerMetadatosPista,
      } = require("../utils/auditUtils");
      const actual = await ValoracionFisioterapia.findByPk(req.params.id);
      if (!actual) return res.status(404).json({ error: "No encontrado" });

      const updateData = { ...req.body };

      // Seguimiento de firmas y auditoría
      const auditTrail = actual.audit_trail || {};
      const camposFirma = [
        "firmaPaciente",
        "firmaFisioterapeuta",
        "firmaPacienteGeneral",
      ];
      for (const campo of camposFirma) {
        if (
          req.body[campo] &&
          req.body[campo] !== actual._datos_legacy?.[campo]
        ) {
          auditTrail[campo] = obtenerMetadatosPista(req);
        }
      }
      updateData.audit_trail = auditTrail;

      // También guardar en _datos_legacy
      if (actual._datos_legacy) {
        updateData._datos_legacy = { ...actual._datos_legacy, ...req.body };
      }

      // Sello de integridad
      if (req.body.bloqueada && !actual.bloqueada) {
        updateData.fecha_bloqueo = new Date();
        updateData.sello_integridad = generarHash({
          contenido: req.body,
          fechaBloqueo: updateData.fecha_bloqueo,
        });
      }

      await actual.update(updateData);
      res.json({
        mensaje: "Actualizado correctamente",
        consentimiento: actual.toJSON(),
      });
    } catch (error) {
      res
        .status(500)
        .json({ mensaje: "Error al actualizar", error: error.message });
    }
  },
);

// Eliminar consentimiento
router.delete(
  "/:id",
  verificarBloqueo(ValoracionFisioterapia, "Consentimiento Perinatal"),
  async (req, res) => {
    try {
      const v = await ValoracionFisioterapia.findByPk(req.params.id);
      if (!v) return res.status(404).json({ error: "No encontrado" });
      await v.destroy();
      res.json({ mensaje: "Eliminado correctamente" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

module.exports = router;
