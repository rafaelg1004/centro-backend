const express = require("express");
const router = express.Router();
const ConsentimientoPerinatal = require("../models/ConsentimientoPerinatal");
const { eliminarImagenesConsentimientoPerinatal } = require('../utils/s3Utils');

// Middleware para bloquear imágenes base64
const bloquearImagenesBase64 = (req, res, next) => {
  console.log('Verificando que no se envíen imágenes base64 a la base de datos...');
  
  const data = req.body;
  const camposImagen = [
    'firmaPaciente',
    'firmaFisioterapeuta',
    'firmaAutorizacion',
    'firmaPacienteConsentimiento',
    'firmaFisioterapeutaConsentimiento',
    'firmaPacienteGeneral',
    'firmaFisioterapeutaGeneral',
    'firmaPacienteGeneralIntensivo',
    'firmaFisioterapeutaGeneralIntensivo',
    // Firmas dinámicas de sesiones (Paso 7)
    'firmaPacienteSesion1',
    'firmaPacienteSesion2',
    'firmaPacienteSesion3',
    'firmaPacienteSesion4',
    'firmaPacienteSesion5',
    // Firmas dinámicas de sesiones intensivo (Paso 8)
    'firmaPacienteSesionIntensivo1',
    'firmaPacienteSesionIntensivo2',
    'firmaPacienteSesionIntensivo3'
  ];
  
  for (const campo of camposImagen) {
    if (data[campo] && typeof data[campo] === 'string' && data[campo].startsWith('data:image')) {
      console.error(`❌ Intento de guardar imagen base64 en campo ${campo}`);
      return res.status(400).json({
        error: 'No se permiten imágenes base64 en la base de datos',
        mensaje: `El campo ${campo} contiene una imagen base64. Debe convertirse a URL de S3 antes de guardar.`
      });
    }
  }
  
  console.log('✓ Verificación de imágenes base64 completada');
  next();
};

// ...existing code...

// ...existing code...

// Crear un nuevo consentimiento perinatal
router.post("/", bloquearImagenesBase64, async (req, res) => {
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
router.put("/:id", bloquearImagenesBase64, async (req, res) => {
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
    // Primero obtener el consentimiento para acceder a las imágenes
    const consentimiento = await ConsentimientoPerinatal.findById(req.params.id);
    if (!consentimiento) {
      return res.status(404).json({ error: "Consentimiento no encontrado" });
    }

    console.log(`Eliminando consentimiento perinatal ${req.params.id} y sus imágenes asociadas...`);

    // Lista de campos que pueden contener imágenes en consentimientos perinatales
    const camposImagen = [
      'firmaPaciente',
      'firmaFisioterapeuta',
      'firmaAutorizacion',
      'firmaPacienteConsentimiento',
      'firmaFisioterapeutaConsentimiento',
      'firmaPacienteGeneral',
      'firmaFisioterapeutaGeneral',
      'firmaPacienteGeneralIntensivo',
      'firmaFisioterapeutaGeneralIntensivo',
      // Firmas dinámicas de sesiones (Paso 7)
      'firmaPacienteSesion1',
      'firmaPacienteSesion2',
      'firmaPacienteSesion3',
      'firmaPacienteSesion4',
      'firmaPacienteSesion5',
      // Firmas dinámicas de sesiones intensivo (Paso 8)
      'firmaPacienteSesionIntensivo1',
      'firmaPacienteSesionIntensivo2',
      'firmaPacienteSesionIntensivo3'
    ];

    // Eliminar todas las imágenes de S3 (incluyendo arrays de sesiones)
    const resultadosEliminacion = await eliminarImagenesConsentimientoPerinatal(consentimiento, camposImagen);

    // Eliminar el consentimiento de la base de datos
    await ConsentimientoPerinatal.findByIdAndDelete(req.params.id);
    
    res.json({ 
      mensaje: 'Consentimiento eliminado exitosamente',
      imagenesEliminadas: resultadosEliminacion.filter(r => r.resultado.success).length,
      totalImagenes: resultadosEliminacion.length
    });
  } catch (error) {
    console.error('Error al eliminar consentimiento perinatal:', error);
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;