/**
 * Convertidor JSON RIPS según Resolución 1036 de 2022
 * Ministerio de Salud y Protección Social - Colombia
 */

const mongoose = require('mongoose');
const ripsConfig = require('./ripsConfig');

// Cache de códigos CUPS cargados de la BD
let codigosCUPSCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

class RIPSConverter {
  constructor() {
    this.validationErrors = [];
    this.validationWarnings = [];
    this.codigosCUPS = null;
  }

  /**
   * Carga los códigos CUPS desde la base de datos
   * Usa cache para evitar múltiples consultas
   */
  async cargarCodigosCUPS() {
    try {
      // Verificar si el cache es válido
      const ahora = Date.now();
      if (codigosCUPSCache && cacheTimestamp && (ahora - cacheTimestamp) < CACHE_TTL) {
        this.codigosCUPS = codigosCUPSCache;
        return;
      }

      // Intentar cargar desde BD
      const CodigoCUPS = require('./models/CodigoCUPS');
      const codigos = await CodigoCUPS.find({ activo: true });

      if (codigos && codigos.length > 0) {
        // Convertir a un mapa por claveInterna para acceso rápido
        this.codigosCUPS = {};
        for (const codigo of codigos) {
          if (codigo.claveInterna) {
            this.codigosCUPS[codigo.claveInterna] = codigo;
          }
        }
        // Actualizar cache
        codigosCUPSCache = this.codigosCUPS;
        cacheTimestamp = ahora;
        console.log(`📋 CUPS cargados desde BD: ${codigos.length} códigos`);
      } else {
        this.codigosCUPS = null;
        console.log('ℹ️ No hay códigos CUPS en BD, usando ripsConfig como fallback');
      }
    } catch (error) {
      console.log('ℹ️ Error cargando CUPS de BD, usando ripsConfig:', error.message);
      this.codigosCUPS = null;
    }
  }

  /**
   * Obtiene el código CUPS por clave interna
   * Primero busca en BD, si no existe usa ripsConfig
   */
  getCodigoCUPSDinamico(claveInterna) {
    // Intentar obtener de la BD cacheada
    if (this.codigosCUPS && this.codigosCUPS[claveInterna]) {
      return this.codigosCUPS[claveInterna].codigo;
    }
    // Fallback a ripsConfig
    return ripsConfig.getCodigoCUPS(claveInterna);
  }

  /**
   * Obtiene el valor del servicio por clave interna
   */
  getValorServicioDinamico(claveInterna) {
    if (this.codigosCUPS && this.codigosCUPS[claveInterna]) {
      return this.codigosCUPS[claveInterna].valor;
    }
    return ripsConfig.getValorServicio(claveInterna);
  }

  /**
   * Obtiene la finalidad por clave interna
   */
  getFinalidadDinamica(claveInterna) {
    if (this.codigosCUPS && this.codigosCUPS[claveInterna]) {
      return this.codigosCUPS[claveInterna].finalidad;
    }
    return ripsConfig.getFinalidad(claveInterna);
  }

  /**
   * Obtiene el diagnóstico CIE por clave interna
   */
  getDiagnosticoCIEDinamico(claveInterna) {
    if (this.codigosCUPS && this.codigosCUPS[claveInterna]) {
      return this.codigosCUPS[claveInterna].diagnosticoCIE;
    }
    return ripsConfig.getDiagnosticoCIE(claveInterna);
  }

  /**
   * Convierte datos del proyecto a formato RIPS JSON
   * @param {Object} data - Datos de entrada
   * @param {string} data.numFactura - Número de factura
   * @param {Array} data.pacientes - Array de pacientes con sus servicios
   * @param {Object} data.profesional - Información del profesional
   * @returns {Object} - Estructura RIPS en formato JSON
   */
  async convertToRIPS(data) {
    this.validationErrors = [];
    this.validationWarnings = [];

    try {
      // Cargar códigos CUPS desde BD (con cache)
      await this.cargarCodigosCUPS();

      // Validar estructura básica de entrada
      if (!data.numFactura && !data.sinFactura) {
        throw new Error('Datos de entrada inválidos: se requiere numFactura o marcar sin factura');
      }

      const ripsData = {
        numDocumentoldObligado: this.getNITFacturador(),
        numFactura: data.sinFactura ? null : data.numFactura,
        tipoNota: null,
        numNota: null,
        usuarios: [],
        serviciosTecnologias: []
      };

      // Procesar cada paciente
      for (const pacienteData of data.pacientes) {
        const usuario = await this.convertUsuario(pacienteData);
        const servicios = await this.convertServicios(pacienteData);

        if (usuario) {
          ripsData.usuarios.push(usuario);
          ripsData.serviciosTecnologias.push({
            ...servicios,
            consecutivo: usuario.consecutivo
          });
        }
      }

      // Validaciones finales
      this.validateRIPS(ripsData, data.sinFactura);

      return {
        rips: ripsData,
        validationErrors: this.validationErrors,
        validationWarnings: this.validationWarnings,
        isValid: this.validationErrors.length === 0
      };

    } catch (error) {
      this.validationErrors.push(`Error en conversión: ${error.message}`);
      return {
        rips: null,
        validationErrors: this.validationErrors,
        validationWarnings: this.validationWarnings,
        isValid: false
      };
    }
  }

