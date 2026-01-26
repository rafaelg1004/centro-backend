/**
 * Rutas CRUD para gestión de códigos CUPS
 * Resolución 1036 de 2022 - Ministerio de Salud Colombia
 */

const express = require('express');
const router = express.Router();
const CodigoCUPS = require('../models/CodigoCUPS');
const ripsConfig = require('../ripsConfig');

// Middleware de autenticación (simplificado)
const authenticate = (req, res, next) => {
  // TODO: Implementar autenticación real
  next();
};

/**
 * GET /api/cups
 * Obtener todos los códigos CUPS
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { activo, categoria, tipoServicio } = req.query;

    const filtro = {};
    if (activo !== undefined) filtro.activo = activo === 'true';
    if (categoria) filtro.categoria = categoria;
    if (tipoServicio) filtro.tipoServicio = tipoServicio;

    const codigos = await CodigoCUPS.find(filtro).sort({ categoria: 1, nombre: 1 });

    res.json({
      success: true,
      data: codigos,
      total: codigos.length
    });
  } catch (error) {
    console.error('Error obteniendo códigos CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener códigos CUPS',
      error: error.message
    });
  }
});

/**
 * GET /api/cups/:id
 * Obtener un código CUPS por ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const codigo = await CodigoCUPS.findById(req.params.id);

    if (!codigo) {
      return res.status(404).json({
        success: false,
        message: 'Código CUPS no encontrado'
      });
    }

    res.json({
      success: true,
      data: codigo
    });
  } catch (error) {
    console.error('Error obteniendo código CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener código CUPS',
      error: error.message
    });
  }
});

/**
 * POST /api/cups
 * Crear un nuevo código CUPS
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      tipoServicio,
      categoria,
      valor,
      finalidad,
      diagnosticoCIE,
      grupoServicio,
      modalidad,
      claveInterna
    } = req.body;

    // Validar campos requeridos
    if (!codigo || !nombre || !tipoServicio || !categoria) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: codigo, nombre, tipoServicio, categoria'
      });
    }

    // Verificar que el código no exista
    const existente = await CodigoCUPS.findOne({ codigo });
    if (existente) {
      return res.status(400).json({
        success: false,
        message: `El código CUPS ${codigo} ya existe`
      });
    }

    const nuevoCodigo = new CodigoCUPS({
      codigo,
      nombre,
      descripcion,
      tipoServicio,
      categoria,
      valor: valor || 0,
      finalidad: finalidad || '11',
      diagnosticoCIE: diagnosticoCIE || 'Z51.4',
      grupoServicio: grupoServicio || '04',
      modalidad: modalidad || '01',
      claveInterna
    });

    await nuevoCodigo.save();

    res.status(201).json({
      success: true,
      message: 'Código CUPS creado exitosamente',
      data: nuevoCodigo
    });
  } catch (error) {
    console.error('Error creando código CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear código CUPS',
      error: error.message
    });
  }
});

/**
 * PUT /api/cups/:id
 * Actualizar un código CUPS
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      tipoServicio,
      categoria,
      valor,
      finalidad,
      diagnosticoCIE,
      grupoServicio,
      modalidad,
      activo,
      claveInterna
    } = req.body;

    const codigoExistente = await CodigoCUPS.findById(req.params.id);

    if (!codigoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Código CUPS no encontrado'
      });
    }

    // Si se cambia el código, verificar que no exista otro con el mismo
    if (codigo && codigo !== codigoExistente.codigo) {
      const duplicado = await CodigoCUPS.findOne({ codigo });
      if (duplicado) {
        return res.status(400).json({
          success: false,
          message: `El código CUPS ${codigo} ya existe`
        });
      }
    }

    // Actualizar campos
    if (codigo) codigoExistente.codigo = codigo;
    if (nombre) codigoExistente.nombre = nombre;
    if (descripcion !== undefined) codigoExistente.descripcion = descripcion;
    if (tipoServicio) codigoExistente.tipoServicio = tipoServicio;
    if (categoria) codigoExistente.categoria = categoria;
    if (valor !== undefined) codigoExistente.valor = valor;
    if (finalidad) codigoExistente.finalidad = finalidad;
    if (diagnosticoCIE) codigoExistente.diagnosticoCIE = diagnosticoCIE;
    if (grupoServicio) codigoExistente.grupoServicio = grupoServicio;
    if (modalidad) codigoExistente.modalidad = modalidad;
    if (activo !== undefined) codigoExistente.activo = activo;
    if (claveInterna !== undefined) codigoExistente.claveInterna = claveInterna;

    await codigoExistente.save();

    res.json({
      success: true,
      message: 'Código CUPS actualizado exitosamente',
      data: codigoExistente
    });
  } catch (error) {
    console.error('Error actualizando código CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar código CUPS',
      error: error.message
    });
  }
});

/**
 * DELETE /api/cups/:id
 * Eliminar un código CUPS (soft delete - desactivar)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const codigo = await CodigoCUPS.findById(req.params.id);

    if (!codigo) {
      return res.status(404).json({
        success: false,
        message: 'Código CUPS no encontrado'
      });
    }

    // Soft delete - solo desactivar
    codigo.activo = false;
    await codigo.save();

    res.json({
      success: true,
      message: 'Código CUPS desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando código CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar código CUPS',
      error: error.message
    });
  }
});

/**
 * POST /api/cups/seed
 * Cargar códigos CUPS iniciales desde ripsConfig.js
 */
