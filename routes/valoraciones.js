const express = require('express');
const router = express.Router();
const ValoracionFisioterapia = require('../models/ValoracionFisioterapia');
const { eliminarImagenesValoracion } = require('../utils/s3Utils');
const logger = require('../utils/logger');
const { verificarBloqueo } = require('../utils/hcMiddleware');

// Middleware para logging de acceso a valoraciones
const logAccesoValoracionMiddleware = (accion) => {
  return (req, res, next) => {
    const usuario = (req.usuario && req.usuario.usuario) ? req.usuario.usuario : 'desconocido';
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const valoracionId = req.params.id || 'multiple';
    let pacienteId = 'desconocido';
    if (req.params.pacienteId) pacienteId = req.params.pacienteId;
    else if (req.body && req.body.paciente) pacienteId = req.body.paciente;
    else if (req.query && req.query.pacienteId) pacienteId = req.query.pacienteId;

    logger.logValoracion(accion, {
      user: usuario,
      paciente: pacienteId,
      valoracion: valoracionId,
      ip: clientIP,
      userAgent,
      details: {
        metodo: req.method,
        endpoint: req.originalUrl
      }
    });

    next();
  };
};

// Middleware para validar que no se guarden imÃ¡genes base64
const validarImagenes = (req, res, next) => {
  const data = req.body;
  const camposImagen = [
    'firmaProfesional', 'firmaRepresentante', 'firmaAcudiente', 'firmaFisioterapeuta',
    'firmaAutorizacion', 'consentimiento_firmaAcudiente', 'consentimiento_firmaFisio'
  ];

  for (const campo of camposImagen) {
    if (data[campo] && data[campo].toString().startsWith('data:image')) {
      return res.status(400).json({
        error: `El campo ${campo} contiene datos base64. Las imÃ¡genes deben subirse a S3 primero.`
      });
    }
  }
  next();
};

/**
 * @route   POST /api/valoraciones
 * @desc    Crear una nueva valoraciÃ³n unificada (PediatrÃ­a, Piso PÃ©lvico o Lactancia)
 */