  /**
   * Obtiene el NIT del facturador electrónico
   */
  getNITFacturador() {
    return ripsConfig.prestador.nit;
  }

  /**
   * Obtiene el código de servicio REPS del prestador
   */
  getCodigoServicioREPS() {
    return ripsConfig.prestador.codServicioREPS || '739';
  }

  /**
   * Convierte datos del paciente a formato RIPS usuario
   */
  async convertUsuario(pacienteData) {
    try {
      const paciente = pacienteData.paciente || pacienteData;

      // Mapear género según RIPS
      const codSexo = this.mapGenero(paciente.genero);

      // Calcular edad
      const edad = this.calcularEdad(paciente.fechaNacimiento);

      // Validar tipo de documento según edad
      const tipoDocumentoValidado = this.validarTipoDocumento(paciente.tipoDocumento, edad);

      return {
        tipoDocumentoldentificacion: tipoDocumentoValidado,
        numDocumentoldentificacion: paciente.numeroDocumento,
        tipoUsuario: this.mapTipoUsuario(paciente.regimenAfiliacion),
        fechaNacimiento: this.formatFechaRIPS(paciente.fechaNacimiento),
        codSexo: codSexo,
        codPaisResidencia: paciente.codPaisResidencia || '170', // Colombia por defecto
        codMunicipioResidencia: paciente.codMunicipioResidencia || '23001', // Montería por defecto
        codZonaTerritorialResidencia: paciente.codZonaTerritorialResidencia || '01', // Urbana por defecto
        incapacidad: '02', // No aplica incapacidad por defecto
        consecutivo: pacienteData.consecutivo || 1
      };

    } catch (error) {
      this.validationErrors.push(`Error convirtiendo usuario ${pacienteData.numeroDocumento}: ${error.message}`);
      return null;
    }
  }

  /**
   * Convierte servicios del paciente a formato RIPS
   */
  async convertServicios(pacienteData) {
    const servicios = {
      consultas: [],
      procedimientos: [],
      urgencias: [],
      hospitalizacion: [],
      recienNacidos: [],
      medicamentos: [],
      otrosServicios: []
    };

    try {
      // Convertir valoraciones de ingreso a consultas
      if (pacienteData.valoracionesIngreso) {
        for (const valoracion of pacienteData.valoracionesIngreso) {
          const consulta = await this.convertConsulta(valoracion, pacienteData);
          if (consulta) servicios.consultas.push(consulta);
        }
      }

      // Convertir clases a procedimientos
      if (pacienteData.clases) {
        for (const clase of pacienteData.clases) {
          const procedimiento = await this.convertProcedimiento(clase, pacienteData);
          if (procedimiento) servicios.procedimientos.push(procedimiento);
        }
      }

      // Convertir sesiones perinatales
      if (pacienteData.sesionesPerinatales) {
        for (const sesion of pacienteData.sesionesPerinatales) {
          const procedimiento = await this.convertSesionPerinatal(sesion, pacienteData);
          if (procedimiento) servicios.procedimientos.push(procedimiento);
        }
      }

      // Convertir valoraciones de piso pélvico
      if (pacienteData.valoracionesPisoPelvico) {
        for (const valoracion of pacienteData.valoracionesPisoPelvico) {
          const procedimiento = await this.convertValoracionPisoPelvico(valoracion, pacienteData);
          if (procedimiento) servicios.procedimientos.push(procedimiento);
        }
      }

    } catch (error) {
      this.validationErrors.push(`Error convirtiendo servicios: ${error.message}`);
    }

    return servicios;
  }

