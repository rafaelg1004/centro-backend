/**
 * RUTA LEGACY: /api/valoracion-ingreso-adultos-lactancia
 * 
 * Proxy de compatibilidad hacia el modelo unificado `ValoracionFisioterapia`.
 * El frontend que usa esta ruta seguirá funcionando sin cambios.
 * Internamente, todos los datos se guardan en la colección `valoracionfisioterapias`
 * con el módulo `moduloLactancia` activado.
 */
const express = require('express');
const router = express.Router();
const ValoracionFisioterapia = require('../models/ValoracionFisioterapia');
const { eliminarImagenesValoracion } = require('../utils/s3Utils');
const { verificarBloqueo } = require('../utils/hcMiddleware');

const CUPS_LACTANCIA = '890201'; // Código CUPS para valoración de lactancia

const bloquearBase64 = (req, res, next) => {
  const camposImagen = ['firmaPaciente', 'firmaAutorizacion', 'firmaFisioterapeutaPlanIntervencion', 'firmaConsentimientoLactancia'];
  for (const campo of camposImagen) {
    if (req.body[campo] && typeof req.body[campo] === 'string' && req.body[campo].startsWith('data:image')) {
      return res.status(400).json({ error: `El campo ${campo} contiene base64. Use URL de S3.` });
    }
  }
  next();
};

// Crear valoración de lactancia
router.post('/', bloquearBase64, async (req, res) => {
  try {
    if (!req.body.paciente) {
      return res.status(400).json({ error: 'El campo paciente es obligatorio' });
    }

    // Verificar duplicado para este tipo específico
    const existe = await ValoracionFisioterapia.findOne({
      paciente: req.body.paciente,
      codConsulta: CUPS_LACTANCIA,
      'moduloLactancia.experienciaLactancia': { $exists: true }
    });

    if (existe) {
      return res.status(409).json({
        error: 'VALORACION_DUPLICADA',
        mensaje: 'Este paciente ya tiene una valoración de lactancia.',
        valoracionExistente: { id: existe._id, fecha: existe.fechaInicioAtencion }
      });
    }

    // Mapear campos del formulario legacy al nuevo modelo unificado
    const nuevaValoracion = new ValoracionFisioterapia({
      paciente: req.body.paciente,
      fechaInicioAtencion: req.body.fecha ? new Date(req.body.fecha) : new Date(),
      codConsulta: CUPS_LACTANCIA,
      finalidadTecnologiaSalud: '44',
      causaMotivoAtencion: '21',
      codDiagnosticoPrincipal: req.body.codDiagnosticoPrincipal || 'Z391',
      motivoConsulta: req.body.motivoConsulta || 'Asesoría en lactancia',
      antecedentes: {
        patologicos: req.body.patologicos,
        quirurgicos: req.body.quirurgicos,
        farmacologicos: req.body.farmacologicos,
        alergias: req.body.toxicoAlergicos,
        traumaticos: req.body.traumaticos,
        ginecoObstetricos: {
          semanasGestacion: req.body.semanasGestacion,
          fum: req.body.fum
        }
      },
      moduloLactancia: {
        experienciaLactancia: req.body.experienciaLactancia,
        comoFueExperiencia: req.body.comoFueExperiencia,
        dificultadesLactancia: req.body.dificultadesLactancia,
        deseaAmamantar: req.body.deseaAmamantar,
        pechosNormales: req.body.pechosNormales,
        pechosDolorosos: req.body.pechosDolorosos,
        pechosSecrecion: req.body.pechosSecrecion,
        pechosCirugias: req.body.pechosCirugias,
        formaPezon: req.body.formaPezon,
        otraFormaPezon: req.body.otraFormaPezon
      },
      diagnosticoFisioterapeutico: req.body.afeccionesMedicas || req.body.planIntervencion || 'Evaluación de lactancia',
      planTratamiento: req.body.planIntervencion || 'Plan de lactancia',
      // Guardar todos los campos legacy en un objeto extra para no perder datos
      _datosLegacy: req.body,
      bloqueada: req.body.bloqueada || false,
      auditTrail: req.body.auditTrail || {}
    });

    const guardada = await nuevaValoracion.save();
    res.status(201).json(guardada);
  } catch (error) {
    console.error('Error al crear valoración de lactancia:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
});

// Obtener todas las valoraciones de lactancia
router.get('/', async (req, res) => {
  try {
    const { busqueda, pagina = 1, limite = 15 } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    let query = { codConsulta: CUPS_LACTANCIA };

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

// Actualizar valoración de lactancia
router.put('/:id', verificarBloqueo(ValoracionFisioterapia, 'Valoración Lactancia'), bloquearBase64, async (req, res) => {
  try {
    const { generarHash, obtenerMetadatosPista } = require('../utils/auditUtils');
    const actual = await ValoracionFisioterapia.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: 'No encontrada' });

    // Actualizar módulo de lactancia con datos del body legacy
    const updateData = { ...req.body };
    if (req.body.experienciaLactancia !== undefined) {
      updateData['moduloLactancia.experienciaLactancia'] = req.body.experienciaLactancia;
      updateData['moduloLactancia.formaPezon'] = req.body.formaPezon;
      updateData['moduloLactancia.pechosDolorosos'] = req.body.pechosDolorosos;
    }

    // Sello de integridad si se bloquea
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

// Eliminar valoración de lactancia
router.delete('/:id', verificarBloqueo(ValoracionFisioterapia, 'Valoración Lactancia'), async (req, res) => {
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