router.post('/', validarImagenes, async (req, res) => {
  try {
    const { paciente, codConsulta } = req.body;

    if (!paciente) {
      return res.status(400).json({ error: 'PACIENTE_REQUERIDO', mensaje: 'El campo paciente es obligatorio' });
    }

    // Verificar si ya existe una valoraciÃ³n Activa/Reciente para este paciente y tipo
    const valoracionExistente = await ValoracionFisioterapia.findOne({
      paciente,
      codConsulta
    });

    if (valoracionExistente && !req.body.permitirDuplicado) {
      return res.status(409).json({
        error: 'VALORACION_DUPLICADA',
        mensaje: 'Este paciente ya tiene una valoraciÃ³n registrada de este tipo.',
        valoracionExistente: {
          id: valoracionExistente._id,
          fecha: valoracionExistente.fechaInicioAtencion
        }
      });
    }

    const nuevaValoracion = new ValoracionFisioterapia(req.body);
    const valoracionGuardada = await nuevaValoracion.save();
    res.status(201).json(valoracionGuardada);
  } catch (error) {
    console.error('Error al guardar valoraciÃ³n:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
});

/**
 * @route   GET /api/valoraciones
 * @desc    Obtener listado unificado de valoraciones con filtros RIPS
 */
router.get('/', logAccesoValoracionMiddleware('LISTAR_VALORACIONES'), async (req, res) => {
  try {
    const { busqueda, fechaInicio, fechaFin, pagina = 1, limite = 15, modulo } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    let query = {};

    if (busqueda) {
      const Paciente = require('../models/Paciente');
      const pacientesCoincidentes = await Paciente.find({
        $or: [
          { nombres: { $regex: busqueda, $options: 'i' } },
          { apellidos: { $regex: busqueda, $options: 'i' } },
          { numDocumentoIdentificacion: { $regex: busqueda, $options: 'i' } }
        ]
      }).select('_id');
      query.paciente = { $in: pacientesCoincidentes.map(p => p._id) };
    }

    if (modulo) {
      // Filtro por tipo de mÃ³dulo (especialidad)
      if (modulo === 'pediatria') query.moduloPediatria = { $exists: true };
      if (modulo === 'pisoPelvico') query.moduloPisoPelvico = { $exists: true };
      if (modulo === 'lactancia') query.moduloLactancia = { $exists: true };
    }

    if (fechaInicio || fechaFin) {
      query.fechaInicioAtencion = {};
      if (fechaInicio) query.fechaInicioAtencion.$gte = new Date(fechaInicio);
      if (fechaFin) query.fechaInicioAtencion.$lte = new Date(fechaFin);
    }

    const total = await ValoracionFisioterapia.countDocuments(query);
    const valoraciones = await ValoracionFisioterapia.find(query)
      .populate('paciente', 'nombres apellidos numDocumentoIdentificacion codSexo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limite));

    res.json({
      valoraciones,
      paginacion: { total, pagina: parseInt(pagina), totalPaginas: Math.ceil(total / limite) }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error: error.message });
  }
});

/**
 * @route   GET /api/valoraciones/paciente/:pacienteId
 * @desc    Obtener todas las valoraciones de un paciente (Cualquier tipo)
 */
router.get('/paciente/:pacienteId', async (req, res) => {
  try {
    const valoraciones = await ValoracionFisioterapia.find({ paciente: req.params.pacienteId })
      .populate('paciente')
      .sort({ createdAt: -1 });

    // Mapeo para compatibilidad con el frontend (que espera campo 'tipo' para decidir icono/ruta)
    const mapiado = valoraciones.map(v => {
      let tipo = 'General';
      let ruta = '/detalle-valoracion/';
      if (v.moduloPediatria && Object.keys(v.moduloPediatria).length > 1) tipo = 'PediatrÃ­a';
      if (v.moduloPisoPelvico && v.moduloPisoPelvico.oxfordGlobal) {
        tipo = 'Piso PÃ©lvico';
        ruta = '/valoraciones-piso-pelvico/';
      }
      if (v.moduloLactancia && v.moduloLactancia.experienciaLactancia) {
        tipo = 'Lactancia';
        ruta = '/valoracion-ingreso-adultos-lactancia/';
      }

      return {
        ...v._doc,
        tipo,
        ruta: `${ruta}${v._id}`,
        fecha: v.fechaInicioAtencion // Alias legacy
      };
    });

    res.json(mapiado);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error: error.message });
  }
});

router.get('/:id', logAccesoValoracionMiddleware('CONSULTAR_VALORACION'), async (req, res) => {
  try {
    const valoracion = await ValoracionFisioterapia.findById(req.params.id).populate('paciente');
    if (!valoracion) return res.status(404).json({ error: "No encontrada" });
    res.json(valoracion);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciÃ³n', error });
  }
});

router.delete('/:id', logAccesoValoracionMiddleware('ELIMINAR_VALORACION'), verificarBloqueo(ValoracionFisioterapia, 'ValoraciÃ³n'), async (req, res) => {
  try {
    const valoracion = await ValoracionFisioterapia.findById(req.params.id);
    if (!valoracion) return res.status(404).json({ mensaje: "No encontrada" });

    // Eliminar imÃ¡genes si existen
    const camposImagen = ['firmas.pacienteOAcudiente.firmaUrl', 'firmas.profesional.firmaUrl'];
    await eliminarImagenesValoracion(valoracion, camposImagen);

    await ValoracionFisioterapia.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "ValoraciÃ³n eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', logAccesoValoracionMiddleware('ACTUALIZAR_VALORACION'), verificarBloqueo(ValoracionFisioterapia, 'ValoraciÃ³n'), validarImagenes, async (req, res) => {
  try {
    const valoracionActual = await ValoracionFisioterapia.findById(req.params.id);
    if (!valoracionActual) return res.status(404).json({ mensaje: 'No encontrada' });

    const { generarHash, obtenerMetadatosPista } = require('../utils/auditUtils');

    // LÃ³gica de firmas y auditorÃ­a (Nueva estructura)
    if (req.body.firmas) {
      if (!req.body.auditTrail) req.body.auditTrail = valoracionActual.auditTrail || {};

      // Si hay nueva firma del profesional
      if (req.body.firmas.profesional?.firmaUrl && req.body.firmas.profesional.firmaUrl !== valoracionActual.firmas?.profesional?.firmaUrl) {
        req.body.auditTrail.firmaProfesional = obtenerMetadatosPista(req);
        req.body.auditTrail.firmaProfesional.registroProfesional = req.usuario?.registroMedico;
      }
    }

    // Sellado criptogrÃ¡fico si se bloquea
    if (req.body.bloqueada && !valoracionActual.bloqueada) {
      req.body.fechaBloqueo = new Date();
      req.body.selloIntegridad = generarHash({
        contenido: req.body,
        auditTrail: req.body.auditTrail,
        fechaBloqueo: req.body.fechaBloqueo
      });
    }

    const actualizada = await ValoracionFisioterapia.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({ mensaje: 'Actualizada correctamente', valoracion: actualizada });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
  }
});

module.exports = router;