  /**
   * Convierte valoración de ingreso a consulta RIPS
   */
  async convertConsulta(valoracion, pacienteData) {
    try {
      const tipoConsultaKey = this.determinarTipoConsulta(valoracion.motivoDeConsulta);
      const finalidad = this.getFinalidadDinamica(tipoConsultaKey);
      const diagnostico = this.determinarDiagnosticoCIE(valoracion.motivoDeConsulta);

      return {
        codPrestador: this.getCodigoPrestador(),
        fechalnicioAtencion: this.formatFechaRIPS(valoracion.fecha),
        numAutorizacion: valoracion.numAutorizacion || null,
        codConsulta: this.getCodigoCUPSDinamico(tipoConsultaKey),
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.consultaExterna,
        grupoServicios: ripsConfig.gruposServicios.consultas,
        codServicio: this.getCodigoServicioREPS(), 
        finalidadTecnologiaSalud: finalidad,
        causaMotivoAtencion: ripsConfig.causasMotivoAtencion.consultaExterna,
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado1: null,
        codDiagnosticoRelacionado2: null,
        codDiagnosticoRelacionado3: null,
        tipoDiagnosticoPrincipal: '01', // Confirmado
        tipoDocumentoldentificacion: valoracion.profesionalTratante?.tipoDocumento || 'CC',
        numDocumentoldentificacion: valoracion.profesionalTratante?.numeroDocumento || '00000000',
        vrServicio: valoracion.vrServicio || this.getValorServicioDinamico(tipoConsultaKey),
        tipoPagoModerador: ripsConfig.tiposPagoModerador.noAplica,
        valorPagoModerador: 0,
        numFEVPagoModerador: null,
        consecutivo: 1
      };
    } catch (error) {
      this.validationErrors.push(`Error convirtiendo consulta: ${error.message}`);
      return null;
    }
  }

  /**
   * Convierte clase a procedimiento RIPS
   */
  async convertProcedimiento(clase, pacienteData) {
    try {
      const tipoProcedimientoKey = this.determinarTipoProcedimiento(clase.titulo);
      const finalidad = this.getFinalidadDinamica(tipoProcedimientoKey);
      const diagnostico = this.determinarDiagnosticoCIE(clase.titulo); // Usar el título para determinar el diagnóstico

      return {
        codPrestador: this.getCodigoPrestador(),
        fechalnicioAtencion: this.formatFechaRIPS(clase.fecha),
        idMIPRES: null,
        numAutorizacion: null,
        codProcedimiento: this.getCodigoCUPSDinamico(tipoProcedimientoKey),
        viaIngresoServicioSalud: '01', // Consulta externa
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.individual,
        grupoServicios: ripsConfig.gruposServicios.procedimientos,
        codServicio: this.getCodigoServicioREPS(),
        finalidadTecnologiaSalud: finalidad,
        tipoDocumentoldentificacion: clase.instructor?.tipoDocumento || 'CC',
        numDocumentoldentificacion: clase.instructor?.numeroDocumento || '00000000',
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado: null,
        codComplicacion: null,
        vrServicio: clase.vrServicio || this.getValorServicioDinamico(tipoProcedimientoKey),
        tipoPagoModerador: ripsConfig.tiposPagoModerador.noAplica,
        valorPagoModerador: 0,
        numFEVPagoModerador: null,
        consecutivo: 1
      };
    } catch (error) {
      this.validationErrors.push(`Error convirtiendo procedimiento: ${error.message}`);
      return null;
    }
  }

  /**
   * Convierte sesión perinatal a procedimiento RIPS
   */
  async convertSesionPerinatal(sesion, pacienteData) {
    try {
      const tipoProcedimientoKey = this.determinarTipoProcedimiento('preparación parto');
      const finalidad = this.getFinalidadDinamica(tipoProcedimientoKey);
      const diagnostico = this.determinarDiagnosticoCIE('parto');

      return {
        codPrestador: this.getCodigoPrestador(),
        fechalnicioAtencion: this.formatFechaRIPS(sesion.fecha),
        idMIPRES: null,
        numAutorizacion: null,
        codProcedimiento: this.getCodigoCUPSDinamico(tipoProcedimientoKey),
        viaIngresoServicioSalud: '01', // Consulta externa
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.individual,
        grupoServicios: ripsConfig.gruposServicios.procedimientos,
        codServicio: this.getCodigoServicioREPS(),
        finalidadTecnologiaSalud: finalidad,
        tipoDocumentoldentificacion: sesion.profesional?.tipoDocumento || 'CC',
        numDocumentoldentificacion: sesion.profesional?.numeroDocumento || '00000000',
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado: null,
        codComplicacion: null,
        vrServicio: sesion.vrServicio || this.getValorServicioDinamico(tipoProcedimientoKey),
        tipoPagoModerador: ripsConfig.tiposPagoModerador.noAplica,
        valorPagoModerador: 0,
        numFEVPagoModerador: null,
        consecutivo: 1
      };
    } catch (error) {
      this.validationErrors.push(`Error convirtiendo sesión perinatal: ${error.message}`);
      return null;
    }
  }

