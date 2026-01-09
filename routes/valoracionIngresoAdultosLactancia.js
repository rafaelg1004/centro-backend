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
    // Verificar si ya existe una valoración para este paciente
    if (req.body.paciente) {
      const valoracionExistente = await Valoracion.findOne({ paciente: req.body.paciente });
      
      if (valoracionExistente) {
        console.log('⚠️ Ya existe una valoración de lactancia para este paciente:', valoracionExistente._id);
        return res.status(409).json({
          error: 'VALORACION_DUPLICADA',
          mensaje: 'Este paciente ya tiene una valoración de lactancia. Puede editarla si lo desea.',
          valoracionExistente: {
            id: valoracionExistente._id,
            fecha: valoracionExistente.fecha,
            nombres: valoracionExistente.nombres
          },
          sugerencia: 'Use la opción de editar para modificar la valoración existente'
        });
      }
    }
    
    const nuevaValoracion = new Valoracion(req.body);
    const valoracionGuardada = await nuevaValoracion.save();
    res.status(201).json(valoracionGuardada);
  } catch (error) {
    console.error('Error al guardar valoración:', error); // <--- Aquí verás el error real
    res.status(500).json({ mensaje: 'Error al guardar valoración', error });
  }
});

// Obtener todas las valoraciones (con filtros opcionales y paginación)
router.get('/', async (req, res) => {
  try {
    const { busqueda, fechaInicio, fechaFin, pagina = 1, limite = 15 } = req.query;
    const paginaNum = parseInt(pagina);
    const limiteNum = parseInt(limite);
    const skip = (paginaNum - 1) * limiteNum;
    
    let query = {};

    // Filtro de búsqueda por nombre o cédula
    let busquedaRegex = '';
    if (busqueda) {
      // Crear regex que ignore acentos y caracteres especiales
      busquedaRegex = busqueda.replace(/[áäâà]/gi, '[áäâà]')
                              .replace(/[éëêè]/gi, '[éëêè]')
                              .replace(/[íïîì]/gi, '[íïîì]')
                              .replace(/[óöôò]/gi, '[óöôò]')
                              .replace(/[úüûù]/gi, '[úüûù]')
                              .replace(/[ñ]/gi, '[ñ]');
      
      query.$or = [
        { 'nombres': { $regex: busquedaRegex, $options: 'i' } },
        { 'cedula': { $regex: busquedaRegex, $options: 'i' } }
      ];
    }

    // Filtros de fecha
    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) query.fecha.$gte = fechaInicio;
      if (fechaFin) query.fecha.$lte = fechaFin;
    }

    // Obtener total de documentos para paginación
    const total = await Valoracion.countDocuments(query);
    
    // Obtener valoraciones con paginación
    const valoraciones = await Valoracion.find(query)
      .populate('paciente', 'nombres apellidos cedula telefono fechaNacimiento edad genero lugarNacimiento estadoCivil direccion celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto')
      .sort({
        nombres: 1,
        createdAt: -1
      })
      .skip(skip)
      .limit(limiteNum);
    
    res.json({
      valoraciones,
      paginacion: {
        pagina: paginaNum,
        limite: limiteNum,
        total,
        totalPaginas: Math.ceil(total / limiteNum),
        tieneSiguiente: paginaNum < Math.ceil(total / limiteNum),
        tieneAnterior: paginaNum > 1
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error });
  }
});
// Verificar si un paciente ya tiene valoración de lactancia
router.get('/verificar/:pacienteId', async (req, res) => {
  try {
    const valoracion = await Valoracion.findOne({ paciente: req.params.pacienteId });
    
    if (valoracion) {
      res.json({
        tieneValoracion: true,
        valoracion: {
          id: valoracion._id,
          fecha: valoracion.fecha,
          nombres: valoracion.nombres,
          createdAt: valoracion.createdAt
        },
        mensaje: 'Este paciente ya tiene una valoración de lactancia. Puede editarla si lo desea.'
      });
    } else {
      res.json({
        tieneValoracion: false,
        mensaje: 'Este paciente no tiene valoración de lactancia. Puede crear una nueva.'
      });
    }
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al verificar valoración del paciente', error });
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
    })
    .populate('paciente', 'nombres apellidos cedula telefono fechaNacimiento edad genero lugarNacimiento estadoCivil direccion celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto')
    .limit(20);
    res.json(valoraciones);
  } catch (e) {
    console.error("Error en /buscar:", e);
    res.json([]);
  }
});


// Obtener una valoración por ID
router.get('/:id', async (req, res) => {
  try {
    const valoracion = await Valoracion.findById(req.params.id)
      .populate('paciente', 'nombres apellidos cedula telefono fechaNacimiento edad genero lugarNacimiento estadoCivil direccion celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto');
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