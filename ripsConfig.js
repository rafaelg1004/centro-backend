/**
 * Configuración de RIPS - Centro de Estimulación Mamitas
 * Códigos CUPS y valores de servicios según especialidad en fisioterapia perinatal
 */

const ripsConfig = {
  // Información del prestador
  // Información del prestador (Datos oficiales Habilitación DHSS0230433)
  prestador: {
    nit: process.env.NIT_FACTURADOR || '2300101133', // Usando Código Prestador base como NIT (Confirmar si es CC diferente)
    codPrestador: process.env.COD_PRESTADOR || '230010113301',
    nombre: 'Dayan Ivonne Villegas Gamboa',
    especialidad: 'Fisioterapia Perinatal',
    codServicioREPS: '739' // 739: FISIOTERAPIA (Res. 3100/2019)
  },

  // Códigos CUPS actualizados (Res. 2706 de 2025)
  codigosCUPS: {
    // === CONSULTAS Y VALORACIONES (890264 - 890384) ===
    // Se usan estos códigos base para todas las valoraciones de ingreso
    consultaFisiatriaPrimeraVez: '890264',
    consultaFisiatriaControl: '890384',
    juntaMedica: '890502',
    
    // Mapeo de claves antiguas a nuevos códigos oficiales
    consultaGeneral: '890264',
    consultaPrenatal: '890264',
    consultaPostnatal: '890264',
    valoracionInicial: '890264',      // Valoración Niños -> Consulta 1ra Vez
    valoracionPisoPelvis: '890264',   // Valoración Adultos -> Consulta 1ra Vez
    valoracionLactancia: '890264',    // Valoración Lactancia -> Consulta 1ra Vez

    // === PROCEDIMIENTOS PEDIATRÍA (Neurodesarrollo/Estimulación) ===
    toxinaBotulinica: '861411',
    integracionSensorial: '933900', // Clases Grupales / Estimulación
    evaluacionOsteomuscular: '930401',
    pruebaCognitiva: '930102',
    rxPanoramicaMInf: '873306',
    tecnologiaRehabilitacion: '932400',

    // === PROCEDIMIENTOS OBSTETRICIA / PISO PÉLVICO ===
    ecoPisoPelvico: '881411',
    ecoPelvicaGinecologica: '881410',
    terapiaFisicaSOD: '931000',
    
    // Rehabilitación Funcional (Sesiones Piso Pélvico / Perinatales)
    rehabDeficienciaLeve: '938610',     // Sesión Estándar
    rehabDeficienciaModerada: '938611',
    rehabDeficienciaSevera: '938612',
    rehabDeficienciaDefinitiva: '938660',

    // Mapeo de procedimientos antiguos a nuevos
    terapiaFisicaIndividual: '931000',
    terapiaFisicaGrupal: '933900',      // Clases -> Integración Sensorial
    preparacionParto: '890384',         // Educación -> Consulta Control (o Rehab)
    reeducacionPisoPelvis: '938610',    // Sesiones -> Rehab Leve
    masajeTerapeutico: '931000',
    electroterapia: '931000',
    termoterapia: '931000',
    hidroterapia: '931000',
    mecanoterapia: '931000'
  },

  // Valores de servicios (Referenciales)
  valoresServicios: {
    // Consultas
    consultaGeneral: 80000,
    consultaPrenatal: 90000,
    consultaPostnatal: 90000,
    consultaFisiatriaPrimeraVez: 90000,
    
    // Procedimientos
    terapiaFisicaIndividual: 45000,
    terapiaFisicaGrupal: 35000,
    preparacionParto: 50000,
    reeducacionPisoPelvis: 50000,
    
    // Nuevos
    integracionSensorial: 45000,
    rehabDeficienciaLeve: 50000,
    ecoPisoPelvico: 120000,

    // Valoraciones
    valoracionInicial: 90000,
    valoracionPisoPelvis: 100000,
    valoracionLactancia: 90000
  },

  // Mapeo de especialidades
  especialidades: {
    'Fisioterapia General': '01',
    'Fisioterapia Pediátrica': '02',
    'Fisioterapia Obstétrica': '03'
  },
  
  // Finalidades (Actualizadas)
  finalidades: {
    // Consultas
    consultaGeneral: '11',  // Val. Integral
    consultaPrenatal: '05', // Prenatal (Si aplica) o 11
    consultaPostnatal: '05',
    consultaLactancia: '06', // Preconcepcional o 11
    
    // Mapeos
    '890264': '11',
    '890384': '11',

    // Procedimientos (Rehabilitación = 44)
    terapiaFisica: '44',
    preparacionParto: '05',
    pisoPelvis: '44',
    rehabFuncional: '44',
    
    // Mapeos Nuevos
    '933900': '44',
    '938610': '44',
    '881411': '44'
  },

  // Códigos CIE-10 (Mantener los existentes más comunes)
  diagnosticosCIE: {
    fisioterapiaGeneral: 'Z51.4',
    embarazo: 'Z34.9',
    parto: 'Z39.2',
    incontinenciaUrinaria: 'N39.3',
    prolapsoGenital: 'N81.9',
    problemasLactancia: 'Z39.1',
    desarrolloPsicomotor: 'R62.0',
    paralisisCerebral: 'G80.9',
    promocionSalud: 'Z00.0'
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