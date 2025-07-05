const express = require('express');
const router = express.Router();
const Valoracion = require('../models/ValoracionPisoPelvico');
const { eliminarImagenesValoracion } = require('../utils/s3Utils');

// Middleware para bloquear imágenes base64
const bloquearImagenesBase64 = (req, res, next) => {
  console.log('Verificando que no se envíen imágenes base64 a la base de datos...');
  
  const data = req.body;
  const camposImagen = [
    'firmaPaciente', 'firmaFisioterapeuta', 'firmaAutorizacion', 'consentimientoFirma'
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

// Crear nueva valoración
router.post('/', bloquearImagenesBase64, async (req, res) => {
  try {
    const nuevaValoracion = new Valoracion(req.body);
    const valoracionGuardada = await nuevaValoracion.save();
    res.status(201).json(valoracionGuardada);
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
router.put('/:id', bloquearImagenesBase64, async (req, res) => {
  try {
    // Si paciente es un objeto, extrae solo el _id
    if (req.body.paciente && typeof req.body.paciente === "object" && req.body.paciente._id) {
      req.body.paciente = req.body.paciente._id;
    }
    // Si paciente es string, valida que sea un ObjectId válido
    if (req.body.paciente && typeof req.body.paciente === "string" && !req.body.paciente.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ mensaje: 'El campo paciente debe ser un ObjectId válido' });
    }

    // Obtener la valoración actual para comparar imágenes
    const valoracionActual = await Valoracion.findById(req.params.id);
    if (!valoracionActual) {
      return res.status(404).json({ mensaje: 'Valoración no encontrada' });
    }

    console.log(`Actualizando valoración piso pélvico ${req.params.id}...`);

    // Lista de campos que pueden contener imágenes
    const camposImagen = [
      'firmaPaciente',
      'firmaFisioterapeuta', 
      'firmaAutorizacion', 
      'consentimientoFirma'
    ];

    // Importar función de eliminación
    const { eliminarImagenDeS3 } = require('../utils/s3Utils');
    
    // Detectar imágenes que han cambiado y eliminar las anteriores
    let imagenesEliminadas = 0;
    for (const campo of camposImagen) {
      const imagenAnterior = valoracionActual[campo];
      const imagenNueva = req.body[campo];
      
      // Si había una imagen anterior y ahora es diferente (o se eliminó)
      if (imagenAnterior && 
          imagenAnterior.includes('amazonaws.com') && 
          imagenAnterior !== imagenNueva) {
        
        console.log(`Eliminando imagen anterior del campo ${campo}: ${imagenAnterior}`);
        const resultado = await eliminarImagenDeS3(imagenAnterior);
        if (resultado.success) {
          imagenesEliminadas++;
          console.log(`✓ Imagen anterior eliminada de ${campo}`);
        } else {
          console.error(`❌ Error eliminando imagen de ${campo}:`, resultado.error);
        }
      }
    }

    // Actualizar la valoración con los nuevos datos
    const valoracionActualizada = await Valoracion.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { runValidators: true, new: true }
    );

    console.log(`✓ Valoración piso pélvico actualizada. Imágenes anteriores eliminadas: ${imagenesEliminadas}`);
    
    res.json({ 
      mensaje: 'Valoración actualizada exitosamente',
      valoracion: valoracionActualizada,
      imagenesAnterioresEliminadas: imagenesEliminadas
    });
  } catch (error) {
    console.error('Error al actualizar valoración:', error);
    res.status(500).json({ 
      mensaje: 'Error al actualizar valoración', 
      error: error.message,
      stack: error.stack
    });
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

    console.log(`Eliminando valoración piso pélvico ${req.params.id} y sus imágenes asociadas...`);

    // Lista de campos que pueden contener imágenes (ajustar según el modelo)
    const camposImagen = [
      'firmaPaciente',
      'firmaFisioterapeuta', 
      'firmaAutorizacion', 
      'consentimientoFirma'
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
    console.error('Error al eliminar valoración piso pélvico:', error);
    res.status(500).json({ mensaje: 'Error al eliminar valoración', error });
  }
});

module.exports = router;