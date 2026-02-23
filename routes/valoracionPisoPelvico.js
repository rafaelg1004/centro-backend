/**
 * RUTA LEGACY: /api/valoraciones-piso-pelvico
 * 
 * Proxy de compatibilidad hacia el modelo unificado `ValoracionFisioterapia`.
 * El frontend que usa esta ruta seguirá funcionando sin cambios.
 * Internamente, todos los datos se guardan con el módulo `moduloPisoPelvico` activado.
 */
const express = require('express');
const router = express.Router();
const ValoracionFisioterapia = require('../models/ValoracionFisioterapia');
const { eliminarImagenesValoracion } = require('../utils/s3Utils');
const { verificarBloqueo } = require('../utils/hcMiddleware');

const CUPS_PISO_PELVICO = '890202'; // Código CUPS para valoración de piso pélvico

const bloquearBase64 = (req, res, next) => {
  const camposImagen = ['firmaPaciente', 'firmaFisioterapeuta', 'firmaAutorizacion', 'consentimientoFirma'];
  for (const campo of camposImagen) {
    if (req.body[campo] && typeof req.body[campo] === 'string' && req.body[campo].startsWith('data:image')) {
      return res.status(400).json({ error: `El campo ${campo} contiene base64. Use URL de S3.` });
    }
  }
  next();
};

// Crear valoración de piso pélvico
router.post('/', bloquearBase64, async (req, res) => {
  try {
    if (!req.body.paciente) {
      return res.status(400).json({ error: 'El campo paciente es obligatorio' });
    }

    // Verificar duplicado
    const existe = await ValoracionFisioterapia.findOne({
      paciente: req.body.paciente,
      codConsulta: CUPS_PISO_PELVICO
    });

    if (existe) {
      return res.status(409).json({
        error: 'VALORACION_DUPLICADA',
        mensaje: 'Este paciente ya tiene una valoración de piso pélvico.',
        valoracionExistente: { id: existe._id, fecha: existe.fechaInicioAtencion }
      });
    }

    // Mapear campos del formulario legacy al nuevo modelo unificado
    const nuevaValoracion = new ValoracionFisioterapia({
      paciente: req.body.paciente,
      fechaInicioAtencion: req.body.fecha ? new Date(req.body.fecha) : new Date(),
      codConsulta: CUPS_PISO_PELVICO,
      finalidadTecnologiaSalud: '44',
      causaMotivoAtencion: '21',
      codDiagnosticoPrincipal: req.body.codDiagnosticoPrincipal || 'N393',
      motivoConsulta: req.body.motivoConsulta || 'Evaluación de piso pélvico',
      signosVitales: {
        ta: req.body.ta,
        fr: req.body.fr,
        fc: req.body.fc,
        temperatura: req.body.temperatura,
        pesoPrevio: req.body.pesoPrevio,
        pesoActual: req.body.pesoActual,
        talla: req.body.talla,
        imc: req.body.imc
      },
      antecedentes: {
        quirurgicos: req.body.observacionesQx,
        farmacologicos: req.body.infoMedicacion,
        alergias: req.body.alergias,
        familiares: req.body.familiares,
        ginecoObstetricos: {
          embarazoAltoRiesgo: req.body.embarazoAltoRiesgo
        }
      },
      moduloPisoPelvico: {
        icicq_frecuencia: req.body.icicq_frecuencia,
        icicq_cantidad: req.body.icicq_cantidad,
        icicq_impacto: req.body.icicq_impacto,
        habitos: {
          tipoDieta: req.body.tipoDieta,
          ingestaLiquida: req.body.ingestaLiquida,
          horarioSueno: req.body.horarioSueno
        },
        evaluacionFisica: {
          dolorPerineal: req.body.dolorPerineal,
          diafragmaToracico: req.body.diafragmaToracico,
          cupulaDerecha: req.body.cupulaDerecha,
          cupulaIzquierda: req.body.cupulaIzquierda,
          oxfordGlobal: req.body.oxfordGlobal,
          perfectPower: req.body.perfectPower
        },
        evaluacionMuscular: {
          prolapso_grado: req.body['prolapso_VESICOCELE_grado'] || req.body.prolapso_grado,
          endo_presente: req.body.endo_presente
        }
      },
      examenFisico: {
        postura: req.body.postura,
        marcha: req.body.marcha,
        tonoMuscular: req.body.tonoGeneral
      },
      diagnosticoFisioterapeutico: req.body.diagnosticoFisio || 'Disfunción de piso pélvico',
      planTratamiento: req.body.planIntervencion || 'Plan de rehabilitación perineal',
      // Guardar todos los campos del formulario complejo en datos legacy para no perder nada
      _datosLegacy: req.body,
      bloqueada: req.body.bloqueada || false,
      auditTrail: req.body.auditTrail || {}
    });

    const guardada = await nuevaValoracion.save();
    res.status(201).json(guardada);
  } catch (error) {
    console.error('Error al crear valoración piso pélvico:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
});

// Obtener todas las valoraciones de piso pélvico
router.get('/', async (req, res) => {
  try {
    const { busqueda, pagina = 1, limite = 15 } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    let query = { codConsulta: CUPS_PISO_PELVICO };

    if (busqueda) {
      const Paciente = require('../models/Paciente');
      const pacientes = await Paciente.find({
        $or: [
          { nombres: { $regex: busqueda, $options: 'i' } },
          { numDocumentoIdentificacion: { $regex: busqueda, $options: 'i' } }
        ]
      }).select('_id');
      query.paciente = { $in: pacientes.map(p => p._id) };
    }

    const total = await ValoracionFisioterapia.countDocuments(query);
    const valoraciones = await ValoracionFisioterapia.find(query)
      .populate('paciente', 'nombres apellidos numDocumentoIdentificacion')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limite));

    res.json({ valoraciones, paginacion: { total, pagina: parseInt(pagina), totalPaginas: Math.ceil(total / limite) } });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error: error.message });
  }
});

