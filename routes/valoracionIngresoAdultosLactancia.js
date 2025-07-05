const express = require('express');
const router = express.Router();
const Valoracion = require('../models/ValoracionIngresoAdultosLactancia');
const { eliminarImagenesValoracion } = require('../utils/s3Utils');

// Crear nueva valoración
router.post('/', async (req, res) => {
  try {
    const nuevaValoracion = new Valoracion(req.body);
    await nuevaValoracion.save();
    res.status(201).json({ mensaje: 'Valoración guardada exitosamente' });
  } catch (error) {
    console.error('Error al guardar valoración:', error); // <--- Aquí verás el error real
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
  const { q } = req.query; // Usamos "q" como parámetro de búsqueda general
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
    await Valoracion.findByIdAndUpdate(req.params.id, req.body);
    res.json({ mensaje: 'Valoración actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar valoración', error });
  }
});
// Eliminar una valoración por ID
router.delete('/:id', async (req, res) => {
  try {
    // Primero obtener la valoración para acceder a las imágenes
    const valoracion = await Valoracion.findById(req.params.id);
    if (!valoracion) {
      return res.status(404).json({ mensaje: "Valoración no encontrada" });
    }

    console.log(`Eliminando valoración adultos lactancia ${req.params.id} y sus imágenes asociadas...`);

    // Lista de campos que pueden contener imágenes (ajustar según el modelo)
    const camposImagen = [
      'firmaFisioterapeuta', 'firmaAutorizacion', 'firmaConsentimiento'
      // Agregar otros campos de imagen según tu modelo
    ];

    // Eliminar todas las imágenes de S3
    const resultadosEliminacion = await eliminarImagenesValoracion(valoracion, camposImagen);

    // Eliminar la valoración de la base de datos
    await Valoracion.findByIdAndDelete(req.params.id);
    
    res.json({ 
      mensaje: 'Valoración eliminada exitosamente',
      imagenesEliminadas: resultadosEliminacion.filter(r => r.resultado.success).length,
      totalImagenes: resultadosEliminacion.length
    });
  } catch (error) {
    console.error('Error al eliminar valoración adultos lactancia:', error);
    res.status(500).json({ mensaje: 'Error al eliminar valoración', error });
  }
});
module.exports = router;