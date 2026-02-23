/**
 * RUTA LEGACY: /api/sesiones-perinatal
 * 
 * Proxy de compatibilidad hacia el modelo unificado `EvolucionSesion`.
 */
const express = require("express");
const router = express.Router();
const EvolucionSesion = require("../models/EvolucionSesion");
const ValoracionFisioterapia = require("../models/ValoracionFisioterapia");

const CUPS_PERINATAL = '890204';

// Obtener todas las sesiones de un paciente
router.get("/paciente/:id", async (req, res) => {
  try {
    const sesiones = await EvolucionSesion.find({ paciente: req.params.id })
      .sort({ createdAt: 1 });
    res.json(sesiones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nueva sesión perinatal
router.post("/", async (req, res) => {
  try {
    const { paciente, nombreSesion, fecha, firmaPaciente, valoracionAsociada } = req.body;

    if (!paciente) return res.status(400).json({ error: "El paciente es obligatorio" });

    // Si no se envía valoración asociada, buscar la más reciente del paciente
    let vId = valoracionAsociada;
    if (!vId) {
      const valAsoc = await ValoracionFisioterapia.findOne({ paciente }).sort({ createdAt: -1 });
      vId = valAsoc?._id;
    }

    if (!vId) {
      return res.status(400).json({ error: "No se encontró valoración asociada para el paciente" });
    }

    const totalSesiones = await EvolucionSesion.countDocuments({ paciente, codProcedimiento: CUPS_PERINATAL });

    const nuevaSesion = new EvolucionSesion({
      valoracionAsociada: vId,
      paciente,
      fechaInicioAtencion: fecha ? new Date(fecha) : new Date(),
      codProcedimiento: CUPS_PERINATAL,
      finalidadTecnologiaSalud: '44',
      codDiagnosticoPrincipal: 'Z348',
      numeroSesion: totalSesiones + 1,
      descripcionEvolucion: nombreSesion || `Sesión perinatal ${totalSesiones + 1}`,
      firmas: {
        paciente: {
          firmaUrl: firmaPaciente,
          timestamp: new Date()
        }
      }
    });

    const guardada = await nuevaSesion.save();
    res.status(201).json(guardada);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar una sesión
router.put("/:id", async (req, res) => {
  try {
    const { generarHash, obtenerMetadatosPista } = require('../utils/auditUtils');
    const sesionActual = await EvolucionSesion.findById(req.params.id);
    if (!sesionActual) return res.status(404).json({ error: "Sesión no encontrada" });
    if (sesionActual.bloqueada) return res.status(403).json({ error: "Sesión bloqueada" });

    const updateData = { ...req.body };

    // Detectar nueva firma del paciente
    if (req.body.firmaPaciente && req.body.firmaPaciente !== sesionActual.firmas?.paciente?.firmaUrl) {
      updateData['firmas.paciente.firmaUrl'] = req.body.firmaPaciente;
      updateData['firmas.paciente.timestamp'] = new Date();
      updateData['firmas.paciente.ip'] = req.ip;
    }

    // Sello de integridad
    if (req.body.bloqueada && !sesionActual.bloqueada) {
      updateData.fechaBloqueo = new Date();
      updateData.selloIntegridad = generarHash({
        contenido: req.body,
        fechaBloqueo: updateData.fechaBloqueo
      });
    }

    const sesion = await EvolucionSesion.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(sesion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar sesión
router.delete("/:id", async (req, res) => {
  try {
    const sesion = await EvolucionSesion.findById(req.params.id);
    if (!sesion) return res.status(404).json({ error: "No encontrada" });
    if (sesion.bloqueada) return res.status(403).json({ error: "Sesión bloqueada, no se puede eliminar" });

    await EvolucionSesion.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Sesión eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;