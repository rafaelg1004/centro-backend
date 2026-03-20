const express = require('express');
const router = express.Router();
const ValoracionFisioterapia = require('../models/ValoracionFisioterapia');
const EvolucionSesion = require('../models/EvolucionSesion');
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

const generarSesionesPerinatales = (planRaw) => {
  let sesiones = [];
  let sesionesIntensivo = [];

  const plan = String(planRaw || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (plan === 'educacion' || plan === 'ambos' || plan === 'educativa') {
    const nombres = [
      "Sesión No. 1: Introducción y Autocuidado",
      "Sesión No. 2: Parto Vaginal",
      "Sesión No. 3: Cesárea y Postparto",
      "Sesión No. 4: Lactancia",
      "Sesión No. 5: Cuidados del Recién Nacido",
      "Sesión No. 6: Técnicas de Confort",
      "Sesión No. 7: Estimulación Prenatal",
      "Sesión No. 8: Abuelos",
      "Visita en Clínica",
      "Visita de Cierre"
    ];
    sesiones = nombres.map(n => ({ nombre: n, fecha: "", firmaPaciente: "" }));
  }

  if (plan === 'fisico') {
    // Para la física no le ponemos nombre, solo numeración
    for (let i = 1; i <= 8; i++) {
      sesiones.push({ nombre: `Sesión No. ${i}`, fecha: "", firmaPaciente: "" });
    }
  }

  if (plan === 'intensivo' || plan === 'educacion intensiva') {
    const nombres = [
      "Sesión No. 1: Introducción y Autocuidado, Cuidados del recién Nacido, Estimulación Prenatal",
      "Sesión No. 2: Trabajo de Parto, Cesárea",
      "Sesión No. 3: Lactancia, Postparto"
    ];
    sesionesIntensivo = nombres.map(n => ({ nombre: n, fecha: "", firmaPaciente: "" }));
  }

  if (plan === 'ambos') {
    // Si es ambos, el intensivo (o segunda parte) son las 8 sesiones físicas
    for (let i = 1; i <= 8; i++) {
      sesionesIntensivo.push({
        nombre: `Sesión No. ${i} (Acondicionamiento Físico)`,
        fecha: "",
        firmaPaciente: ""
      });
    }
  }

  return { sesiones, sesionesIntensivo };
};

const crearSesionesEnCascada = async (valId, pacienteId, plan) => {
  const { sesiones, sesionesIntensivo } = generarSesionesPerinatales(plan);
  const todas = [...sesiones, ...sesionesIntensivo];

  const docs = todas.map((s, idx) => ({
    valoracionAsociada: valId,
    paciente: pacienteId,
    fechaInicioAtencion: new Date(), // Se inicializa con la fecha actual (requerido por RIPS)
    codProcedimiento: '890204',
    finalidadTecnologiaSalud: '44',
    codDiagnosticoPrincipal: 'Z348', // Generico embarazo
    numeroSesion: idx + 1,
    descripcionEvolucion: s.nombre,
    firmas: {
      paciente: { firmaUrl: "", timestamp: null },
      profesional: { nombre: "Ft. Dayan Ivonne Villegas Gamboa", registroMedico: "52862625", timestamp: null }
    }
  }));

  if (docs.length > 0) {
    await EvolucionSesion.insertMany(docs);
    console.log(`✅ Creadas ${docs.length} sesiones (Evoluciones) para la valoración ${valId}`);
  }
};

/**
 * @route   POST /api/valoraciones
 * @desc    Crear una nueva valoraciÃ³n unificada (PediatrÃ­a, Piso PÃ©lvico o Lactancia)
 */
router.post('/', validarImagenes, async (req, res) => {
  try {
    console.log('📬 RECIBIDA PETICIÓN POST /valoraciones:', JSON.stringify(req.body, null, 2));
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

    // Autocreación de sesiones para Perinatal si tiene plan
    let planParaSesiones = null;
    if (req.body.codConsulta === '890204') {
      const plan = req.body.moduloPerinatal?.planElegido;

      console.log('🔍 Validando creación de sesiones perinatales:', { plan });

      if (plan) {
        planParaSesiones = plan;
        // No sobreescribir tipoPrograma: debe conservarse como 'Perinatal' para detección correcta del esquema
      } else {
        console.log('⚠️ No se programaron sesiones independientes: falta definir el plan.');
      }
    }

    const nuevaValoracion = new ValoracionFisioterapia(req.body);
    const valoracionGuardada = await nuevaValoracion.save();

    // Crear sesiones (Evoluciones/Citas) si procede
    if (planParaSesiones) {
      try {
        await crearSesionesEnCascada(valoracionGuardada._id, valoracionGuardada.paciente, planParaSesiones);
      } catch (errSes) {
        console.error('❌ Error creando sesiones en cascada:', errSes);
      }
    }

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
    const { busqueda, fechaInicio, fechaFin, pagina = 1, limite = 500, modulo } = req.query;
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
      if (modulo === 'perinatal') query.codConsulta = '890204';
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

    const tieneModuloPoblado = (obj) => {
      if (!obj || typeof obj !== 'object') return false;
      const json = JSON.stringify(obj);
      if (json === '{}') return false;

      // Eliminamos estructuras vacías de Mongoose y valores por defecto
      const clean = json.replace(/[{}":,\[\]\s]/g, '').replace(/false|null|undefined/g, '');
      // Para Piso Pelvico, Mongoose suele meter habitos, evaluacionFisica, etc como llaves aunque esten vacios
      const keysToIgnore = ['habitos', 'evaluacionFisica', 'evaluacionMuscular', 'prenatales', 'perinatales', 'recienNacido', 'desarrolloSocial', 'hitos', 'examen', 'desarrolloMotor', 'motricidadFina', 'lenguaje', 'socioemocional'];
      let content = clean;
      keysToIgnore.forEach(k => content = content.split(k).join(''));

      return content.length > 0;
    };

    const mapiado = await Promise.all(valoraciones.map(async v => {
      // Prioridad absoluta al campo tipoPrograma si existe
      let tipo = v.tipoPrograma || null;

      if (!tipo) {
        // Detectar tipo basándose en contenido REAL de los módulos
        if (tieneModuloPoblado(v._doc?.moduloLactancia)) {
          tipo = 'Lactancia';
        } else if (tieneModuloPoblado(v._doc?.moduloPediatria)) {
          tipo = 'Pediatría';
        } else if (tieneModuloPoblado(v._doc?.moduloPisoPelvico)) {
          tipo = 'Piso Pélvico';
        }
        // Fallback por codConsulta (retrocompatibilidad)
        else if (v.codConsulta === '890204') {
          tipo = 'Perinatal';
        } else if (v.codConsulta === '890202') {
          tipo = 'Piso Pélvico';
        } else {
          tipo = (v.codConsulta === '890201') ? 'Pediatría' : 'General';
        }
      }

      // Si es perinatal, adjuntar información de progreso de sesiones independientes
      let sesionesIndependientes = [];
      if (v.codConsulta === '890204') {
        const rawSesiones = await EvolucionSesion.find({ valoracionAsociada: v._id }).lean();
        // Aliasing para retrocompatibilidad con la UI de arrays
        sesionesIndependientes = rawSesiones.map(s => ({
          ...s,
          firmaPaciente: s.firmas?.paciente?.firmaUrl,
          nombre: s.descripcionEvolucion,
          fecha: s.fechaInicioAtencion
        }));
      }

      return {
        ...v._doc,
        tipo,
        sesiones: sesionesIndependientes.filter(s => !s.descripcionEvolucion?.includes('Intensivo') && !s.descripcionEvolucion?.includes('Físico')),
        sesionesIntensivo: sesionesIndependientes.filter(s => s.descripcionEvolucion?.includes('Intensivo') || s.descripcionEvolucion?.includes('Físico'))
      };
    }));

    res.json({
      valoraciones: mapiado,
      paginacion: { total, pagina: parseInt(pagina), totalPaginas: Math.ceil(total / limite) }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error: error.message });
  }
});

/**
 * @route   GET /api/valoraciones/verificar/:pacienteId
 * @desc    Check if patient already has a valuation
 */
router.get('/verificar/:pacienteId', async (req, res) => {
  try {
    const valoracion = await ValoracionFisioterapia.findOne({ paciente: req.params.pacienteId }).sort({ fechaInicioAtencion: -1 });
    if (valoracion) {
      res.json({
        tieneValoracion: true,
        valoracion: {
          id: valoracion._id,
          fecha: valoracion.fechaInicioAtencion,
          motivoDeConsulta: valoracion.motivoConsulta || 'No especificado'
        }
      });
    } else {
      res.json({ tieneValoracion: false });
    }
  } catch (error) {
    console.error("Error validando valoración previa:", error);
    res.status(500).json({ mensaje: 'Error al verificar valoración', error: error.message });
  }
});

/**
 * @route   GET /api/valoraciones/paciente/:pacienteId
 * @desc    Obtener todas las valoraciones de un paciente (Cualquier tipo)
 */
router.get('/paciente/:pacienteId', async (req, res) => {
  try {
    const pId = req.params.pacienteId;

    // 1. Obtener todas las valoraciones (incluyendo las migradas)
    const valoraciones = await ValoracionFisioterapia.find({ paciente: pId })
      .populate('paciente')
      .sort({ fechaInicioAtencion: -1 });

    const { tieneModuloPoblado: tmpPop } = {
      tieneModuloPoblado: (obj) => {
        if (!obj || typeof obj !== 'object') return false;
        const json = JSON.stringify(obj);
        const clean = json.replace(/[{}":,\[\]\s]/g, '').replace(/false|null|undefined/g, '');
        const keysToIgnore = ['habitos', 'evaluacionFisica', 'evaluacionMuscular', 'prenatales', 'perinatales', 'recienNacido', 'desarrolloSocial', 'hitos', 'examen', 'desarrolloMotor', 'motricidadFina', 'lenguaje', 'socioemocional'];
        let content = clean;
        keysToIgnore.forEach(k => content = content.split(k).join(''));
        return content.length > 0;
      }
    };

    const mapiado = await Promise.all(valoraciones.map(async v => {
      let tipo = v.tipoPrograma || null;
      let ruta = '/valoraciones/';

      if (!tipo) {
        if (tmpPop(v._doc?.moduloLactancia)) tipo = 'Lactancia';
        else if (tmpPop(v._doc?.moduloPediatria)) tipo = 'Pediatría';
        else if (tmpPop(v._doc?.moduloPisoPelvico)) tipo = 'Piso Pélvico';
        else if (v.codConsulta === '890204') tipo = 'Perinatal';
        else if (v.codConsulta === '890202') tipo = 'Piso Pélvico';
        else if (v.codConsulta === '890201') tipo = 'Pediatría';
        else tipo = 'General';
      }

      // Si es una valoración migrada, podemos añadir un distintivo
      if (v._legacyId) {
        tipo += ' (Migrado)';
      }

      let sesionesIndependientes = [];
      if (v.codConsulta === '890204') {
        const rawSesiones = await EvolucionSesion.find({ valoracionAsociada: v._id }).lean();
        sesionesIndependientes = rawSesiones.map(s => ({
          ...s,
          firmaPaciente: s.firmas?.paciente?.firmaUrl,
          nombre: s.descripcionEvolucion,
          fecha: s.fechaInicioAtencion
        }));
      }

      return {
        ...v._doc,
        tipo,
        ruta: `${ruta}${v._id}`,
        fecha: v.fechaInicioAtencion,
        sesiones: sesionesIndependientes.filter(s => !s.descripcionEvolucion?.includes('Intensivo') && !s.descripcionEvolucion?.includes('Físico')),
        sesionesIntensivo: sesionesIndependientes.filter(s => s.descripcionEvolucion?.includes('Intensivo') || s.descripcionEvolucion?.includes('Físico'))
      };
    }));

    res.json(mapiado);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error: error.message });
  }
});

router.get('/:id', logAccesoValoracionMiddleware('CONSULTAR_VALORACION'), async (req, res) => {
  try {
    const valoracion = await ValoracionFisioterapia.findById(req.params.id)
      .populate('paciente')
      .select('+_datosLegacy'); // Forzar la selección de datos legacy
    if (!valoracion) return res.status(404).json({ error: "No encontrada" });

    const obj = valoracion.toObject();

    // Inyectar sesiones si es perinatal
    if (obj.codConsulta === '890204') {
      const rawSesiones = await EvolucionSesion.find({ valoracionAsociada: obj._id }).lean();
      const sesionesMapeadas = rawSesiones.map(s => ({
        ...s,
        firmaPaciente: s.firmas?.paciente?.firmaUrl,
        nombre: s.descripcionEvolucion,
        fecha: s.fechaInicioAtencion
      }));
      obj.sesiones = sesionesMapeadas.filter(s => !s.descripcionEvolucion?.includes('Intensivo') && !s.descripcionEvolucion?.includes('Físico'));
      obj.sesionesIntensivo = sesionesMapeadas.filter(s => s.descripcionEvolucion?.includes('Intensivo') || s.descripcionEvolucion?.includes('Físico'));
    }

    res.json(obj);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoración', error });
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

    // Autocreación de sesiones en actualización si tiene plan y no existen
    let planDiferido = null;
    if (valoracionActual.codConsulta === '890204' || req.body.codConsulta === '890204') {
      const plan = req.body.moduloPerinatal?.planElegido || req.body.tipoPrograma || valoracionActual.moduloPerinatal?.planElegido;

      // Consultar si ya existen sesiones (Evoluciones) para esta valoración
      const countSesiones = await EvolucionSesion.countDocuments({ valoracionAsociada: req.params.id });
      const sinSesiones = countSesiones === 0;

      console.log('🔍 Validando creación diferida de sesiones perinatales (PUT):', { plan, sinSesiones });

      if (plan && sinSesiones) {
        planDiferido = plan;
        req.body.tipoPrograma = plan;
      }
    }

    const actualizada = await ValoracionFisioterapia.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (planDiferido) {
      try {
        await crearSesionesEnCascada(actualizada._id, actualizada.paciente, planDiferido);
      } catch (errSes) {
        console.error('❌ Error creando sesiones diferidas en cascada:', errSes);
      }
    }

    res.json({ mensaje: 'Actualizada correctamente', valoracion: actualizada });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
  }
});

router.get('/legacy/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const db = mongoose.connection.db;
    
    // Lista blanca de colecciones permitidas
    const allowed = ['valoracioningresos', 'valoracioningresoadultoslactancias', 'valoracionpisopelvicos'];
    if (!allowed.includes(collection)) {
      return res.status(403).json({ error: "ColecciÃ³n no permitida" });
    }

    const doc = await db.collection(collection).findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!doc) return res.status(404).json({ error: "No encontrada" });

    // Intentar obtener el paciente para el nombre
    let paciente = null;
    if (doc.paciente) {
      paciente = await db.collection('pacientes').findOne({ _id: new mongoose.Types.ObjectId(doc.paciente) });
    }

    res.json({ ...doc, _legacy: true, _collection: collection, paciente });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciÃ³n legacy', error: error.message });
  }
});

module.exports = router;