  /**
   * Convierte valoración de piso pélvico a procedimiento RIPS
   */
  async convertValoracionPisoPelvico(valoracion, pacienteData) {
    try {
      const tipoProcedimientoKey = this.determinarTipoProcedimiento('piso pélvico');
      const finalidad = this.getFinalidadDinamica(tipoProcedimientoKey);
      const diagnostico = this.determinarDiagnosticoPisoPelvico(valoracion);

      return {
        codPrestador: this.getCodigoPrestador(),
        fechalnicioAtencion: this.formatFechaRIPS(valoracion.fecha),
        idMIPRES: null,
        numAutorizacion: null,
        codProcedimiento: this.getCodigoCUPSDinamico(tipoProcedimientoKey),
        viaIngresoServicioSalud: '01', // Consulta externa
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.individual,
        grupoServicios: ripsConfig.gruposServicios.procedimientos,
        codServicio: this.getCodigoServicioREPS(),
        finalidadTecnologiaSalud: finalidad,
        tipoDocumentoldentificacion: 'CC',
        numDocumentoldentificacion: '00000000',
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado: null,
        codComplicacion: null,
        vrServicio: valoracion.vrServicio || this.getValorServicioDinamico(tipoProcedimientoKey),
        tipoPagoModerador: ripsConfig.tiposPagoModerador.noAplica,
        valorPagoModerador: 0,
        numFEVPagoModerador: null,
        consecutivo: 1
      };
    } catch (error) {
      this.validationErrors.push(`Error convirtiendo valoración piso pélvico: ${error.message}`);
      return null;
    }
  }

  /**
   * Determina el diagnóstico CIE-10 según la valoración de piso pélvico
   */
  determinarDiagnosticoPisoPelvico(valoracion) {
    // Priorizar según condiciones encontradas
    if (valoracion.incontinenciaUrinaria) {
      return ripsConfig.getDiagnosticoCIE('incontinenciaUrinaria');
    }
    if (valoracion.bultoVaginal) {
      return ripsConfig.getDiagnosticoCIE('prolapsoGenital');
    }
    // Default para valoración de piso pélvico
    return ripsConfig.getDiagnosticoCIE('fisioterapiaGeneral');
  }

  /**
   * Utilidades de mapeo y validación
   */

  mapGenero(genero) {
    const mapaGenero = {
      'Masculino': 'M',
      'Femenino': 'F',
      'Otro': 'M', // Default a masculino
      'Prefiero no decir': 'M' // Default a masculino
    };
    return mapaGenero[genero] || 'M';
  }

  mapTipoUsuario(regimenAfiliacion) {
    const mapaTipoUsuario = {
      'Contributivo': '01', // Cotizante
      'Subsidiado': '02', // Beneficiario
      'Especial': '03', // Especial
      'No asegurado': '04' // No asegurado
    };
    return mapaTipoUsuario[regimenAfiliacion] || '04';
  }

  /**
   * Determina el tipo de consulta según motivo
   */
  determinarTipoConsulta(motivo) {
    // Según instrucciones: Todas las valoraciones apuntan a Consulta Fisiatría 1ra Vez ('890264')
    // Las de control o seguimiento usarían '890384'
    return 'consultaFisiatriaPrimeraVez'; 
  }

