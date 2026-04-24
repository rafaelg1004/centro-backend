/**
 * RUTA LEGACY: /api/valoracion-ingreso-adultos-lactancia
 *
 * Proxy de compatibilidad hacia el modelo unificado `ValoracionFisioterapia`.
 * El frontend que usa esta ruta seguirá funcionando sin cambios.
 * Internamente, todos los datos se guardan en la colección `valoracionfisioterapias`
 * con el módulo `moduloLactancia` activado.
 */
const express = require("express");
const router = express.Router();
const { ValoracionFisioterapia, Paciente } = require("../models-sequelize");
const { Op } = require("sequelize");
const { eliminarImagenesValoracion } = require("../utils/s3Utils");
const { verificarBloqueo } = require("../utils/hcMiddleware");

const CUPS_LACTANCIA = "890201"; // Código CUPS para valoración de lactancia

const bloquearBase64 = (req, res, next) => {
  const camposImagen = [
    "firmaPaciente",
    "firmaAutorizacion",
    "firmaFisioterapeutaPlanIntervencion",
    "firmaConsentimientoLactancia",
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
  next();
};

// Crear valoración de lactancia
router.post("/", bloquearBase64, async (req, res) => {
  try {
    if (!req.body.paciente) {
      return res
        .status(400)
        .json({ error: "El campo paciente es obligatorio" });
    }

    // Verificar duplicado para este tipo específico
    const existe = await ValoracionFisioterapia.findOne({
      where: {
        paciente_id: req.body.paciente,
        cod_consulta: CUPS_LACTANCIA,
        modulo_lactancia: { [Op.ne]: null },
      },
    });

    if (existe) {
      return res.status(409).json({
        error: "VALORACION_DUPLICADA",
        mensaje: "Este paciente ya tiene una valoración de lactancia.",
        valoracionExistente: {
          id: existe.id,
          fecha: existe.fecha_inicio_atencion,
        },
      });
    }

    // Mapear campos del formulario legacy al nuevo modelo unificado
    const guardada = await ValoracionFisioterapia.create({
      paciente_id: req.body.paciente,
      fecha_inicio_atencion: req.body.fecha
        ? new Date(req.body.fecha)
        : new Date(),
      cod_consulta: CUPS_LACTANCIA,
      finalidad_tecnologia_salud: "44",
      causa_motivo_atencion: "21",
      cod_diagnostico_principal: req.body.codDiagnosticoPrincipal || "Z391",
      motivo_consulta: req.body.motivoConsulta || "Asesoría en lactancia",
      antecedentes: {
        patologicos: req.body.patologicos,
        quirurgicos: req.body.quirurgicos,
        farmacologicos: req.body.farmacologicos,
        alergias: req.body.toxicoAlergicos,
        traumaticos: req.body.traumaticos,
        gineco_obstetricos: {
          semanas_gestacion: req.body.semanasGestacion,
          fum: req.body.fum,
        },
      },
      modulo_lactancia: {
        experiencia_lactancia: req.body.experienciaLactancia,
        como_fue_experiencia: req.body.comoFueExperiencia,
        dificultades_lactancia: req.body.dificultadesLactancia,
        desea_amamantar: req.body.deseaAmamantar,
        pechos_normales: req.body.pechosNormales,
        pechos_dolorosos: req.body.pechosDolorosos,
        pechos_secrecion: req.body.pechosSecrecion,
        pechos_cirugias: req.body.pechosCirugias,
        forma_pezon: req.body.formaPezon,
        otra_forma_pezon: req.body.otraFormaPezon,
      },
      diagnostico_fisioterapeutico:
        req.body.afeccionesMedicas ||
        req.body.planIntervencion ||
        "Evaluación de lactancia",
      plan_tratamiento: req.body.planIntervencion || "Plan de lactancia",
      // Guardar todos los campos legacy en un objeto extra para no perder datos
      _datos_legacy: req.body,
      bloqueada: req.body.bloqueada || false,
      audit_trail: req.body.auditTrail || {},
    });

    res.status(201).json(guardada);
  } catch (error) {
    console.error("Error al crear valoración de lactancia:", error);
    res
      .status(500)
      .json({ mensaje: "Error en el servidor", error: error.message });
  }
});

// Obtener todas las valoraciones de lactancia
router.get("/", async (req, res) => {
  try {
    const { busqueda, pagina = 1, limite = 15 } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    let whereClause = { cod_consulta: CUPS_LACTANCIA };

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
      .json({ mensaje: "Error al obtener valoraciones", error: error.message });
  }
});

// Obtener valoración por ID
router.get("/:id", async (req, res) => {
  try {
    const v = await ValoracionFisioterapia.findByPk(req.params.id);
    if (!v) return res.status(404).json({ error: "No encontrada" });
    res.json(v);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar valoración de lactancia
router.put(
  "/:id",
  verificarBloqueo(ValoracionFisioterapia, "Valoración Lactancia"),
  bloquearBase64,
  async (req, res) => {
    try {
      const { generarHash } = require("../utils/auditUtils");
      const actual = await ValoracionFisioterapia.findByPk(req.params.id);
      if (!actual) return res.status(404).json({ error: "No encontrada" });

      const updateData = { ...req.body };

      // Actualizar módulo de lactancia con datos del body legacy
      if (req.body.experienciaLactancia !== undefined) {
        updateData.modulo_lactancia = {
          ...actual.modulo_lactancia,
          experiencia_lactancia: req.body.experienciaLactancia,
          forma_pezon: req.body.formaPezon,
          pechos_dolorosos: req.body.pechosDolorosos,
        };
      }

      // Sello de integridad si se bloquea
      if (req.body.bloqueada && !actual.bloqueada) {
        updateData.fecha_bloqueo = new Date();
        updateData.sello_integridad = generarHash({
          contenido: req.body,
          fechaBloqueo: updateData.fecha_bloqueo,
        });
      }

      await actual.update(updateData);
      res.json({
        mensaje: "Actualizada correctamente",
        valoracion: actual.toJSON(),
      });
    } catch (error) {
      res
        .status(500)
        .json({ mensaje: "Error al actualizar", error: error.message });
    }
  },
);

// Eliminar valoración de lactancia
router.delete(
  "/:id",
  verificarBloqueo(ValoracionFisioterapia, "Valoración Lactancia"),
  async (req, res) => {
    try {
      const v = await ValoracionFisioterapia.findByPk(req.params.id);
      if (!v) return res.status(404).json({ error: "No encontrada" });
      await v.destroy();
      res.json({ mensaje: "Eliminada correctamente" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

module.exports = router;
