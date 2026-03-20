const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
// Modelo unificado - reemplaza todos los modelos de valoración
const ValoracionFisioterapia = require('../models/ValoracionFisioterapia');

/**
 * GET /api/valoraciones/reporte/exportar-pdf/:id
 * Exporta una valoración completa con firmas desde el backend.
 * Ahora busca en la colección única `valoracionfisioterapias`.
 */
router.get('/exportar-pdf/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    // Buscar en el modelo unificado. Usamos `+_datosLegacy` para incluir ese campo.
    const valoracion = await ValoracionFisioterapia.findById(id)
      .select('+_datosLegacy')
      .populate('paciente');

    if (!valoracion) {
      return res.status(404).json({ message: 'Valoración no encontrada' });
    }

    // Determinar el tipo de reporte según el módulo activo
    let reportType = type;
    if (!reportType) {
      if (valoracion.moduloPediatria?.desarrolloMotor) reportType = 'nino';
      else if (valoracion.moduloPisoPelvico?.icicq_frecuencia) reportType = 'adulto';
      else if (valoracion.moduloLactancia?.experienciaLactancia) reportType = 'lactancia';
      else if (valoracion.codConsulta === '890204') reportType = 'perinatal';
      else reportType = 'nino';
    }

    const paciente = valoracion.paciente || {
      nombres: valoracion.nombres || 'Paciente Desconocido',
      cedula: valoracion.numDocumentoIdentificacion || 'S/D',
      genero: valoracion.codSexo || 'N/A',
    };

    // Obtener firma y datos del profesional que genera el reporte
    let profesional = {
      nombre: 'Ft. Dayan Ivonne Villegas Gamboa',
      registroMedico: '52862625 - Reg. Salud Departamental',
      firmaUrl: null
    };
    if (req.usuario?.id) {
      try {
        const Usuario = mongoose.model('Usuario');
        const user = await Usuario.findById(req.usuario.id).select('nombre registroMedico firmaUrl');
        if (user) {
          profesional = {
            nombre: user.nombre || profesional.nombre,
            registroMedico: user.registroMedico || profesional.registroMedico,
            firmaUrl: user.firmaUrl || null
          };
        }
      } catch (e) { /* fallback a valores por defecto */ }
    }

    // Intentar cargar el generador de PDF si existe
    try {
      const pdfGenerator = require('../utils/pdfReportGenerator');
      const pdfBuffer = await pdfGenerator.generateValuationPDF(valoracion, paciente, reportType, profesional);
      const sanitizedName = (paciente.nombres || 'REPORTE').replace(/\s+/g, '_');
      const fileName = `REPORTE_${reportType.toUpperCase()}_${sanitizedName}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.send(pdfBuffer);
    } catch (pdfErr) {
      // Si el generador de PDF falla, devolver los datos en JSON para debug
      console.warn('PDF generator not available, returning JSON data:', pdfErr.message);
      res.json({ valoracion, paciente, reportType });
    }

  } catch (error) {
    console.error('Error exportando reporte PDF:', error);
    res.status(500).json({ message: 'Error interno al generar el reporte', error: error.message });
  }
});

module.exports = router;
