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
    console.log('Datos recibidos para nueva valoración piso pélvico:', {
      paciente: req.body.paciente,
      nombres: req.body.nombres,
      cedula: req.body.cedula
    });

    // Validar que se envíe el ID del paciente
    if (!req.body.paciente) {
      return res.status(400).json({
        mensaje: 'El campo paciente es obligatorio',
        error: 'PACIENTE_REQUERIDO'
      });
    }

    // Validar que el ID del paciente sea válido
    if (!req.body.paciente.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        mensaje: 'El ID del paciente no es válido',
        error: 'PACIENTE_ID_INVALIDO'
      });
    }

    // Verificar que el paciente adulto existe
    const PacienteAdulto = require('../models/PacienteAdulto');
    const pacienteExiste = await PacienteAdulto.findById(req.body.paciente);
    if (!pacienteExiste) {
      return res.status(404).json({
        mensaje: 'El paciente adulto no existe',
        error: 'PACIENTE_NO_ENCONTRADO'
      });
    }

    // Verificar si ya existe una valoración para este paciente
    const valoracionExistente = await Valoracion.findOne({ paciente: req.body.paciente });

    if (valoracionExistente) {
      console.log('⚠️ Ya existe una valoración de piso pélvico para este paciente:', valoracionExistente._id);
      return res.status(409).json({
        error: 'VALORACION_DUPLICADA',
        mensaje: 'Este paciente ya tiene una valoración de piso pélvico. Puede editarla si lo desea.',
        valoracionExistente: {
          id: valoracionExistente._id,
          fecha: valoracionExistente.fecha,
          motivoConsulta: valoracionExistente.motivoConsulta
        },
        sugerencia: 'Use la opción de editar para modificar la valoración existente'
      });
    }

    const nuevaValoracion = new Valoracion(req.body);
    const valoracionGuardada = await nuevaValoracion.save();

    console.log('✓ Valoración piso pélvico guardada exitosamente:', valoracionGuardada._id);
    res.status(201).json(valoracionGuardada);
  } catch (error) {
    console.error('Error al guardar valoración piso pélvico:', error);
    res.status(500).json({ mensaje: 'Error al guardar valoración', error: error.message });
  }
});

// Obtener todas las valoraciones (con filtros opcionales y paginación)
router.get('/', async (req, res) => {
  try {
    console.log('Obteniendo valoraciones piso pélvico con filtros...');

    const { busqueda, fechaInicio, fechaFin, pagina = 1, limite = 15 } = req.query;
    const paginaNum = parseInt(pagina);
    const limiteNum = parseInt(limite);
    const skip = (paginaNum - 1) * limiteNum;

    let query = {};

    // Filtros de fecha
    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) query.fecha.$gte = fechaInicio;
      if (fechaFin) query.fecha.$lte = fechaFin;
    }

    // Si hay búsqueda, buscar en pacientes adultos primero
    let busquedaRegex = '';
    if (busqueda) {
      const PacienteAdulto = require('../models/PacienteAdulto');

      // Crear regex que ignore acentos y caracteres especiales
      busquedaRegex = busqueda.replace(/[áäâà]/gi, '[áäâà]')
        .replace(/[éëêè]/gi, '[éëêè]')
        .replace(/[íïîì]/gi, '[íïîì]')
        .replace(/[óöôò]/gi, '[óöôò]')
        .replace(/[úüûù]/gi, '[úüûù]')
        .replace(/[ñ]/gi, '[ñ]');

      const pacientesCoincidentes = await PacienteAdulto.find({
        $or: [
          { nombres: { $regex: busquedaRegex, $options: "i" } },
          { apellidos: { $regex: busquedaRegex, $options: "i" } },
          { cedula: { $regex: busquedaRegex, $options: "i" } }
        ]
      }).select('_id');

      const idsPacientes = pacientesCoincidentes.map(p => p._id);
      query.paciente = { $in: idsPacientes };
    }

    // Obtener total de documentos para paginación
    const total = await Valoracion.countDocuments(query);

    // Obtener valoraciones con paginación
    const valoraciones = await Valoracion.find(query)
      .populate('paciente', 'nombres apellidos cedula genero edad aseguradora')
      .select('-firmaPaciente -firmaFisioterapeuta -firmaAutorizacion -consentimientoFirma')
      .sort({
        'paciente.nombres': 1,
        'paciente.apellidos': 1,
        createdAt: -1
      })
      .skip(skip)
      .limit(limiteNum);

    console.log(`✓ Encontradas ${valoraciones.length} valoraciones piso pélvico de ${total} totales`);
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
    console.error('Error al obtener valoraciones piso pélvico:', error);
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error: error.message });
  }
});