// Obtener valoración por ID
router.get('/:id', async (req, res) => {
  try {
    const v = await ValoracionFisioterapia.findById(req.params.id).populate('paciente');
    if (!v) return res.status(404).json({ error: 'No encontrada' });
    res.json(v);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar valoración de piso pélvico
router.put('/:id', verificarBloqueo(ValoracionFisioterapia, 'Valoración Piso Pélvico'), bloquearBase64, async (req, res) => {
  try {
    const { generarHash } = require('../utils/auditUtils');
    const actual = await ValoracionFisioterapia.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: 'No encontrada' });

    const updateData = { ...req.body };

    // Sincronizar módulo específico con campos planos del legacy
    if (req.body.oxfordGlobal !== undefined) {
      updateData['moduloPisoPelvico.evaluacionFisica.oxfordGlobal'] = req.body.oxfordGlobal;
    }
    if (req.body.icicq_frecuencia !== undefined) {
      updateData['moduloPisoPelvico.icicq_frecuencia'] = req.body.icicq_frecuencia;
    }

    // Sello de integridad
    if (req.body.bloqueada && !actual.bloqueada) {
      updateData.fechaBloqueo = new Date();
      updateData.selloIntegridad = generarHash({ contenido: req.body, fechaBloqueo: updateData.fechaBloqueo });
    }

    const actualizada = await ValoracionFisioterapia.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({ mensaje: 'Actualizada correctamente', valoracion: actualizada });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
  }
});

// Eliminar valoración de piso pélvico
router.delete('/:id', verificarBloqueo(ValoracionFisioterapia, 'Valoración Piso Pélvico'), async (req, res) => {
  try {
    const v = await ValoracionFisioterapia.findById(req.params.id);
    if (!v) return res.status(404).json({ error: 'No encontrada' });
    await ValoracionFisioterapia.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;