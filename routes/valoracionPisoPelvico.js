/**
 * RUTA LEGACY: /api/valoraciones-piso-pelvico
 *
 * Proxy de compatibilidad hacia el modelo unificado `ValoracionFisioterapia`.
 * El frontend que usa esta ruta seguirá funcionando sin cambios.
 * Internamente, todos los datos se guardan con el módulo `moduloPisoPelvico` activado.
 */
const express = require("express");
const router = express.Router();
const { ValoracionFisioterapia, Paciente } = require("../models-sequelize");
const { Op } = require("sequelize");
const { eliminarImagenesValoracion } = require("../utils/s3Utils");
const { verificarBloqueo } = require("../utils/hcMiddleware");

const CUPS_PISO_PELVICO = "890202"; // Código CUPS para valoración de piso pélvico

const bloquearBase64 = (req, res, next) => {
  const camposImagen = [
    "firmaPaciente",
    "firmaFisioterapeuta",
    "firmaAutorizacion",
    "consentimientoFirma",
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

// Crear valoración de piso pélvico
router.post("/", bloquearBase64, async (req, res) => {
  try {
    if (!req.body.paciente) {
      return res
        .status(400)
        .json({ error: "El campo paciente es obligatorio" });
    }

    // Verificar duplicado
    const existe = await ValoracionFisioterapia.findOne({
      where: {
        paciente_id: req.body.paciente,
        cod_consulta: CUPS_PISO_PELVICO,
      },
    });

    if (existe) {
      return res.status(409).json({
        error: "VALORACION_DUPLICADA",
        mensaje: "Este paciente ya tiene una valoración de piso pélvico.",
        valoracionExistente: {
          id: existe.id,
          fecha: existe.fecha_inicio_atencion,
        },
      });
    }

    // Mapear campos del formulario legacy al nuevo modelo unificado
    const nuevaValoracion = await ValoracionFisioterapia.create({
      paciente_id: req.body.paciente,
      fecha_inicio_atencion: req.body.fecha
        ? new Date(req.body.fecha)
        : new Date(),
      cod_consulta: CUPS_PISO_PELVICO,
      finalidad_tecnologia_salud: "44",
      causa_motivo_atencion: "21",
      cod_diagnostico_principal: req.body.codDiagnosticoPrincipal || "N393",
      motivo_consulta: req.body.motivoConsulta || "Evaluación de piso pélvico",
      signos_vitales: {
        ta: req.body.ta,
        fr: req.body.fr,
        fc: req.body.fc,
        temperatura: req.body.temperatura,
        peso_previo: req.body.pesoPrevio,
        peso_actual: req.body.pesoActual,
        talla: req.body.talla,
        imc: req.body.imc,
      },
      antecedentes: {
        quirurgicos: req.body.observacionesQx,
        farmacologicos: req.body.infoMedicacion,
        alergias: req.body.alergias,
        familiares: req.body.familiares,
        gineco_obstetricos: {
          embarazo_alto_riesgo: req.body.embarazoAltoRiesgo,
        },
      },
      modulo_piso_pelvico: {
        icicq_frecuencia: req.body.icicq_frecuencia,
        icicq_cantidad: req.body.icicq_cantidad,
        icicq_impacto: req.body.icicq_impacto,
        habitos: {
          tipo_dieta: req.body.tipoDieta,
          ingesta_liquida: req.body.ingestaLiquida,
          horario_sueno: req.body.horarioSueno,
        },
        evaluacion_fisica: {
          dolor_perineal: req.body.dolorPerineal,
          diafragma_toracico: req.body.diafragmaToracico,
          cupula_derecha: req.body.cupulaDerecha,
          cupula_izquierda: req.body.cupulaIzquierda,
          oxford_global: req.body.oxfordGlobal,
          perfect_power: req.body.perfectPower,
        },
        evaluacion_muscular: {
          prolapso_grado:
            req.body["prolapso_VESICOCELE_grado"] || req.body.prolapso_grado,
          endo_presente: req.body.endo_presente,
        },
      },
      examen_fisico: {
        postura: req.body.postura,
        marcha: req.body.marcha,
        tono_muscular: req.body.tonoGeneral,
      },
      diagnostico_fisioterapeutico:
        req.body.diagnosticoFisio || "Disfunción de piso pélvico",
      plan_tratamiento:
        req.body.planIntervencion || "Plan de rehabilitación perineal",
      // Guardar todos los campos del formulario complejo en datos legacy para no perder nada
      _datos_legacy: req.body,
      bloqueada: req.body.bloqueada || false,
      audit_trail: req.body.auditTrail || {},
    });

    res.status(201).json(nuevaValoracion);
  } catch (error) {
    console.error("Error al crear valoración piso pélvico:", error);
    res
      .status(500)
      .json({ mensaje: "Error en el servidor", error: error.message });
  }
});

// Obtener todas las valoraciones de piso pélvico
router.get("/", async (req, res) => {
  try {
    const { busqueda, pagina = 1, limite = 15 } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    let whereClause = { cod_consulta: CUPS_PISO_PELVICO };

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
      offset: skip,
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

// Actualizar valoración de piso pélvico
router.put(
  "/:id",
  verificarBloqueo(ValoracionFisioterapia, "Valoración Piso Pélvico"),
  bloquearBase64,
  async (req, res) => {
    try {
      const { generarHash } = require("../utils/auditUtils");
      const actual = await ValoracionFisioterapia.findByPk(req.params.id);
      if (!actual) return res.status(404).json({ error: "No encontrada" });

      const updateData = { ...req.body };

      // Sincronizar módulo específico con campos planos del legacy
      if (req.body.oxfordGlobal !== undefined) {
        updateData["modulo_piso_pelvico.evaluacion_fisica.oxford_global"] =
          req.body.oxfordGlobal;
      }
      if (req.body.icicq_frecuencia !== undefined) {
        updateData["modulo_piso_pelvico.icicq_frecuencia"] =
          req.body.icicq_frecuencia;
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

// Eliminar valoración de piso pélvico
router.delete(
  "/:id",
  verificarBloqueo(ValoracionFisioterapia, "Valoración Piso Pélvico"),
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
