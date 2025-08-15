const express = require('express');
const router = express.Router();
const Valoracion = require('../models/ValoracionIngresoAdultosLactancia');
const { eliminarImagenesValoracion } = require('../utils/s3Utils');

// Middleware para bloquear imágenes base64
const bloquearImagenesBase64 = (req, res, next) => {
  console.log('Verificando que no se envíen imágenes base64 a la base de datos...');
  
  const data = req.body;
  const camposImagen = [
    'firmaPaciente', 
    'firmaAutorizacion',
    'firmaPacienteSesion1',
    'firmaPacienteSesion2',
    'firmaFisioterapeutaPlanIntervencion',
    'firmaFisioterapeutaPrenatal',
    'firmaPacientePrenatalFinal',
    'firmaConsentimientoLactancia',
    'firmaProfesionalConsentimientoLactancia'
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

// Crear nueva valoración
router.post('/', bloquearImagenesBase64, async (req, res) => {
  try {
    const nuevaValoracion = new Valoracion(req.body);
    const valoracionGuardada = await nuevaValoracion.save();
    res.status(201).json(valoracionGuardada);
  } catch (error) {
    console.error('Error al guardar valoración:', error); // <--- Aquí verás el error real
    res.status(500).json({ mensaje: 'Error al guardar valoración', error });
  }
});

// Obtener todas las valoraciones (con filtros opcionales)
router.get('/', async (req, res) => {
  try {
    const { busqueda, fechaInicio, fechaFin } = req.query;
    let query = {};

    // Filtro de búsqueda por nombre o cédula
    if (busqueda) {
      query.$or = [
        { 'nombres': { $regex: busqueda, $options: 'i' } },
        { 'cedula': { $regex: busqueda, $options: 'i' } }
      ];
    }

    // Filtros de fecha
    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) query.fecha.$gte = fechaInicio;
      if (fechaFin) query.fecha.$lte = fechaFin;
    }

    const valoraciones = await Valoracion.find(query);
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
router.put('/:id', bloquearImagenesBase64, async (req, res) => {
  try {
    // Obtener la valoración actual para comparar imágenes
    const valoracionActual = await Valoracion.findById(req.params.id);
    if (!valoracionActual) {
      return res.status(404).json({ mensaje: 'Valoración no encontrada' });
    }

    console.log(`Actualizando valoración adultos lactancia ${req.params.id}...`);

    // Lista de campos que pueden contener imágenes
    const camposImagen = [
      'firmaPacientePrenatal',
      'firmaPaciente', 
      'firmaFisioterapeuta',
      'firmaAutorizacion',
      'firmaPacienteSesion1',
      'firmaPacienteSesion2',
      'firmaFisioterapeutaPlanIntervencion',
      'firmaFisioterapeutaPrenatal',
      'firmaPacientePrenatalFinal',
      'firmaConsentimientoLactancia',
      'firmaProfesionalConsentimientoLactancia'
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
      { new: true }
    );

    console.log(`✓ Valoración actualizada. Imágenes anteriores eliminadas: ${imagenesEliminadas}`);
    
    res.json({ 
      mensaje: 'Valoración actualizada exitosamente',
      valoracion: valoracionActualizada,
      imagenesAnterioresEliminadas: imagenesEliminadas
    });
  } catch (error) {
    console.error('Error al actualizar valoración:', error);
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

    // Lista de campos que pueden contener imágenes en valoraciones de lactancia
    const camposImagen = [
      'firmaPaciente', 
      'firmaAutorizacion',
      'firmaPacienteSesion1',
      'firmaPacienteSesion2',
      'firmaFisioterapeutaPlanIntervencion',
      'firmaFisioterapeutaPrenatal',
      'firmaPacientePrenatalFinal',
      'firmaConsentimientoLactancia',
      'firmaProfesionalConsentimientoLactancia'
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