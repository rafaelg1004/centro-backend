const express = require("express");
const router = express.Router();
const SesionPerinatalPaciente = require("../models/SesionPerinatalPaciente");

// Obtener todas las sesiones de un paciente
router.get("/paciente/:id", async (req, res) => {
  try {
    const sesiones = await SesionPerinatalPaciente.find({ paciente: req.params.id });
    res.json(sesiones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar una sesión por su id
router.put("/:id", async (req, res) => {
  try {
    const sesion = await SesionPerinatalPaciente.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(sesion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 