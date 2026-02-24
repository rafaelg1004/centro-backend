/**
 * Ruta para generar RIPS según Resolución 1036 de 2022
 */

const express = require('express');
const router = express.Router();
const RIPSConverter = require('../ripsConverter');
const Paciente = require('../models/Paciente');
const ValoracionFisioterapia = require('../models/ValoracionFisioterapia');
const EvolucionSesion = require('../models/EvolucionSesion');
const Clase = require('../models/Clase');

// Middleware de autenticación (ya viene manejado desde index.js con verificarToken, pero mantenemos referencia por si se usa req.user)
const authenticate = (req, res, next) => {
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

      const rangeQuery = {
        ...(fechaInicio && { $gte: new Date(fechaInicio) }),
        ...(fechaFin && { $lte: new Date(fechaFin) })
      };

      const fechaQueryAtencion = Object.keys(rangeQuery).length > 0 ? { fechaInicioAtencion: rangeQuery } : {};

      // Para Clase, la fecha es string AAAA-MM-DD
      const rangeQueryString = {
        ...(fechaInicio && { $gte: fechaInicio }),
        ...(fechaFin && { $lte: fechaFin })
      };
      const fechaQueryClase = Object.keys(rangeQueryString).length > 0 ? { fecha: rangeQueryString } : {};

      const [
        valoraciones,
        clases,
        evoluciones
      ] = await Promise.all([
        ValoracionFisioterapia.find(fechaQueryAtencion).select('paciente').lean(),
        Clase.find(fechaQueryClase).select('ninos.paciente').lean(),
        EvolucionSesion.find(fechaQueryAtencion).select('paciente').lean()
      ]);

      const idsEncontrados = new Set();

      valoraciones.forEach(v => v.paciente && idsEncontrados.add(v.paciente.toString()));
      clases.forEach(c => c.ninos.forEach(n => n.paciente && idsEncontrados.add(n.paciente.toString())));
      evoluciones.forEach(s => s.paciente && idsEncontrados.add(s.paciente.toString()));

      idsParaProcesar = Array.from(idsEncontrados);
      console.log(`✅ IDs encontrados dinámicamente: ${idsParaProcesar.length}`);
    }

    if (idsParaProcesar.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron pacientes con servicios en el rango de fechas especificado'
      });
    }

    // Obtener pacientes (Todos están en la colección Paciente)
    const query = { _id: { $in: idsParaProcesar } };
    const pacientes = await Paciente.find(query);

    console.log(`🔍 Procesando ${pacientes.length} pacientes...`);

    // Preparar datos para el convertidor
    const converterData = {
      numFactura,
      sinFactura,
      pacientes: []
    };

    for (let i = 0; i < pacientes.length; i++) {
      const paciente = pacientes[i];
      const isKid = ['RC', 'TI', 'CN'].includes(paciente.tipoDocumentoIdentificacion);

      const rangeQuery = {
        ...(fechaInicio && { $gte: new Date(fechaInicio) }),
        ...(fechaFin && { $lte: new Date(fechaFin) })
      };
      const fechaQueryAtencion = Object.keys(rangeQuery).length > 0 ? { fechaInicioAtencion: rangeQuery } : {};

      // Obtener valoraciones
      const valoraciones = await ValoracionFisioterapia.find({
        paciente: paciente._id,
        ...fechaQueryAtencion
      }).setOptions({ strictPopulate: false });

      // Obtener clases asistidas
      const rangeQueryString = {
        ...(fechaInicio && { $gte: fechaInicio }),
        ...(fechaFin && { $lte: fechaFin })
      };
      const fechaQueryClase = Object.keys(rangeQueryString).length > 0 ? { fecha: rangeQueryString } : {};

      const clasesAsistidas = await Clase.find({
        'ninos.paciente': paciente._id,
        // 'ninos.asistio': true, // Nota: el modelo Clase actual no parece tener asistio, sino solo presencia en la lista
        ...fechaQueryClase
      }).setOptions({ strictPopulate: false });

      // Obtener evoluciones/sesiones
      const sesiones = await EvolucionSesion.find({
        paciente: paciente._id,
        ...fechaQueryAtencion
      }).setOptions({ strictPopulate: false });

      // 🛑 FILTRO IMPORTANTE: Si el paciente no tiene servicios en este rango, NO incluirlo
      if (valoraciones.length === 0 && clasesAsistidas.length === 0 && sesiones.length === 0) {
        continue;
      }

      // Mapear datos unificados
      const pacienteData = {
        paciente: {
          nombres: paciente.nombres || '',
          apellidos: paciente.apellidos || '',
          tipoDocumento: paciente.tipoDocumentoIdentificacion || (isKid ? 'RC' : 'CC'),
          numeroDocumento: paciente.numDocumentoIdentificacion || '',
          fechaNacimiento: paciente.fechaNacimiento,
          genero: paciente.codSexo === 'M' ? 'Masculino' : 'Femenino',
          regimenAfiliacion: paciente.tipoUsuario === '04' ? 'No asegurado' : 'Contributivo',
          codPaisResidencia: paciente.codPaisResidencia || '170',
          codMunicipioResidencia: paciente.codMunicipioResidencia || '23001',
          codZonaTerritorialResidencia: paciente.codZonaTerritorialResidencia || '01'
        },
        valoracionesIngreso: valoraciones.map(v => ({
          fecha: v.fechaInicioAtencion,
          motivoDeConsulta: v.motivoConsulta,
          profesionalTratante: {
            nombre: v.firmas?.profesional?.nombre || 'Dayan Villegas',
            numeroDocumento: v.firmas?.profesional?.registroMedico || '00000000'
          },
          vrServicio: v.vrServicio || 0
        })),
        clases: clasesAsistidas.map(c => ({
          fecha: c.fecha,
          titulo: c.nombre || 'Clase de Estimulación',
          instructor: 'Dayan Villegas',
          vrServicio: 0 // Las clases suelen estar en paquetes
        })),
        sesionesPerinatales: sesiones.map(s => ({
          fecha: s.fechaInicioAtencion,
          profesional: s.firmas?.profesional?.nombre || 'Dayan Villegas',
          vrServicio: s.vrServicio || 0
        })),
        valoracionesPisoPelvico: [], // En el nuevo modelo, todas son valoracionesIngreso mapeadas arriba
        consecutivo: converterData.pacientes.length + 1
      };

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