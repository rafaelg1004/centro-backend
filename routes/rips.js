/**
 * Ruta para generar RIPS según Resolución 1036 de 2022
 */

const express = require('express');
const router = express.Router();
const RIPSConverter = require('../ripsConverter');
const Paciente = require('../models/Paciente');
const PacienteAdulto = require('../models/PacienteAdulto');
const ValoracionIngreso = require('../models/ValoracionIngreso');
const Clase = require('../models/Clase');
const SesionPerinatalPaciente = require('../models/SesionPerinatalPaciente');
const ValoracionPisoPelvico = require('../models/ValoracionPisoPelvico');

// Middleware de autenticación (simplificado)
const authenticate = (req, res, next) => {
  // TODO: Implementar autenticación real
  next();
};

/**
 * POST /api/rips/generate
 * Genera archivo RIPS JSON para una factura específica
 */
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { numFactura, pacienteIds, fechaInicio, fechaFin, sinFactura } = req.body;

    if (!sinFactura && !numFactura) {
      return res.status(400).json({
        success: false,
        message: 'El número de factura es obligatorio (a menos que se marque sinFactura)'
      });
    }



    console.log('📋 Generando RIPS para:', { numFactura, pacienteIds, fechaInicio, fechaFin });

    let idsParaProcesar = pacienteIds || [];

    // Si no se proporcionan IDs, buscar dinámicamente según servicios en el rango de fechas
    if (!idsParaProcesar.length && (fechaInicio || fechaFin)) {
      console.log('🔍 Buscando pacientes dinámicamente por servicios en el rango de fechas...');
      
      const fechaQuery = {
        ...(fechaInicio || fechaFin ? {
          fecha: {
            ...(fechaInicio && { $gte: fechaInicio }),
            ...(fechaFin && { $lte: fechaFin })
          }
        } : {})
      };

      const [
        valoracionesNinos,
        clases,
        sesionesAdultos,
        valoracionesAdultos
      ] = await Promise.all([
        ValoracionIngreso.find(fechaQuery).select('paciente').lean(),
        Clase.find(fechaQuery).select('ninos.paciente').lean(),
        SesionPerinatalPaciente.find(fechaQuery).select('paciente').lean(),
        ValoracionPisoPelvico.find(fechaQuery).select('paciente').lean()
      ]);

      const idsEncontrados = new Set();
      
      valoracionesNinos.forEach(v => v.paciente && idsEncontrados.add(v.paciente.toString()));
      clases.forEach(c => c.ninos.forEach(n => n.paciente && idsEncontrados.add(n.paciente.toString())));
      sesionesAdultos.forEach(s => s.paciente && idsEncontrados.add(s.paciente.toString()));
      valoracionesAdultos.forEach(v => v.paciente && idsEncontrados.add(v.paciente.toString()));

      idsParaProcesar = Array.from(idsEncontrados);
      console.log(`✅ IDs encontrados dinámicamente: ${idsParaProcesar.length}`);
    }

    if (idsParaProcesar.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron pacientes con servicios en el rango de fechas especificado'
      });
    }

    // Obtener pacientes de ambas colecciones
    const query = { _id: { $in: idsParaProcesar } };
    const pacientesNinos = await Paciente.find(query);
    const pacientesAdultos = await PacienteAdulto.find(query);

    const pacientes = [...pacientesNinos, ...pacientesAdultos];

    console.log(`🔍 Procesando ${pacientes.length} pacientes...`);

    // Preparar datos para el convertidor
    const converterData = {
      numFactura,
      sinFactura,
      pacientes: []
    };

    for (let i = 0; i < pacientes.length; i++) {
      const paciente = pacientes[i];

      // Obtener valoraciones de ingreso (solo para pacientes niños)
      let valoracionesIngreso = [];
      if (paciente.constructor.modelName === 'Paciente') {
        valoracionesIngreso = await ValoracionIngreso.find({
          paciente: paciente._id,
          ...(fechaInicio || fechaFin ? {
            fecha: {
              ...(fechaInicio && { $gte: fechaInicio }),
              ...(fechaFin && { $lte: fechaFin })
            }
          } : {})
        }).setOptions({ strictPopulate: false });
      }

      // Obtener clases asistidas (solo para pacientes niños)
      let clases = [];
      if (paciente.constructor.modelName === 'Paciente') {
        clases = await Clase.find({
          'ninos.paciente': paciente._id,
          'ninos.asistio': true,
          ...(fechaInicio || fechaFin ? {
            fecha: {
              ...(fechaInicio && { $gte: fechaInicio }),
              ...(fechaFin && { $lte: fechaFin })
            }
          } : {})
        }).setOptions({ strictPopulate: false });
      }

      // Obtener sesiones perinatales (solo para pacientes adultos)
      let sesionesPerinatales = [];
      if (paciente.constructor.modelName === 'PacienteAdulto') {
        sesionesPerinatales = await SesionPerinatalPaciente.find({
          paciente: paciente._id,
          ...(fechaInicio || fechaFin ? {
            fecha: {
              ...(fechaInicio && { $gte: fechaInicio }),
              ...(fechaFin && { $lte: fechaFin })
            }
          } : {})
        }).setOptions({ strictPopulate: false });
      }

      // Obtener valoraciones de piso pélvico (solo para pacientes adultos)
      let valoracionesPisoPelvico = [];
      if (paciente.constructor.modelName === 'PacienteAdulto') {
        valoracionesPisoPelvico = await ValoracionPisoPelvico.find({
          paciente: paciente._id,
          ...(fechaInicio || fechaFin ? {
            fecha: {
              ...(fechaInicio && { $gte: fechaInicio }),
              ...(fechaFin && { $lte: fechaFin })
            }
          } : {})
        }).setOptions({ strictPopulate: false });
      }

      // 🛑 FILTRO IMPORTANTE: Si el paciente no tiene servicios en este rango, NO incluirlo
      if (valoracionesIngreso.length === 0 && 
          clases.length === 0 && 
          sesionesPerinatales.length === 0 && 
          valoracionesPisoPelvico.length === 0) {
        // console.log(`⏩ Saltando paciente ${paciente.nombres || paciente.nombre} - Sin servicios en el rango`);
        continue;
      }

      // Mapear datos según el tipo de paciente
      let pacienteData;
      if (paciente.constructor.modelName === 'Paciente') {
        // Paciente niño
        pacienteData = {
          paciente: {
            nombres: paciente.nombres || '',
            apellidos: paciente.apellidos || '',
            tipoDocumento: paciente.tipoDocumento || 'RC',
            numeroDocumento: paciente.numeroDocumento || paciente.registroCivil || '',
            fechaNacimiento: paciente.fechaNacimiento,
            genero: paciente.genero || 'Masculino',
            regimenAfiliacion: paciente.regimenAfiliacion || 'No asegurado',
            codPaisResidencia: '170',
            codMunicipioResidencia: '23001',
            codZonaTerritorialResidencia: '01'
          },
          valoracionesIngreso: valoracionesIngreso.map(v => ({
            fecha: v.fecha,
            motivoDeConsulta: v.motivoDeConsulta,
            profesionalTratante: v.profesionalTratante,
            vrServicio: v.vrServicio || 0
          })),
          clases: clases.map(c => ({
            fecha: c.fecha,
            titulo: c.titulo,
            instructor: c.instructor,
            vrServicio: c.vrServicio || 0
          })),
          sesionesPerinatales: [],
          consecutivo: converterData.pacientes.length + 1
        };
      } else {
        // Paciente adulto
        pacienteData = {
          paciente: {
            nombres: paciente.nombres || paciente.nombre || '',
            apellidos: paciente.apellidos || '',
            tipoDocumento: paciente.tipoDocumento || paciente.cedula ? 'CC' : 'TI',
            numeroDocumento: paciente.numeroDocumento || paciente.cedula || '',
            fechaNacimiento: paciente.fechaNacimiento,
            genero: paciente.genero || paciente.sexo || 'Femenino',
            regimenAfiliacion: paciente.regimenAfiliacion || 'No asegurado',
            codPaisResidencia: '170',
            codMunicipioResidencia: '23001',
            codZonaTerritorialResidencia: '01'
          },
          valoracionesIngreso: [],
          clases: [],
          sesionesPerinatales: sesionesPerinatales.map(s => ({
            fecha: s.fecha,
            profesional: s.profesional,
            vrServicio: s.vrServicio || 0
          })),
          valoracionesPisoPelvico: valoracionesPisoPelvico.map(v => ({
            fecha: v.fecha,
            motivoConsulta: v.motivoConsulta,
            diagnosticoFisio: v.diagnosticoFisio,
            vrServicio: v.vrServicio || 0
          })),
          consecutivo: converterData.pacientes.length + 1
        };
      }

      converterData.pacientes.push(pacienteData);
    }

    // Convertir a formato RIPS
    const converter = new RIPSConverter();
    const resultado = await converter.convertToRIPS(converterData);

    if (!resultado.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación en la generación de RIPS',
        errors: resultado.validationErrors,
        warnings: resultado.validationWarnings
      });
    }

    // Retornar resultado
    res.json({
      success: true,
      message: 'RIPS generado exitosamente',
      data: {
        rips: resultado.rips,
        resumen: {
          usuariosProcesados: resultado.rips.usuarios.length,
          serviciosTecnologicos: resultado.rips.serviciosTecnologias.length,
          totalConsultas: resultado.rips.serviciosTecnologias.reduce((sum, s) => sum + s.consultas.length, 0),
          totalProcedimientos: resultado.rips.serviciosTecnologias.reduce((sum, s) => sum + s.procedimientos.length, 0)
        },
        warnings: resultado.validationWarnings
      }
    });

  } catch (error) {
    console.error('Error generando RIPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al generar RIPS',
      error: error.message
    });
  }
});

