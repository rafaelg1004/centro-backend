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
    console.log('🔍 Datos completos recibidos:', {
      paciente: req.body.paciente,
      tipoPaciente: typeof req.body.paciente,
      fecha: req.body.fecha,
      motivoDeConsulta: req.body.motivoDeConsulta
    });
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
    
    // Verificar si ya existe una valoración para este paciente
    if (req.body.paciente) {
      console.log('🔍 Verificando si ya existe valoración para paciente:', req.body.paciente);
      
      // Validar que el ID del paciente sea válido
      if (!req.body.paciente.match(/^[0-9a-fA-F]{24}$/)) {
        console.log('❌ ID de paciente inválido:', req.body.paciente);
        return res.status(400).json({
          error: 'PACIENTE_ID_INVALIDO',
          mensaje: 'El ID del paciente no es válido'
        });
      }
      
      // Verificar que el paciente existe en la base de datos
      const Paciente = require('../models/Paciente');
      const pacienteExiste = await Paciente.findById(req.body.paciente);
      if (!pacienteExiste) {
        console.log('❌ Paciente no encontrado en la base de datos:', req.body.paciente);
        return res.status(404).json({
          error: 'PACIENTE_NO_ENCONTRADO',
          mensaje: 'El paciente no existe en la base de datos'
        });
      }
      
      console.log('✅ Paciente encontrado:', pacienteExiste.nombres);
      
      // Buscar valoración existente
      const valoracionExistente = await ValoracionIngreso.findOne({ paciente: req.body.paciente });
      console.log('🔍 Resultado de búsqueda de valoración:', valoracionExistente ? `Encontrada: ${valoracionExistente._id}` : 'No encontrada');
      
      if (valoracionExistente) {
        console.log('⚠️ Ya existe una valoración para este paciente:', valoracionExistente._id);
        console.log('⚠️ Detalles de la valoración existente:', {
          id: valoracionExistente._id,
          fecha: valoracionExistente.fecha,
          motivoDeConsulta: valoracionExistente.motivoDeConsulta,
          paciente: valoracionExistente.paciente
        });
        
        return res.status(409).json({
          error: 'VALORACION_DUPLICADA',
          mensaje: 'Este paciente ya tiene una valoración de ingreso. Puede editarla si lo desea.',
          valoracionExistente: {
            id: valoracionExistente._id,
            fecha: valoracionExistente.fecha,
            motivoDeConsulta: valoracionExistente.motivoDeConsulta
          },
          sugerencia: 'Use la opción de editar para modificar la valoración existente'
        });
      } else {
        console.log('✅ No se encontró valoración existente, procediendo a crear nueva');
      }
    } else {
      console.log('⚠️ No se proporcionó ID de paciente en la solicitud');
      return res.status(400).json({
        error: 'PACIENTE_REQUERIDO',
        mensaje: 'El campo paciente es obligatorio'
      });
    }
    
    const nuevaValoracion = new ValoracionIngreso(req.body);
    const valoracionGuardada = await nuevaValoracion.save();
    res.status(201).json(valoracionGuardada);
  } catch (error) {
    console.error('Error al guardar valoración:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error });
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

    console.log('🔍 Búsqueda de valoraciones con parámetros:', { busqueda, fechaInicio, fechaFin, pagina: paginaNum, limite: limiteNum });

    // Filtro de búsqueda por nombre o documento
    let busquedaRegex = '';
    if (busqueda) {
      // Crear regex que ignore acentos y caracteres especiales
      busquedaRegex = busqueda.replace(/[áäâà]/gi, '[áäâà]')
                              .replace(/[éëêè]/gi, '[éëêè]')
                              .replace(/[íïîì]/gi, '[íïîì]')
                              .replace(/[óöôò]/gi, '[óöôò]')
                              .replace(/[úüûù]/gi, '[úüûù]')
                              .replace(/[ñ]/gi, '[ñ]');
      
      // Primero buscar pacientes que coincidan
      const Paciente = require('../models/Paciente');
      const pacientesCoincidentes = await Paciente.find({
        $or: [
          { nombres: { $regex: busquedaRegex, $options: 'i' } },
          { apellidos: { $regex: busquedaRegex, $options: 'i' } },
          { registroCivil: { $regex: busquedaRegex, $options: 'i' } }
        ]
      }).select('_id');
      
      const idsPacientes = pacientesCoincidentes.map(p => p._id);
      console.log('🔍 Pacientes encontrados:', idsPacientes.length);
      console.log('🔍 IDs de pacientes:', idsPacientes);
      
      // Buscar valoraciones que pertenezcan a esos pacientes
      query.paciente = { $in: idsPacientes };
      
      console.log('🔍 Query de búsqueda:', JSON.stringify(query, null, 2));
      console.log('🔍 Regex generado:', busquedaRegex);
    }

    // Filtros de fecha
    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) query.fecha.$gte = fechaInicio;
      if (fechaFin) query.fecha.$lte = fechaFin;
    }

    console.log('🔍 Query final:', JSON.stringify(query, null, 2));

    // Obtener total de documentos para paginación
    const total = await ValoracionIngreso.countDocuments(query);
    
    // Obtener valoraciones con paginación
    const valoraciones = await ValoracionIngreso.find(query)
      .populate('paciente', 'nombres apellidos registroCivil')
      .sort({ 
        'paciente.nombres': 1,
        'paciente.apellidos': 1,
        createdAt: -1 
      })
      .skip(skip)
      .limit(limiteNum);
    
          console.log(`📋 Encontradas ${valoraciones.length} valoraciones de ${total} totales`);
      console.log('📋 Primeras valoraciones:', valoraciones.slice(0, 3).map(v => ({
        id: v._id,
        paciente: v.paciente ? {
          nombres: v.paciente.nombres,
          registroCivil: v.paciente.registroCivil
        } : 'NO POBLADO',
        nombres: v.nombres,
        registroCivil: v.registroCivil
      })));
      
      // Debug adicional para búsquedas
      if (busqueda) {
        console.log('🔍 Búsqueda realizada:', busqueda);
        console.log('🔍 Regex usado:', busquedaRegex);
        console.log('🔍 Query completo:', JSON.stringify(query, null, 2));
        console.log('🔍 Valoraciones que coinciden con la búsqueda:');
        valoraciones.forEach((v, idx) => {
          const nombrePaciente = v.paciente?.nombres || 'Sin nombre';
          const apellidoPaciente = v.paciente?.apellidos || '';
          const docPaciente = v.paciente?.registroCivil || 'Sin documento';
          console.log(`  ${idx + 1}. Nombre: "${nombrePaciente} ${apellidoPaciente}".trim() | Doc: "${docPaciente}" | ID Paciente: ${v.paciente?._id || 'NO POBLADO'}`);
        });
      }
    
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
    console.error('❌ Error en búsqueda de valoraciones:', error);
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error });
  }
});

