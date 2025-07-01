const express = require('express');
const router = express.Router();
const Valoracion = require('../models/ValoracionPisoPelvico');

// Crear nueva valoración
router.post('/', async (req, res) => {
  try {
    const nuevaValoracion = new Valoracion(req.body);
    await nuevaValoracion.save();
    res.status(201).json({ mensaje: 'Valoración guardada exitosamente' });
  } catch (error) {
    console.error('Error al guardar valoración:', error);
    res.status(500).json({ mensaje: 'Error al guardar valoración', error });
  }
});

// Obtener todas las valoraciones
router.get('/', async (req, res) => {
  try {
    const valoraciones = await Valoracion.find();
    res.json(valoraciones);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error });
  }
});

// Búsqueda general por nombre o cédula
router.get('/buscar', async (req, res) => {
  const { q } = req.query;
  try {
    if (!q || q.trim() === "") {
      return res.json([]);
    }
    const valoraciones = await Valoracion.find({
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { cedula: { $regex: q, $options: "i" } }
      ]
    }).limit(20);
    res.json(valoraciones);
  } catch (e) {
    console.error("Error en /buscar:", e);
    res.json([]);
  }
});

// Obtener una valoración por ID
router.get('/:id', async (req, res) => {
  try {
    const valoracion = await Valoracion.findById(req.params.id);
    res.json(valoracion);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoración', error });
  }
});

// Actualizar una valoración por ID
router.put('/:id', async (req, res) => {
  try {
    // Si paciente es un objeto, extrae solo el _id
    if (req.body.paciente && typeof req.body.paciente === "object" && req.body.paciente._id) {
      req.body.paciente = req.body.paciente._id;
    }
    // Si paciente es string, valida que sea un ObjectId válido
    if (req.body.paciente && typeof req.body.paciente === "string" && !req.body.paciente.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ mensaje: 'El campo paciente debe ser un ObjectId válido' });
    }

    await Valoracion.findByIdAndUpdate(req.params.id, req.body, { runValidators: true, new: true });
    res.json({ mensaje: 'Valoración actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar valoración:', error); // <-- Esto muestra el error en consola
    res.status(500).json({ 
      mensaje: 'Error al actualizar valoración', 
      error: error.message, // Muestra el mensaje de error
      stack: error.stack    // Opcional: muestra el stacktrace para depuración
    });
  }
});

// Eliminar una valoración por ID
router.delete('/:id', async (req, res) => {
  try {
    await Valoracion.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Valoración eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar valoración', error });
  }
});

module.exports = router;