/**
 * GET /api/rips/validate
 * Valida la estructura de un archivo RIPS
 */
router.post('/validate', authenticate, async (req, res) => {
  try {
    const { ripsData } = req.body;

    if (!ripsData) {
      return res.status(400).json({
        success: false,
        message: 'Los datos RIPS son obligatorios'
      });
    }

    const converter = new RIPSConverter();

    // Simular conversión para validar
    const resultado = await converter.convertToRIPS({
      numFactura: ripsData.numFactura || 'VALIDATION-001',
      pacientes: [] // No necesitamos pacientes para validación básica
    });

    // Validar estructura específica
    converter.validateRIPS(ripsData);

    res.json({
      success: true,
      message: 'Validación completada',
      data: {
        isValid: converter.validationErrors.length === 0,
        errors: converter.validationErrors,
        warnings: converter.validationWarnings
      }
    });

  } catch (error) {
    console.error('Error validando RIPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al validar RIPS',
      error: error.message
    });
  }
});

/**
 * GET /api/rips/config
 * Obtiene configuración necesaria para RIPS
 */
router.get('/config', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      nitFacturador: process.env.NIT_FACTURADOR || '2300101133',
      codPrestador: process.env.COD_PRESTADOR || '230010113301',
      nombrePrestador: 'Dayan Ivonne Villegas Gamboa',
      versionResolucion: 'Resolución 2275 de 2023 (Sin Factura)',
      formatosFecha: ['AAAA-MM-DD HH:MM'],
      tiposUsuario: {
        '01': 'Cotizante',
        '02': 'Beneficiario',
        '03': 'Especial',
        '04': 'No asegurado'
      },
      tiposDocumento: {
        'CC': 'Cédula ciudadanía',
        'TI': 'Tarjeta identidad',
        'RC': 'Registro civil',
        'CE': 'Cédula extranjería',
        'PA': 'Pasaporte',
        'PE': 'Permiso especial',
        'CN': 'Certificado nacido vivo',
        'MS': 'Menor sin identificar'
      }
    }
  });
});

module.exports = router;