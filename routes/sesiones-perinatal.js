/**
 * RUTA LEGACY: /api/sesiones-perinatal
 *
 * Proxy de compatibilidad hacia el modelo unificado `EvolucionSesion`.
 */
const express = require("express");
const router = express.Router();
const {
  EvolucionSesion,
  ValoracionFisioterapia,
} = require("../models-sequelize");
const { Op } = require("sequelize");

const CUPS_PERINATAL = "890204";

// Obtener todas las sesiones de un paciente
router.get("/paciente/:id", async (req, res) => {
  try {
    const sesiones = await EvolucionSesion.findAll({
      where: { paciente_id: req.params.id },
      order: [["created_at", "ASC"]],
    });
    res.json(sesiones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nueva sesión perinatal
router.post("/", async (req, res) => {
  try {
    const { paciente, nombreSesion, fecha, firmaPaciente, valoracionAsociada } =
      req.body;

    if (!paciente)
      return res.status(400).json({ error: "El paciente es obligatorio" });

    // Si no se envía valoración asociada, buscar la más reciente del paciente
    let vId = valoracionAsociada;
    if (!vId) {
      const valAsoc = await ValoracionFisioterapia.findOne({
        where: { paciente_id: paciente },
        order: [["created_at", "DESC"]],
      });
      vId = valAsoc?.id;
    }

    if (!vId) {
      return res
        .status(400)
        .json({ error: "No se encontró valoración asociada para el paciente" });
    }

    const totalSesiones = await EvolucionSesion.count({
      where: { paciente_id: paciente, cod_procedimiento: CUPS_PERINATAL },
    });

    const guardada = await EvolucionSesion.create({
      valoracion_asociada_id: vId,
      paciente_id: paciente,
      fecha_inicio_atencion: fecha ? new Date(fecha) : new Date(),
      cod_procedimiento: CUPS_PERINATAL,
      finalidad_tecnologia_salud: "44",
      cod_diagnostico_principal: "Z348",
      numero_sesion: totalSesiones + 1,
      descripcion_evolucion:
        nombreSesion || `Sesión perinatal ${totalSesiones + 1}`,
      firmas: {
        paciente: {
          firmaUrl: firmaPaciente,
          timestamp: new Date(),
        },
      },
    });

    res.status(201).json(guardada);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar una sesión
router.put("/:id", async (req, res) => {
  try {
    const { generarHash } = require("../utils/auditUtils");
    const sesionActual = await EvolucionSesion.findByPk(req.params.id);
    if (!sesionActual)
      return res.status(404).json({ error: "Sesión no encontrada" });
    if (sesionActual.bloqueada)
      return res.status(403).json({ error: "Sesión bloqueada" });

    const updateData = { ...req.body };

    // Detectar nueva firma del paciente o eliminación
    const firmas = sesionActual.firmas || {};
    if (
      req.body.firmaPaciente !== undefined &&
      req.body.firmaPaciente !== firmas.paciente?.firmaUrl
    ) {
      firmas.paciente = {
        firmaUrl: req.body.firmaPaciente,
        timestamp: req.body.firmaPaciente ? new Date() : null,
        ip: req.body.firmaPaciente ? req.ip : null,
      };
      updateData.firmas = firmas;
    }

    // Sello de integridad
    if (req.body.bloqueada && !sesionActual.bloqueada) {
      updateData.fecha_bloqueo = new Date();
      updateData.sello_integridad = generarHash({
        contenido: req.body,
        fechaBloqueo: updateData.fecha_bloqueo,
      });
    }

    await sesionActual.update(updateData);
    res.json(sesionActual.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar sesión
router.delete("/:id", async (req, res) => {
  try {
    const sesion = await EvolucionSesion.findByPk(req.params.id);
    if (!sesion) return res.status(404).json({ error: "No encontrada" });
    if (sesion.bloqueada)
      return res
        .status(403)
        .json({ error: "Sesión bloqueada, no se puede eliminar" });

    await sesion.destroy();
    res.json({ mensaje: "Sesión eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