  /**
   * Determina el tipo de procedimiento según título/descripción
   */
  determinarTipoProcedimiento(titulo) {
    if (!titulo) return 'terapiaFisicaSOD';

    const tituloLower = titulo.toLowerCase();
    
    // Reglas específicas mapeadas a códigos Res. 2706
    if (tituloLower.includes('estimulación') || tituloLower.includes('clase') || tituloLower.includes('sensorial') || tituloLower.includes('grupal')) {
      return 'integracionSensorial'; // 933900
    }
    
    if (tituloLower.includes('piso pélvico') || tituloLower.includes('piso pelvico')) {
      return 'rehabDeficienciaLeve'; // 938610 (Sesiones Rehab)
    }
    
    if (tituloLower.includes('preparación parto') || tituloLower.includes('preparacion parto') || tituloLower.includes('educación')) {
      return 'consultaFisiatriaControl'; // 890384 (Educación/Control) - Si se factura como consulta
      // O 'rehabDeficienciaLeve' si es procedimiento
    }
    
    if (tituloLower.includes('masaje')) {
      return 'terapiaFisicaSOD'; // 931000
    }
    
    // Default
    return 'terapiaFisicaSOD';
  }

  determinarDiagnosticoCIE(motivo) {
    if (!motivo) return ripsConfig.getDiagnosticoCIE('fisioterapiaGeneral');

    const motivoLower = motivo.toLowerCase();
    if (motivoLower.includes('prenatal') || motivoLower.includes('embarazo')) {
      return ripsConfig.getDiagnosticoCIE('embarazo');
    }
    if (motivoLower.includes('parto') || motivoLower.includes('puerperio')) {
      return ripsConfig.getDiagnosticoCIE('parto');
    }
    if (motivoLower.includes('lactancia')) {
      return ripsConfig.getDiagnosticoCIE('problemasLactancia');
    }
    if (motivoLower.includes('piso pélvico') || motivoLower.includes('incontinencia')) {
      return ripsConfig.getDiagnosticoCIE('incontinenciaUrinaria');
    }
    if (motivoLower.includes('desarrollo') || motivoLower.includes('pediátrica')) {
      return ripsConfig.getDiagnosticoCIE('desarrolloPsicomotor');
    }
    return ripsConfig.getDiagnosticoCIE('fisioterapiaGeneral');
  }

  calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  validarTipoDocumento(tipoDocumento, edad) {
    // Lógica según Resolución 4622 de 2016
    if (edad < 7) {
      if (!['RC', 'CN', 'MS'].includes(tipoDocumento)) {
        this.validationWarnings.push(`Tipo de documento ${tipoDocumento} no recomendado para edad ${edad}`);
      }
    } else if (edad < 18) {
      if (!['TI', 'MS'].includes(tipoDocumento)) {
        this.validationWarnings.push(`Tipo de documento ${tipoDocumento} no recomendado para edad ${edad}`);
      }
    }
    return tipoDocumento;
  }

  formatFechaRIPS(fecha) {
    if (!fecha) return null;
    const date = new Date(fecha);
    return date.toISOString().slice(0, 16).replace('T', ' '); // Formato AAAA-MM-DD HH:MM
  }

  getCodigoPrestador() {
    return ripsConfig.prestador.codPrestador;
  }

  /**
   * Validaciones según reglas de la Resolución 1036 y 2275
   */
  validateRIPS(ripsData, sinFactura = false) {
    // RVG01: Estructura básica
    if (!ripsData.numDocumentoldObligado) {
      this.validationErrors.push('RVG01: Falta información básica del obligado');
    }
    
    if (!sinFactura && !ripsData.numFactura) {
      this.validationErrors.push('RVG01: Falta número de factura (obligatorio si no es reporte sin factura)');
    }
    
    if (sinFactura && ripsData.numFactura !== null) {
      this.validationErrors.push('RVG01: Para reporte sin factura, numFactura debe ser null');
    }

    // RVG03: Al menos un servicio
    const tieneServicios = ripsData.serviciosTecnologias.some(servicio =>
      servicio.consultas?.length > 0 ||
      servicio.procedimientos?.length > 0 ||
      servicio.urgencias?.length > 0 ||
      servicio.hospitalizacion?.length > 0 ||
      servicio.recienNacidos?.length > 0 ||
      servicio.medicamentos?.length > 0 ||
      servicio.otrosServicios?.length > 0
    );

    if (!tieneServicios) {
      this.validationErrors.push('RVG03: No se encontraron servicios prestados');
    }

    // RVG07: Usuarios relacionados con servicios
    const consecutivosServicios = ripsData.serviciosTecnologias.map(s => s.consecutivo);
    const consecutivosUsuarios = ripsData.usuarios.map(u => u.consecutivo);

    if (!consecutivosServicios.every(c => consecutivosUsuarios.includes(c))) {
      this.validationErrors.push('RVG07: Existen servicios sin usuario correspondiente');
    }
  }
}

module.exports = RIPSConverter;