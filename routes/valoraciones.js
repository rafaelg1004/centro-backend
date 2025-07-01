const express = require('express');
const router = express.Router();
const ValoracionIngreso = require('../models/ValoracionIngreso');

// Crear valoración
router.post('/', async (req, res) => {
  try {
    const nuevaValoracion = new ValoracionIngreso(req.body);
    await nuevaValoracion.save();
    res.status(201).json({ mensaje: 'Valoración guardada correctamente' });
  } catch (error) {
    console.error('Error al guardar valoración:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error });
  }
});

// Obtener todas las valoraciones (con filtros opcionales)
router.get('/', async (req, res) => {
  try {
    const valoraciones = await ValoracionIngreso.find({ /* tus filtros */ }).populate('paciente');
    res.json(valoraciones);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error });
  }
});

// Obtener una valoración por ID
router.get('/:id', async (req, res) => {
  try {
    const valoracion = await ValoracionIngreso.findById(req.params.id).populate('paciente');
    res.json(valoracion);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoración', error });
  }
});

// Eliminar una valoración
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await ValoracionIngreso.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ mensaje: "Valoración no encontrada" });
    }
    res.json({ mensaje: "Valoración eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar una valoración por ID
router.put('/:id', async (req, res) => {
  try {
    const actualizada = await ValoracionIngreso.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!actualizada) {
      return res.status(404).json({ mensaje: 'Valoración no encontrada' });
    }
    res.json({ mensaje: 'Valoración actualizada correctamente', valoracion: actualizada });
  } catch (error) {
    console.error('Error al actualizar valoración:', error);
    res.status(500).json({ mensaje: 'Error al actualizar valoración', error });
  }
});

module.exports = router;