router.post('/seed', authenticate, async (req, res) => {
  try {
    const codigosIniciales = [];

    // Mapear códigos CUPS desde ripsConfig
    const { codigosCUPS, valoresServicios, finalidades, diagnosticosCIE } = ripsConfig;

    // Consultas
    codigosIniciales.push({
      codigo: codigosCUPS.consultaGeneral,
      nombre: 'Consulta de Fisioterapia General',
      descripcion: 'Consulta de fisioterapia general',
      tipoServicio: 'consulta',
      categoria: 'fisioterapia',
      valor: valoresServicios.consultaGeneral,
      finalidad: finalidades.consultaGeneral,
      diagnosticoCIE: diagnosticosCIE.fisioterapiaGeneral,
      grupoServicio: '01',
      modalidad: '09',
      claveInterna: 'consultaGeneral'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.consultaPrenatal,
      nombre: 'Consulta Prenatal',
      descripcion: 'Consulta de fisioterapia prenatal',
      tipoServicio: 'consulta',
      categoria: 'prenatal',
      valor: valoresServicios.consultaPrenatal,
      finalidad: finalidades.consultaPrenatal,
      diagnosticoCIE: diagnosticosCIE.embarazo,
      grupoServicio: '01',
      modalidad: '09',
      claveInterna: 'consultaPrenatal'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.consultaPostnatal,
      nombre: 'Consulta Postnatal',
      descripcion: 'Consulta de fisioterapia postnatal',
      tipoServicio: 'consulta',
      categoria: 'postnatal',
      valor: valoresServicios.consultaPostnatal,
      finalidad: finalidades.consultaPostnatal,
      diagnosticoCIE: diagnosticosCIE.parto,
      grupoServicio: '01',
      modalidad: '09',
      claveInterna: 'consultaPostnatal'
    });

    // Procedimientos
    codigosIniciales.push({
      codigo: codigosCUPS.terapiaFisicaIndividual,
      nombre: 'Terapia Física Individual',
      descripcion: 'Sesión de terapia física individual',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: valoresServicios.terapiaFisicaIndividual,
      finalidad: finalidades.terapiaFisica,
      diagnosticoCIE: diagnosticosCIE.fisioterapiaGeneral,
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'terapiaFisicaIndividual'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.terapiaFisicaGrupal,
      nombre: 'Terapia Física Grupal',
      descripcion: 'Sesión de terapia física grupal',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: valoresServicios.terapiaFisicaGrupal,
      finalidad: finalidades.terapiaFisica,
      diagnosticoCIE: diagnosticosCIE.fisioterapiaGeneral,
      grupoServicio: '04',
      modalidad: '02',
      claveInterna: 'terapiaFisicaGrupal'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.preparacionParto,
      nombre: 'Preparación para el Parto',
      descripcion: 'Sesión de preparación para el parto',
      tipoServicio: 'procedimiento',
      categoria: 'prenatal',
      valor: valoresServicios.preparacionParto,
      finalidad: finalidades.preparacionParto,
      diagnosticoCIE: diagnosticosCIE.embarazo,
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'preparacionParto'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.reeducacionPisoPelvis,
      nombre: 'Reeducación del Piso Pélvico',
      descripcion: 'Tratamiento de reeducación del piso pélvico',
      tipoServicio: 'procedimiento',
      categoria: 'pisoPelvico',
      valor: valoresServicios.reeducacionPisoPelvis,
      finalidad: finalidades.pisoPelvis,
      diagnosticoCIE: diagnosticosCIE.incontinenciaUrinaria,
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'reeducacionPisoPelvis'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.masajeTerapeutico,
      nombre: 'Masaje Terapéutico',
      descripcion: 'Sesión de masaje terapéutico',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: valoresServicios.masajeTerapeutico,
      finalidad: finalidades.masaje,
      diagnosticoCIE: diagnosticosCIE.fisioterapiaGeneral,
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'masajeTerapeutico'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.electroterapia,
      nombre: 'Electroterapia',
      descripcion: 'Sesión de electroterapia',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: valoresServicios.electroterapia,
      finalidad: finalidades.electroterapia,
      diagnosticoCIE: diagnosticosCIE.fisioterapiaGeneral,
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'electroterapia'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.hidroterapia,
      nombre: 'Hidroterapia',
      descripcion: 'Sesión de hidroterapia',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: valoresServicios.hidroterapia,
      finalidad: finalidades.hidroterapia,
      diagnosticoCIE: diagnosticosCIE.fisioterapiaGeneral,
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'hidroterapia'
    });

    // Valoraciones
    codigosIniciales.push({
      codigo: codigosCUPS.valoracionInicial,
      nombre: 'Valoración Inicial',
      descripcion: 'Valoración inicial de fisioterapia',
      tipoServicio: 'valoracion',
      categoria: 'fisioterapia',
      valor: valoresServicios.valoracionInicial,
      finalidad: finalidades.consultaGeneral,
      diagnosticoCIE: diagnosticosCIE.fisioterapiaGeneral,
      grupoServicio: '01',
      modalidad: '09',
      claveInterna: 'valoracionInicial'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.valoracionPisoPelvis,
      nombre: 'Valoración de Piso Pélvico',
      descripcion: 'Valoración especializada de piso pélvico',
      tipoServicio: 'valoracion',
      categoria: 'pisoPelvico',
      valor: valoresServicios.valoracionPisoPelvis,
      finalidad: finalidades.pisoPelvis,
      diagnosticoCIE: diagnosticosCIE.incontinenciaUrinaria,
      grupoServicio: '01',
      modalidad: '09',
      claveInterna: 'valoracionPisoPelvis'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.valoracionLactancia,
      nombre: 'Valoración de Lactancia',
      descripcion: 'Valoración y asesoría en lactancia',
      tipoServicio: 'valoracion',
      categoria: 'lactancia',
      valor: valoresServicios.valoracionLactancia,
      finalidad: finalidades.consultaLactancia,
      diagnosticoCIE: diagnosticosCIE.problemasLactancia,
      grupoServicio: '01',
      modalidad: '09',
      claveInterna: 'valoracionLactancia'
    });

    // --- Nuevos Códigos Fisiatría/Pediatría/Obstetricia (Res. 2706 de 2025) ---

    // Consultas
    codigosIniciales.push({
      codigo: codigosCUPS.consultaFisiatriaPrimeraVez,
      nombre: 'Consulta 1ra Vez - Medicina Física y Rehabilitación',
      descripcion: 'CONSULTA DE PRIMERA VEZ POR ESPECIALISTA EN MEDICINA FÍSICA Y REHABILITACIÓN',
      tipoServicio: 'consulta',
      categoria: 'general',
      valor: 0,
      finalidad: '11',
      diagnosticoCIE: 'Z00.0',
      grupoServicio: '01',
      modalidad: '01',
      claveInterna: 'consultaFisiatriaPrimeraVez'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.consultaFisiatriaControl,
      nombre: 'Consulta Control - Medicina Física y Rehabilitación',
      descripcion: 'CONSULTA DE CONTROL O DE SEGUIMIENTO POR ESPECIALISTA EN MEDICINA FÍSICA Y REHABILITACIÓN',
      tipoServicio: 'consulta',
      categoria: 'general',
      valor: 0,
      finalidad: '11',
      diagnosticoCIE: 'Z00.0',
      grupoServicio: '01',
      modalidad: '01',
      claveInterna: 'consultaFisiatriaControl'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.juntaMedica,
      nombre: 'Junta Médica Especializada',
      descripcion: 'PARTICIPACIÓN EN JUNTA MÉDICA, POR MEDICINA ESPECIALIZADA Y CASO',
      tipoServicio: 'consulta',
      categoria: 'pediatria',
      valor: 0,
      finalidad: '11',
      diagnosticoCIE: 'Z00.0',
      grupoServicio: '01',
      modalidad: '01',
      claveInterna: 'juntaMedica'
    });

    // Pediatría y Rehabilitación
    codigosIniciales.push({
      codigo: codigosCUPS.toxinaBotulinica,
      nombre: 'Inyección Toxina Botulínica',
      descripcion: 'INYECCIÓN DE MATERIAL MIORELAJANTE (TOXINA BOTULÍNICA)',
      tipoServicio: 'procedimiento',
      categoria: 'pediatria',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'G80.9',
      grupoServicio: '03',
      modalidad: '01',
      claveInterna: 'toxinaBotulinica'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.integracionSensorial,
      nombre: 'Terapia de Integración Sensorial',
      descripcion: 'TERAPIA DE INTEGRACIÓN SENSORIAL SOD',
      tipoServicio: 'procedimiento',
      categoria: 'pediatria',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'F84.0',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'integracionSensorial'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.evaluacionOsteomuscular,
      nombre: 'Evaluación Osteomuscular',
      descripcion: 'EVALUACIÓN DE FUNCIÓN OSTEOMUSCULAR SOD',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'Z00.0',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'evaluacionOsteomuscular'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.pruebaCognitiva,
      nombre: 'Prueba Cognitiva',
      descripcion: 'PRUEBA COGNITIVA',
      tipoServicio: 'procedimiento',
      categoria: 'pediatria',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'R62.0',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'pruebaCognitiva'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.rxPanoramicaMInf,
      nombre: 'Radiografía Panorámica M. Infantiles',
      descripcion: 'RADIOGRAFÍA PANORÁMICA DE MIEMBROS INFERIORES (NIÑOS)',
      tipoServicio: 'procedimiento',
      categoria: 'pediatria',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'M00.0',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'rxPanoramicaMInf'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.tecnologiaRehabilitacion,
      nombre: 'Entrenamiento Tecnología Rehabilitación',
      descripcion: 'DISEÑO, ADECUACIÓN Y ENTRENAMIENTO EN USO DE TECNOLOGÍA DE REHABILITACIÓN SOD',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'Z50.1',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'tecnologiaRehabilitacion'
    });

    // Obstetricia/Piso Pélvico
    codigosIniciales.push({
      codigo: codigosCUPS.ecoPisoPelvico,
      nombre: 'Ecografía Dinámica Piso Pélvico',
      descripcion: 'ECOGRAFÍA DINÁMICA DE PISO PÉLVICO',
      tipoServicio: 'procedimiento',
      categoria: 'pisoPelvico',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'N39.3',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'ecoPisoPelvico'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.ecoPelvicaGinecologica,
      nombre: 'Ecografía Pélvica Ginecológica',
      descripcion: 'ECOGRAFÍA PÉLVICA GINECOLÓGICA',
      tipoServicio: 'procedimiento',
      categoria: 'pisoPelvico',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'N81.9',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'ecoPelvicaGinecologica'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.terapiaFisicaSOD,
      nombre: 'Terapia Física SOD',
      descripcion: 'TERAPIA FÍSICA SOD',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'M54.5',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'terapiaFisicaSOD'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.rehabDeficienciaLeve,
      nombre: 'Rehab. Deficiencia Leve',
      descripcion: 'REHABILITACIÓN FUNCIONAL DE LA DEFICIENCIA/DISCAPACIDAD TRANSITORIA LEVE',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'Z50.1',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'rehabDeficienciaLeve'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.rehabDeficienciaModerada,
      nombre: 'Rehab. Deficiencia Moderada',
      descripcion: 'REHABILITACIÓN FUNCIONAL DE LA DEFICIENCIA/DISCAPACIDAD TRANSITORIA MODERADA',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'Z50.1',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'rehabDeficienciaModerada'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.rehabDeficienciaSevera,
      nombre: 'Rehab. Deficiencia Severa',
      descripcion: 'REHABILITACIÓN FUNCIONAL DE LA DEFICIENCIA/DISCAPACIDAD TRANSITORIA SEVERA',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'Z50.1',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'rehabDeficienciaSevera'
    });

    codigosIniciales.push({
      codigo: codigosCUPS.rehabDeficienciaDefinitiva,
      nombre: 'Rehab. Deficiencia Definitiva Leve',
      descripcion: 'REHABILITACIÓN FUNCIONAL DE LA DEFICIENCIA/DISCAPACIDAD DEFINITIVA LEVE',
      tipoServicio: 'procedimiento',
      categoria: 'fisioterapia',
      valor: 0,
      finalidad: '44',
      diagnosticoCIE: 'Z50.1',
      grupoServicio: '04',
      modalidad: '01',
      claveInterna: 'rehabDeficienciaDefinitiva'
    });

    // Insertar códigos (upsert para evitar duplicados)
    let insertados = 0;
    let actualizados = 0;

    for (const codigoData of codigosIniciales) {
      const existente = await CodigoCUPS.findOne({ codigo: codigoData.codigo });

      if (existente) {
        // Actualizar existente
        Object.assign(existente, codigoData);
        await existente.save();
        actualizados++;
      } else {
        // Crear nuevo
        const nuevo = new CodigoCUPS(codigoData);
        await nuevo.save();
        insertados++;
      }
    }

    res.json({
      success: true,
      message: `Seed completado: ${insertados} códigos creados, ${actualizados} actualizados`,
      data: {
        insertados,
        actualizados,
        total: codigosIniciales.length
      }
    });
  } catch (error) {
    console.error('Error en seed de códigos CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar códigos CUPS iniciales',
      error: error.message
    });
  }
});

/**
 * GET /api/cups/buscar/:clave
 * Buscar código por clave interna
 */
router.get('/buscar/:clave', authenticate, async (req, res) => {
  try {
    const codigo = await CodigoCUPS.obtenerPorClave(req.params.clave);

    if (!codigo) {
      return res.status(404).json({
        success: false,
        message: `No se encontró código con clave: ${req.params.clave}`
      });
    }

    res.json({
      success: true,
      data: codigo
    });
  } catch (error) {
    console.error('Error buscando código CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar código CUPS',
      error: error.message
    });
  }
});

module.exports = router;
