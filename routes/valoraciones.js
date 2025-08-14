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
    console.log('=== DEPURACIÓN DE DATOS RECIBIDOS ===');
    console.log('rutinaDiaria recibido:', typeof req.body.rutinaDiaria, req.body.rutinaDiaria);
    
    // Asegurar que todos los campos de texto sean strings
    const camposTexto = [
      'rutinaDiaria', 'motivoDeConsulta', 'descripcionSueno', 'motivoComida',
      'problemasSueno', 'duermeCon', 'patronSueno', 'pesadillas', 'siesta',
      'detalleProblemasComer', 'alimentosPreferidos', 'alimentosNoLeGustan',
      'permaneceCon', 'prefiereA', 'relacionHermanos', 'emociones', 'juegaCon',
      'juegosPreferidos', 'relacionDesconocidos'
    ];
    
    // Limpiar y validar cada campo
    camposTexto.forEach(campo => {
      if (req.body[campo] !== undefined) {
        if (Array.isArray(req.body[campo])) {
          console.log(`⚠️ Campo ${campo} es array, convirtiendo a string:`, req.body[campo]);
          req.body[campo] = req.body[campo].join(', ');
        } else if (typeof req.body[campo] === 'object' && req.body[campo] !== null) {
          console.log(`⚠️ Campo ${campo} es objeto, convirtiendo a string:`, req.body[campo]);
          req.body[campo] = JSON.stringify(req.body[campo]);
        } else if (typeof req.body[campo] !== 'string') {
          console.log(`⚠️ Campo ${campo} no es string, convirtiendo:`, typeof req.body[campo], req.body[campo]);
          req.body[campo] = String(req.body[campo]);
        }
        
        // Asegurar que strings vacíos queden como strings vacíos
        if (req.body[campo] === 'undefined' || req.body[campo] === 'null') {
          req.body[campo] = '';
        }
      }
    });
    
    console.log('rutinaDiaria después de limpieza:', typeof req.body.rutinaDiaria, req.body.rutinaDiaria);
    
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
    const { busqueda, fechaInicio, fechaFin } = req.query;
    let query = {};

    // Filtro de búsqueda por nombre o documento
    if (busqueda) {
      query.$or = [
        { 'nombres': { $regex: busqueda, $options: 'i' } },
        { 'registroCivil': { $regex: busqueda, $options: 'i' } },
        { 'paciente.nombres': { $regex: busqueda, $options: 'i' } },
        { 'paciente.registroCivil': { $regex: busqueda, $options: 'i' } }
      ];
    }

    // Filtros de fecha
    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) query.fecha.$gte = fechaInicio;
      if (fechaFin) query.fecha.$lte = fechaFin;
    }

    const valoraciones = await ValoracionIngreso.find(query).populate('paciente');
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
    // Obtener la valoración actual para comparar imágenes
    const valoracionActual = await ValoracionIngreso.findById(req.params.id);
    if (!valoracionActual) {
      return res.status(404).json({ mensaje: 'Valoración no encontrada' });
    }

    console.log(`Actualizando valoración ingreso ${req.params.id}...`);

    // Lista de campos que pueden contener imágenes
    const camposImagen = [
      'firmaRepresentante',
      'firmaProfesional', 
      'firmaAutorizacion'
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
    const valoracionActualizada = await ValoracionIngreso.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    console.log(`✓ Valoración ingreso actualizada. Imágenes anteriores eliminadas: ${imagenesEliminadas}`);
    
    res.json({ 
      mensaje: 'Valoración actualizada correctamente', 
      valoracion: valoracionActualizada,
      imagenesAnterioresEliminadas: imagenesEliminadas
    });
  } catch (error) {
    console.error('Error al actualizar valoración:', error);
    res.status(500).json({ mensaje: 'Error al actualizar valoración', error });
  }
});

module.exports = router;
