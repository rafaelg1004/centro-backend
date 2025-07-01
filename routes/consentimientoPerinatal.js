const express = require("express");
const router = express.Router();
const ConsentimientoPerinatal = require("../models/ConsentimientoPerinatal");

// Crear un nuevo consentimiento perinatal
router.post("/", async (req, res) => {
  try {
    console.log("Datos recibidos en el backend:", req.body); // <-- Ya lo tienes
    const nuevoConsentimiento = new ConsentimientoPerinatal(req.body);
    await nuevoConsentimiento.save();
    res.status(201).json(nuevoConsentimiento);
  } catch (error) {
    console.error("Error al guardar consentimiento:", error); // <-- Agrega esto
    res.status(400).json({ error: error.message, detalle: error }); // <-- Devuelve el error completo
  }
});

// Obtener todos los consentimientos perinatales
router.get("/", async (req, res) => {
  try {
    const consentimientos = await ConsentimientoPerinatal.find().populate("paciente");
    res.json(consentimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Buscar consentimiento por nombre o documento del paciente adulto
router.get("/buscar", async (req, res) => {
  const q = req.query.q || "";
  try {
    // Buscar en el modelo PacienteAdulto por nombre o cedula
    const PacienteAdulto = require("../models/PacienteAdulto");
    const pacientes = await PacienteAdulto.find({
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { cedula: { $regex: q, $options: "i" } }
      ]
    });

    console.log("Consulta recibida:", q);
    console.log("Pacientes encontrados:", pacientes);

    if (!pacientes.length) {
      return res.json([]);
    }

    // Buscar consentimientos de esos pacientes
    const consentimientos = await ConsentimientoPerinatal.find({
      paciente: { $in: pacientes.map(p => p._id) }
    }).populate("paciente");

    console.log("Consentimientos encontrados:", consentimientos);

    res.json(consentimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener consentimiento por ID
router.get("/:id", async (req, res) => {
  try {
    const consentimiento = await ConsentimientoPerinatal.findById(req.params.id).populate("paciente");
    if (!consentimiento) return res.status(404).json({ error: "No encontrado" });
    res.json(consentimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener consentimiento por paciente adulto
router.get("/paciente/:pacienteId", async (req, res) => {
  try {
    const consentimiento = await ConsentimientoPerinatal.find({ paciente: req.params.pacienteId }).populate("paciente");
    res.json(consentimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar consentimiento por ID
router.put("/:id", async (req, res) => {
  try {
    const consentimientoActualizado = await ConsentimientoPerinatal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!consentimientoActualizado) return res.status(404).json({ error: "No encontrado" });
    res.json(consentimientoActualizado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar consentimiento por ID
router.delete("/:id", async (req, res) => {
  try {
    const consentimientoEliminado = await ConsentimientoPerinatal.findByIdAndDelete(req.params.id);
    if (!consentimientoEliminado) return res.status(404).json({ error: "No encontrado" });
    res.json({ mensaje: "Consentimiento eliminado" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;