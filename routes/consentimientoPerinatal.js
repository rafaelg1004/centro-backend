/**
 * RUTA LEGACY: /api/consentimientos-perinatales
 * 
 * Proxy de compatibilidad hacia el modelo unificado `ValoracionFisioterapia`.
 * Los consentimientos perinatales son una valoración fisica de tipo Perinatal.
 */
const express = require("express");
const router = express.Router();
const ValoracionFisioterapia = require("../models/ValoracionFisioterapia");
const { eliminarImagenesValoracion } = require('../utils/s3Utils');
const { verificarBloqueo } = require('../utils/hcMiddleware');
const logger = require('../utils/logger');

const CUPS_PERINATAL = '890204'; // Código CUPS para evaluación perinatal/prenatal

const bloquearBase64 = (req, res, next) => {
  const camposImagen = [
    'firmaPaciente', 'firmaFisioterapeuta', 'firmaAutorizacion',
    'firmaPacienteConsentimiento', 'firmaPacienteGeneral'
  ];
  for (const campo of camposImagen) {
    if (req.body[campo] && typeof req.body[campo] === 'string' && req.body[campo].startsWith('data:image')) {
      return res.status(400).json({ error: `El campo ${campo} contiene base64. Use URL de S3.` });
    }
  }
  // Verificar en arrays de sesiones
  if (req.body.sesiones && Array.isArray(req.body.sesiones)) {
    for (let i = 0; i < req.body.sesiones.length; i++) {
      if (req.body.sesiones[i].firmaPaciente?.startsWith('data:image')) {
        return res.status(400).json({ error: `sesiones[${i}].firmaPaciente contiene base64.` });
      }
    }
  }
  next();
};

// Crear consentimiento perinatal
router.post("/", bloquearBase64, async (req, res) => {
  try {
    if (!req.body.paciente) {
      return res.status(400).json({ error: "El campo paciente es obligatorio" });
    }

    // Verificar duplicado
    const existe = await ValoracionFisioterapia.findOne({
      paciente: req.body.paciente,
      codConsulta: CUPS_PERINATAL
    });

    if (existe) {
      return res.status(409).json({
        error: 'VALORACION_DUPLICADA',
        mensaje: 'Este paciente ya tiene un consentimiento perinatal.',
        valoracionExistente: { id: existe._id, fecha: existe.fechaInicioAtencion }
      });
    }

    const nuevaValoracion = new ValoracionFisioterapia({
      paciente: req.body.paciente,
      fechaInicioAtencion: req.body.fecha ? new Date(req.body.fecha) : new Date(),
      codConsulta: CUPS_PERINATAL,
      finalidadTecnologiaSalud: '44',
      causaMotivoAtencion: '21',
      codDiagnosticoPrincipal: req.body.codDiagnosticoPrincipal || 'Z348',
      motivoConsulta: req.body.motivoConsulta || 'Evaluación perinatal',
      antecedentes: {
        quirurgicos: req.body.quirurgicos,
        farmacologicos: req.body.farmacologicos,
        alergias: req.body.toxicoAlergicos,
        traumaticos: req.body.traumaticos,
        ginecoObstetricos: {
          embarazoAltoRiesgo: req.body.embarazoAltoRiesgo,
          diabetesNoControlada: req.body.diabetesNoControlada,
          historiaAborto: req.body.historiaAborto,
          semanasGestacion: req.body.semanasGestacion
        }
      },
      diagnosticoFisioterapeutico: req.body.diagnosticoFisioterapeutico || 'Evaluación perinatal',
      planTratamiento: req.body.planIntervencion || 'Programa perinatal',
      // Guardar datos legacy completos (formulario es muy extenso)
      _datosLegacy: req.body,
      bloqueada: req.body.bloqueada || false,
      auditTrail: req.body.auditTrail || {}
    });

    const guardada = await nuevaValoracion.save();
    res.status(201).json(guardada);
  } catch (error) {
    console.error('Error al crear consentimiento:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
});

// Obtener todos los consentimientos
router.get("/", async (req, res) => {
  try {
    const { busqueda, pagina = 1, limite = 15 } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    let query = { codConsulta: CUPS_PERINATAL };

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

    res.json(valoraciones);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener consentimientos', error: error.message });
  }
});

// Obtener consentimientos de un paciente adulto específico
router.get("/paciente/:pacienteId", async (req, res) => {
  try {
    const valoraciones = await ValoracionFisioterapia.find({
      paciente: req.params.pacienteId,
      codConsulta: CUPS_PERINATAL
    }).populate('paciente').sort({ createdAt: -1 });
    res.json(valoraciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener consentimiento por ID
router.get("/:id", async (req, res) => {
  try {
    const v = await ValoracionFisioterapia.findById(req.params.id).populate('paciente');
    if (!v) return res.status(404).json({ error: "No encontrado" });
    res.json(v);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar consentimiento
router.put("/:id", verificarBloqueo(ValoracionFisioterapia, 'Consentimiento Perinatal'), bloquearBase64, async (req, res) => {
  try {
    const { generarHash, obtenerMetadatosPista } = require('../utils/auditUtils');
    const actual = await ValoracionFisioterapia.findById(req.params.id);
    if (!actual) return res.status(404).json({ error: "No encontrado" });

    const updateData = { ...req.body };

    // Seguimiento de firmas y auditoría
    if (!updateData.auditTrail) updateData.auditTrail = actual.auditTrail || {};
    const camposFirma = ['firmaPaciente', 'firmaFisioterapeuta', 'firmaPacienteGeneral'];
    for (const campo of camposFirma) {
      if (req.body[campo] && req.body[campo] !== actual._datosLegacy?.[campo]) {
        updateData.auditTrail[campo] = obtenerMetadatosPista(req);
      }
    }

    // También guardar en _datosLegacy
    if (actual._datosLegacy) {
      updateData._datosLegacy = { ...actual._datosLegacy, ...req.body };
    }

    // Sello de integridad
    if (req.body.bloqueada && !actual.bloqueada) {
      updateData.fechaBloqueo = new Date();
      updateData.selloIntegridad = generarHash({ contenido: req.body, fechaBloqueo: updateData.fechaBloqueo });
    }

    const actualizado = await ValoracionFisioterapia.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({ mensaje: "Actualizado correctamente", consentimiento: actualizado });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar", error: error.message });
  }
});

// Eliminar consentimiento
router.delete("/:id", verificarBloqueo(ValoracionFisioterapia, 'Consentimiento Perinatal'), async (req, res) => {
  try {
    const v = await ValoracionFisioterapia.findById(req.params.id);
    if (!v) return res.status(404).json({ error: "No encontrado" });
    await ValoracionFisioterapia.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;