// Verificar si un paciente ya tiene valoración de ingreso
router.get('/verificar/:pacienteId', async (req, res) => {
  try {
    const valoracion = await ValoracionIngreso.findOne({ paciente: req.params.pacienteId });
    
    if (valoracion) {
      res.json({
        tieneValoracion: true,
        valoracion: {
          id: valoracion._id,
          fecha: valoracion.fecha,
          motivoDeConsulta: valoracion.motivoDeConsulta,
          createdAt: valoracion.createdAt
        },
        mensaje: 'Este paciente ya tiene una valoración de ingreso. Puede editarla si lo desea.'
      });
    } else {
      res.json({
        tieneValoracion: false,
        mensaje: 'Este paciente no tiene valoración de ingreso. Puede crear una nueva.'
      });
    }
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al verificar valoración del paciente', error });
  }
});

// Obtener valoraciones por paciente (solo para niños - ValoracionIngreso)
router.get('/paciente/:pacienteId', async (req, res) => {
  try {
    const valoraciones = await ValoracionIngreso.find({ paciente: req.params.pacienteId }).populate('paciente').sort({ createdAt: -1 });
    res.json(valoraciones);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones del paciente', error });
  }
});

// Obtener todas las valoraciones de un paciente adulto (todos los tipos)
router.get('/adulto/:pacienteId', async (req, res) => {
  try {
    console.log('=== BUSCANDO VALORACIONES ADULTO ===');
    console.log('Paciente ID:', req.params.pacienteId);
    
    const ValoracionLactancia = require('../models/ValoracionIngresoAdultosLactancia');
    const ValoracionPisoPelvico = require('../models/ValoracionPisoPelvico');
    const ConsentimientoPerinatal = require('../models/ConsentimientoPerinatal');
    
    // Buscar lactancia
    console.log('Buscando valoraciones de lactancia...');
    const lactancia = await ValoracionLactancia.find({ paciente: req.params.pacienteId }).populate('paciente');
    console.log('Lactancia encontradas:', lactancia.length);
    
    // Buscar piso pélvico
    console.log('Buscando valoraciones de piso pélvico...');
    const pisoPelvico = await ValoracionPisoPelvico.find({ paciente: req.params.pacienteId }).populate('paciente');
    console.log('Piso pélvico encontradas:', pisoPelvico.length);
    
    // Buscar perinatal
    console.log('Buscando consentimientos perinatales...');
    const perinatal = await ConsentimientoPerinatal.find({ paciente: req.params.pacienteId }).populate('paciente');
    console.log('Perinatales encontrados:', perinatal.length);
    
    // Combinar y agregar tipo
    const todasLasValoraciones = [];
    
    lactancia.forEach(v => {
      todasLasValoraciones.push({
        ...v.toObject(),
        tipo: 'Lactancia',
        ruta: `/valoracion-adultos-lactancia/${v._id}`
      });
    });
    
    pisoPelvico.forEach(v => {
      todasLasValoraciones.push({
        ...v.toObject(),
        tipo: 'Piso Pélvico',
        ruta: `/valoracion-piso-pelvico/${v._id}`
      });
    });
    
    perinatal.forEach(v => {
      todasLasValoraciones.push({
        ...v.toObject(),
        tipo: 'Perinatal',
        ruta: `/consentimientos-perinatales/${v._id}`
      });
    });
    
    console.log('Total valoraciones combinadas:', todasLasValoraciones.length);
    console.log('Valoraciones:', todasLasValoraciones.map(v => ({ id: v._id, tipo: v.tipo, fecha: v.fecha || v.createdAt })));
    
    res.json(todasLasValoraciones);
  } catch (error) {
    console.error('Error al obtener valoraciones del paciente adulto:', error);
    res.status(500).json({ mensaje: 'Error al obtener valoraciones del paciente adulto', error: error.message });
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