// Verificar si un paciente ya tiene valoración de piso pélvico
router.get('/verificar/:pacienteId', async (req, res) => {
  try {
    const valoracion = await Valoracion.findOne({ paciente: req.params.pacienteId });

    if (valoracion) {
      res.json({
        tieneValoracion: true,
        valoracion: {
          id: valoracion._id,
          fecha: valoracion.fecha,
          motivoConsulta: valoracion.motivoConsulta,
          createdAt: valoracion.createdAt
        },
        mensaje: 'Este paciente ya tiene una valoración de piso pélvico. Puede editarla si lo desea.'
      });
    } else {
      res.json({
        tieneValoracion: false,
        mensaje: 'Este paciente no tiene valoración de piso pélvico. Puede crear una nueva.'
      });
    }
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al verificar valoración del paciente', error });
  }
});

// Búsqueda general por nombre o cédula del paciente
router.get('/buscar', async (req, res) => {
  const { q } = req.query;
  try {
    if (!q || q.trim() === "") {
      // Si no hay búsqueda, devolver todas las valoraciones con datos del paciente
      const valoraciones = await Valoracion.find()
        .populate('paciente', 'nombres apellidos cedula telefono fechaNacimiento edad genero lugarNacimiento estadoCivil direccion celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto')
        .sort({ createdAt: -1 })
        .limit(50);
      return res.json(valoraciones);
    }

    // Buscar pacientes que coincidan con la búsqueda
    const PacienteAdulto = require('../models/PacienteAdulto');
    const pacientesCoincidentes = await PacienteAdulto.find({
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { apellidos: { $regex: q, $options: "i" } },
        { cedula: { $regex: q, $options: "i" } },
        { telefono: { $regex: q, $options: "i" } }
      ]
    }).select('_id');

    const idsPacientes = pacientesCoincidentes.map(p => p._id);

    // Buscar valoraciones que pertenezcan a esos pacientes
    const valoraciones = await Valoracion.find({
      $or: [
        { paciente: { $in: idsPacientes } },
        { motivoConsulta: { $regex: q, $options: "i" } }
      ]
    })
      .populate('paciente', 'nombres apellidos cedula telefono fechaNacimiento edad genero lugarNacimiento estadoCivil direccion celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(valoraciones);
  } catch (e) {
    console.error("Error en /buscar:", e);
    res.status(500).json({ error: "Error en la búsqueda", mensaje: e.message });
  }
});

// Obtener una valoración por ID
router.get('/:id', async (req, res) => {
  try {
    console.log('Buscando valoración piso pélvico:', req.params.id);

    const valoracion = await Valoracion.findById(req.params.id)
      .populate('paciente', 'nombres cedula genero lugarNacimiento fechaNacimiento edad estadoCivil direccion telefono celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto');

    if (!valoracion) {
      return res.status(404).json({ mensaje: 'Valoración no encontrada' });
    }

    console.log('✓ Valoración encontrada con paciente:', valoracion.paciente ? 'SÍ' : 'NO');
    res.json(valoracion);
  } catch (error) {
    console.error('Error al obtener valoración piso pélvico:', error);
    res.status(500).json({ mensaje: 'Error al obtener valoración', error: error.message });
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
    ).populate('paciente', 'nombres cedula genero lugarNacimiento fechaNacimiento edad estadoCivil direccion telefono celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto');

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
    const { id } = req.params;
    console.log(`Intentando eliminar valoración piso pélvico con ID: ${id}`);

    // Validar que el ID tenga el formato correcto de MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ ID inválido - no es un ObjectId válido');
      return res.status(400).json({ mensaje: "ID de valoración inválido" });
    }

    // Primero obtener la valoración para acceder a las imágenes
    const valoracion = await Valoracion.findById(id);
    if (!valoracion) {
      console.log('❌ Valoración no encontrada en la base de datos');
      return res.status(404).json({ mensaje: "Valoración no encontrada" });
    }

    console.log(`✅ Valoración encontrada, procediendo a eliminar...`);

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
    await Valoracion.findByIdAndDelete(id);

    console.log(`✅ Valoración ${id} eliminada exitosamente`);
    res.json({
      mensaje: 'Valoración eliminada exitosamente',
      imagenesEliminadas: resultadosEliminacion.filter(r => r.resultado.success).length,
      totalImagenes: resultadosEliminacion.length
    });
  } catch (error) {
    console.error('Error al eliminar valoración piso pélvico:', error);
    res.status(500).json({ mensaje: 'Error al eliminar valoración', error: error.message });
  }
});

module.exports = router;