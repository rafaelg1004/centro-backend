const express = require("express");
const Paciente = require("../models/Paciente");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    console.log("Datos recibidos en el backend:", req.body); // <-- AQUÍ
    const existe = await Paciente.findOne({ registroCivil: req.body.registroCivil });
    if (existe) {
      return res.status(400).json({ error: "El paciente ya existe" });
    }
     const paciente = new Paciente(req.body);
    await paciente.save();
    res.json({ mensaje: "Paciente registrado correctamente" });
  } catch (error) {
    console.error("Error al registrar paciente:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});
router.get("/", async (req, res) => {
  try {
    const pacientes = await Paciente.find().sort({ nombres: 1 });
    res.json(pacientes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener pacientes" });
  }
});

router.get("/buscar", async (req, res) => {
  const { q } = req.query; // Usamos "q" como parámetro de búsqueda general
  try {
    if (!q || q.trim() === "") {
      return res.json([]);
    }
    const pacientes = await Paciente.find({
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { registroCivil: { $regex: q, $options: "i" } },
        { cedula: { $regex: q, $options: "i" } }
      ]
    }).sort({ nombres: 1 }).limit(20);
    res.json(pacientes);
  } catch (e) {
    console.error("Error en /buscar:", e);
    res.json([]);
  }
});

router.get("/recientes", async (req, res) => {
  try {
    const pacientes = await Paciente.find().sort({ _id: -1 }).limit(10);
    res.json(pacientes);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener pacientes recientes" });
  }
});

// ¡AHORA la ruta con parámetro va al final!
router.get("/:id", async (req, res) => {
  try {
    const paciente = await Paciente.findById(req.params.id);
    if (!paciente) return res.status(404).json({ error: "No encontrado" });
    res.json(paciente);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener paciente" });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    await Paciente.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Paciente eliminado correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar paciente por ID
router.put('/:id', async (req, res) => {
  try {
    const actualizado = await Paciente.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!actualizado) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }
    res.json({ mensaje: 'Paciente actualizado correctamente', paciente: actualizado });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar paciente', error });
  }
});

module.exports = router;