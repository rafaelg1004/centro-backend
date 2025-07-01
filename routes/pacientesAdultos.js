const express = require("express");
const PacienteAdulto = require("../models/PacienteAdulto");

const router = express.Router();

// Registrar paciente adulto
router.post("/", async (req, res) => {
  try {
    const existe = await PacienteAdulto.findOne({ cedula: req.body.cedula });
    if (existe) {
      return res.status(400).json({ error: "El paciente adulto ya existe" });
    }
    const paciente = new PacienteAdulto(req.body);
    await paciente.save();
    res.json({ mensaje: "Paciente adulto registrado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar paciente adulto" });
  }
});

// Obtener todos los pacientes adultos
router.get("/", async (req, res) => {
  try {
    const pacientes = await PacienteAdulto.find();
    res.json(pacientes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener pacientes adultos" });
  }
});

// Buscar pacientes adultos por nombre o cédula
router.get("/buscar", async (req, res) => {
  try {
    const q = req.query.q || "";
    console.log("Buscando adultos con:", q);
    const pacientes = await PacienteAdulto.find({
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { cedula: { $regex: q, $options: "i" } }
      ]
    });
    res.json(pacientes);
  } catch (error) {
    console.error("Error en /buscar adultos:", error);
    res.status(500).json({ error: "Error al buscar pacientes adultos" });
  }
});

// Obtener paciente adulto por ID
router.get("/:id", async (req, res) => {
  try {
    const paciente = await PacienteAdulto.findById(req.params.id);
    if (!paciente) return res.status(404).json({ error: "No encontrado" });
    res.json(paciente);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener paciente adulto" });
  }
});

// Actualizar paciente adulto por ID
router.put("/:id", async (req, res) => {
  try {
    const actualizado = await PacienteAdulto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!actualizado) {
      return res.status(404).json({ mensaje: "Paciente adulto no encontrado" });
    }
    res.json({ mensaje: "Paciente adulto actualizado correctamente", paciente: actualizado });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar paciente adulto", error });
  }
});

// Eliminar paciente adulto por ID
router.delete("/:id", async (req, res) => {
  try {
    await PacienteAdulto.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Paciente adulto eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;