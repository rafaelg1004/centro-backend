/**
 * Configuración de RIPS - Centro de Estimulación Mamitas
 * Códigos CUPS y valores de servicios según especialidad en fisioterapia perinatal
 */

const ripsConfig = {
  // Información del prestador
  prestador: {
    nit: process.env.NIT_FACTURADOR || '901234567',
    codPrestador: process.env.COD_PRESTADOR || '500000000002',
    nombre: 'Centro de Estimulación Mamitas',
    especialidad: 'Fisioterapia Perinatal'
  },

  // Códigos CUPS para fisioterapia perinatal
  codigosCUPS: {
    // Consultas
    consultaGeneral: '890201', // Consulta de fisioterapia general
    consultaPrenatal: '890201', // Consulta prenatal
    consultaPostnatal: '890201', // Consulta postnatal

    // Procedimientos - Fisioterapia
    terapiaFisicaIndividual: '895100', // Terapia física individual
    terapiaFisicaGrupal: '895101', // Terapia física grupal
    preparacionParto: '894301', // Preparación para el parto
    reeducacionPisoPelvis: '895201', // Reeducación del piso pélvico
    masajeTerapeutico: '895301', // Masaje terapéutico
    electroterapia: '895401', // Electroterapia
    termoterapia: '895501', // Termoterapia
    hidroterapia: '895601', // Hidroterapia
    mecanoterapia: '895701', // Mecanoterapia

    // Valoraciones específicas
    valoracionInicial: '890101', // Valoración inicial
    valoracionPisoPelvis: '890102', // Valoración piso pélvico
    valoracionLactancia: '890103' // Valoración lactancia
  },

  // Valores de servicios (en pesos colombianos)
  valoresServicios: {
    // Consultas
    consultaGeneral: 50000,
    consultaPrenatal: 55000,
    consultaPostnatal: 55000,

    // Procedimientos
    terapiaFisicaIndividual: 35000,
    terapiaFisicaGrupal: 25000,
    preparacionParto: 45000,
    reeducacionPisoPelvis: 40000,
    masajeTerapeutico: 30000,
    electroterapia: 25000,
    termoterapia: 20000,
    hidroterapia: 35000,
    mecanoterapia: 30000,

    // Valoraciones
    valoracionInicial: 60000,
    valoracionPisoPelvis: 65000,
    valoracionLactancia: 55000
  },

  // Mapeo de especialidades
  especialidades: {
    'Fisioterapia General': '01',
    'Fisioterapia Pediátrica': '02',
    'Fisioterapia Obstétrica': '03',
    'Fisioterapia Deportiva': '04',
    'Fisioterapia Neurológica': '05'
  },

  // Finalidades según tipo de servicio
  finalidades: {
    // Consultas
    consultaGeneral: '11', // Valoración integral para promoción y mantenimiento
    consultaPrenatal: '05', // Atención prenatal
    consultaPostnatal: '05', // Atención del parto y puerperio
    consultaLactancia: '06', // Atención preconcepcional

    // Procedimientos
    terapiaFisica: '44', // Rehabilitación
    preparacionParto: '05', // Atención del parto y puerperio
    pisoPelvis: '44', // Rehabilitación
    masaje: '44', // Rehabilitación
    electroterapia: '44', // Rehabilitación
    termoterapia: '44', // Rehabilitación
    hidroterapia: '44', // Rehabilitación
    mecanoterapia: '44' // Rehabilitación
  },

  // Códigos CIE-10 para fisioterapia perinatal
  diagnosticosCIE: {
    // Fisioterapia general
    fisioterapiaGeneral: 'Z51.4', // Fisioterapia

    // Embarazo y parto
    embarazo: 'Z34.9', // Embarazo no especificado
    parto: 'Z39.2', // Atención postnatal
    puerperio: 'Z39.2', // Atención postnatal

    // Piso pélvico
    incontinenciaUrinaria: 'N39.3', // Incontinencia urinaria
    prolapsoGenital: 'N81.9', // Prolapso genital femenino

    // Lactancia
    problemasLactancia: 'Z39.1', // Atención y consejo sobre lactancia

    // Pediatría
    desarrolloPsicomotor: 'R62.0', // Retraso del desarrollo
    parálisisCerebral: 'G80.9', // Parálisis cerebral infantil

    // Promoción y prevención
    promocionSalud: 'Z00.0', // Examen médico general
    controlPrenatal: 'Z34.9', // Embarazo
    controlPostnatal: 'Z39.2' // Atención postnatal
  },

  // Tipos de pago moderador
  tiposPagoModerador: {
    noAplica: '04', // No aplica pago moderador
    copago: '01', // Copago
    cuotaModeradora: '02', // Cuota moderadora
    porcentaje: '03' // Porcentaje
  },

  // Grupos de servicios
  gruposServicios: {
    consultas: '01',
    procedimientos: '04',
    intervencionesQuirurgicas: '03',
    medicamentos: '02',
    otrosServicios: '05'
  },

  // Modalidades de grupo servicio
  modalidades: {
    individual: '01',
    grupal: '02',
    consultaExterna: '09'
  },

  // Causas motivo atención
  causasMotivoAtencion: {
    consultaExterna: '21',
    urgencias: '01',
    hospitalizacion: '02'
  },

  // Métodos de utilidad
  getValorServicio: function(tipoServicio) {
    return this.valoresServicios[tipoServicio] || 0;
  },

  getCodigoCUPS: function(tipoProcedimiento) {
    return this.codigosCUPS[tipoProcedimiento] || this.codigosCUPS.consultaGeneral;
  },

  getFinalidad: function(tipoServicio) {
    return this.finalidades[tipoServicio] || '11';
  },

  getDiagnosticoCIE: function(tipoDiagnostico) {
    return this.diagnosticosCIE[tipoDiagnostico] || this.diagnosticosCIE.fisioterapiaGeneral;
  },

  // Configuración de validaciones
  validaciones: {
    maxValorServicio: 1000000, // Máximo 1 millón de pesos
    minValorServicio: 1000, // Mínimo 1000 pesos
    maxServiciosPorFactura: 100, // Máximo 100 servicios por factura
    formatosFecha: ['AAAA-MM-DD HH:MM']
  }
};

module.exports = ripsConfig;