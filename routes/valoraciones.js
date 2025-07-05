const express = require('express');
const router = express.Router();
const ValoracionIngreso = require('../models/ValoracionIngreso');
const { eliminarImagenesValoracion } = require('../utils/s3Utils');

// Middleware para validar que no se guarden imágenes base64
const validarImagenes = (req, res, next) => {
  const data = req.body;
  const camposImagen = [
    'firmaProfesional', 'firmaRepresentante', 'firmaAcudiente', 'firmaFisioterapeuta', 
    'firmaAutorizacion', 'consentimiento_firmaAcudiente', 'consentimiento_firmaFisio'
  ];
  
  console.log('Validando imágenes en los datos recibidos...');
  
  for (const campo of camposImagen) {
    if (data[campo] && data[campo].toString().startsWith('data:image')) {
      console.error(`Error: Se está intentando guardar imagen base64 en el campo ${campo}`);
      console.error(`Contenido del campo (primeros 50 caracteres): ${data[campo].substring(0, 50)}...`);
      return res.status(400).json({ 
        error: `El campo ${campo} contiene datos base64. Las imágenes deben subirse a S3 primero.` 
      });
    } else if (data[campo]) {
      console.log(`Campo ${campo} válido: ${data[campo].substring(0, 50)}...`);
    }
  }
  
  console.log('Todas las imágenes son válidas (URLs de S3)');
  next();
};

// Crear valoración
router.post('/', validarImagenes, async (req, res) => {
  try {
    const nuevaValoracion = new ValoracionIngreso(req.body);
    const valoracionGuardada = await nuevaValoracion.save();
    res.status(201).json(valoracionGuardada);
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
    // Primero obtener la valoración para acceder a las imágenes
    const valoracion = await ValoracionIngreso.findById(req.params.id);
    if (!valoracion) {
      return res.status(404).json({ mensaje: "Valoración no encontrada" });
    }

    console.log(`Eliminando valoración ${req.params.id} y sus imágenes asociadas...`);

    // Lista de campos que pueden contener imágenes
    const camposImagen = [
      'firmaProfesional', 'firmaRepresentante', 'firmaAcudiente', 
      'firmaFisioterapeuta', 'firmaAutorizacion', 'consentimiento_firmaAcudiente', 
      'consentimiento_firmaFisio'
    ];

    // Eliminar todas las imágenes de S3
    const resultadosEliminacion = await eliminarImagenesValoracion(valoracion, camposImagen);

    // Eliminar la valoración de la base de datos
    const deleted = await ValoracionIngreso.findByIdAndDelete(req.params.id);
    
    res.json({ 
      mensaje: "Valoración eliminada correctamente",
      imagenesEliminadas: resultadosEliminacion.filter(r => r.resultado.success).length,
      totalImagenes: resultadosEliminacion.length
    });
  } catch (e) {
    console.error('Error al eliminar valoración:', e);
    res.status(500).json({ error: e.message });
  }
});

// Actualizar una valoración por ID
router.put('/:id', validarImagenes, async (req, res) => {
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
