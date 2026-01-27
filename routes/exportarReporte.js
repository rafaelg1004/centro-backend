const express = require('express');
const router = express.Router();
const ValoracionIngreso = require('../models/ValoracionIngreso');
const ValoracionPisoPelvico = require('../models/ValoracionPisoPelvico');
const ValoracionLactancia = require('../models/ValoracionIngresoAdultosLactancia');
const ConsentimientoPerinatal = require('../models/ConsentimientoPerinatal');
const pdfGenerator = require('../utils/pdfReportGenerator');

/**
 * GET /api/valoraciones/reporte/exportar-pdf/:id
 * Exporta una valoración completa con firmas desde el backend
 */
router.get('/exportar-pdf/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'nino', 'adulto', 'lactancia', 'perinatal'

    let valoracion;
    let paciente;
    let reportType = type || 'nino';

    // 1. Intentar buscar en todos los modelos si no se especifica el tipo o falla el inicial
    if (reportType === 'nino') {
      valoracion = await ValoracionIngreso.findById(id).populate('paciente');
    } else if (reportType === 'adulto' || reportType === 'piso-pelvico') {
      valoracion = await ValoracionPisoPelvico.findById(id).populate('paciente');
      reportType = 'adulto';
    } else if (reportType === 'lactancia') {
      valoracion = await ValoracionLactancia.findById(id).populate('paciente');
    } else if (reportType === 'perinatal') {
      valoracion = await ConsentimientoPerinatal.findById(id).populate('paciente');
    }

    // Fallback: si no se encontró con el tipo dado, buscar en los demás
    if (!valoracion) {
        valoracion = await ValoracionIngreso.findById(id).populate('paciente');
        if (valoracion) reportType = 'nino';
    }
    if (!valoracion) {
        valoracion = await ValoracionPisoPelvico.findById(id).populate('paciente');
        if (valoracion) reportType = 'adulto';
    }
    if (!valoracion) {
        valoracion = await ValoracionLactancia.findById(id).populate('paciente');
        if (valoracion) reportType = 'lactancia';
    }
    if (!valoracion) {
        valoracion = await ConsentimientoPerinatal.findById(id).populate('paciente');
        if (valoracion) reportType = 'perinatal';
    }

    if (!valoracion) {
      return res.status(404).json({ message: 'Valoración no encontrada en ningún registro' });
    }

    paciente = valoracion.paciente;
    if (!paciente) {
        // En algunos casos el paciente podría estar embebido directamente (legacy o fallback)
        paciente = {
            nombres: valoracion.nombres || 'Paciente Desconocido',
            cedula: valoracion.cedula || valoracion.registroCivil || 'S/D',
            genero: valoracion.genero || 'N/A',
            fechaNacimiento: valoracion.fechaNacimiento || 'N/A',
            edad: valoracion.edad || 'N/A',
            direccion: valoracion.direccion || 'N/A',
            celular: valoracion.celular || valoracion.telefono || 'N/A'
        };
    }

    // 2. Generar el PDF
    const pdfBuffer = await pdfGenerator.generateValuationPDF(valoracion, paciente, reportType);

    // 3. Enviar respuesta
    const sanitizedName = paciente.nombres ? paciente.nombres.replace(/\s+/g, '_') : 'REPORTE';
    const fileName = `REPORTE_${reportType.toUpperCase()}_${sanitizedName}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error exportando reporte PDF:', error);
    res.status(500).json({ message: 'Error interno al generar el reporte', error: error.message });
  }
});

module.exports = router;
