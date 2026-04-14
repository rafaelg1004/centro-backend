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
   * Extrae el código puro de un string tipo "F840 - Descripción"
   */
  extractCIE10(val) {
    if (!val) return null;
    if (typeof val !== 'string') return val;
    // Si contiene " - ", tomar solo la primera parte
    const parts = val.split(' - ');
    return parts[0].trim().toUpperCase().replace(/\./g, '');
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

      this.sinFactura = !!data.sinFactura;

      const ripsData = {
        numDocumentoIdObligado: this.getNITFacturador(),
        numFactura: data.sinFactura ? null : data.numFactura,
        tipoNota: data.sinFactura ? 'RS' : null,
        numNota: data.sinFactura ? (data.numFactura || '0') : null,
        usuarios: []
      };

      let indiceUsuario = 0;

      // Procesar cada paciente
      for (const pacienteData of data.pacientes) {
        indiceUsuario++;
        const usuario = await this.convertUsuario(pacienteData, indiceUsuario);
        const servicios = await this.convertServicios(pacienteData);

        // Solo agregar si el usuario existe Y tiene al menos un servicio
        const tieneServicios = servicios.consultas?.length > 0 ||
                              servicios.procedimientos?.length > 0 ||
                              servicios.urgencias?.length > 0 ||
                              servicios.hospitalizacion?.length > 0 ||
                              servicios.recienNacidos?.length > 0 ||
                              servicios.medicamentos?.length > 0 ||
                              servicios.otrosServicios?.length > 0;

        if (usuario && tieneServicios) {
          // Agregar servicios al usuario para que tenga la estructura requerida
          usuario.servicios = servicios;
          ripsData.usuarios.push(usuario);
        } else if (usuario && !tieneServicios) {
          this.validationWarnings.push(`Usuario ${usuario.numDocumentoIdentificacion} no tiene servicios, omitido`);
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
    return ripsConfig.prestador.codServicioREPS ? parseInt(ripsConfig.prestador.codServicioREPS) : 739;
  }

  /**
   * Convierte datos del paciente a formato RIPS usuario
   */
  async convertUsuario(pacienteData, indiceUsuario) {
    try {
      const paciente = pacienteData.paciente || pacienteData;

      // Mapear género según RIPS
      const codSexo = this.mapGenero(paciente.genero);

      // Calcular edad
      const edad = this.calcularEdad(paciente.fechaNacimiento);

      // Validar tipo de documento según edad
      const tipoDocumentoValidado = this.validarTipoDocumento(paciente.tipoDocumento, edad);

      return {
        tipoDocumentoIdentificacion: tipoDocumentoValidado,
        numDocumentoIdentificacion: paciente.numeroDocumento,
        tipoUsuario: this.mapTipoUsuario(paciente.regimenAfiliacion),
        fechaNacimiento: this.formatFechaNacimiento(paciente.fechaNacimiento),
        codSexo: codSexo,
        codPaisResidencia: paciente.codPaisResidencia || '170', // Colombia por defecto
        codMunicipioResidencia: paciente.codMunicipioResidencia || '23001', // Montería por defecto
        codZonaTerritorialResidencia: paciente.codZonaTerritorialResidencia || '01', // Urbana por defecto
        incapacidad: 'NO', // No aplica incapacidad por defecto
        servicios: null, // Se llena después con los servicios del usuario
        consecutivo: indiceUsuario
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
        for (let i = 0; i < pacienteData.valoracionesIngreso.length; i++) {
          const valoracion = pacienteData.valoracionesIngreso[i];
          const consulta = await this.convertConsulta(valoracion, i + 1);
          if (consulta) servicios.consultas.push(consulta);
        }
      }

      // Convertir clases a procedimientos
      if (pacienteData.clases) {
        for (let i = 0; i < pacienteData.clases.length; i++) {
          const clase = pacienteData.clases[i];
          const procedimiento = await this.convertProcedimiento(clase, i + 1);
          if (procedimiento) servicios.procedimientos.push(procedimiento);
        }
      }

      // Convertir sesiones perinatales
      if (pacienteData.sesionesPerinatales) {
        for (let i = 0; i < pacienteData.sesionesPerinatales.length; i++) {
          const sesion = pacienteData.sesionesPerinatales[i];
          const procedimiento = await this.convertSesionPerinatal(sesion, servicios.procedimientos.length + 1);
          if (procedimiento) servicios.procedimientos.push(procedimiento);
        }
      }

      // Convertir valoraciones de piso pélvico
      if (pacienteData.valoracionesPisoPelvico) {
        for (let i = 0; i < pacienteData.valoracionesPisoPelvico.length; i++) {
          const valoracion = pacienteData.valoracionesPisoPelvico[i];
          const procedimiento = await this.convertValoracionPisoPelvico(valoracion, servicios.procedimientos.length + 1);
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
  async convertConsulta(valoracion, consecutive) {
    try {
      const tipoConsultaKey = this.determinarTipoConsulta(valoracion.motivoDeConsulta);

      // Priorizar datos reales guardados en la valoración sobre los defaults
      const finalidad = valoracion.finalidad || this.getFinalidadDinamica(tipoConsultaKey);
      const diagnostico = this.extractCIE10(valoracion.codDiagnosticoPrincipal) || this.determinarDiagnosticoCIE(valoracion.motivoDeConsulta);
      const codConsulta = valoracion.codConsulta || this.getCodigoCUPSDinamico(tipoConsultaKey);
      const causa = valoracion.causaExterna || valoracion.causa || ripsConfig.causasMotivoAtencion.consultaExterna;

      return {
        codPrestador: this.getCodigoPrestador(),
        fechaInicioAtencion: this.formatFechaRIPS(valoracion.fecha),
        numAutorizacion: valoracion.numAutorizacion || null,
        codConsulta: codConsulta,
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.consultaExterna,
        grupoServicios: ripsConfig.gruposServicios.consultas,
        codServicio: this.getCodigoServicioREPS(),
        finalidadTecnologiaSalud: finalidad,
        causaMotivoAtencion: causa,
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado1: null,
        codDiagnosticoRelacionado2: null,
        codDiagnosticoRelacionado3: null,
        tipoDiagnosticoPrincipal: '01', // Confirmado
        tipoDocumentoIdentificacion: valoracion.profesionalTratante?.tipoDocumento || 'CC',
        numDocumentoIdentificacion: valoracion.profesionalTratante?.numeroDocumento || '00000000',
        vrServicio: this.sinFactura ? 0 : (valoracion.vrServicio || this.getValorServicioDinamico(tipoConsultaKey)),
        conceptoRecaudo: this.sinFactura ? '05' : '01',
        consecutivo: consecutive
      };
    } catch (error) {
      this.validationErrors.push(`Error convirtiendo consulta: ${error.message}`);
      return null;
    }
  }

  /**
   * Convierte clase a procedimiento RIPS
   */
  async convertProcedimiento(clase, consecutive) {
    try {
      const tipoProcedimientoKey = this.determinarTipoProcedimiento(clase.titulo);
      const finalidad = this.getFinalidadDinamica(tipoProcedimientoKey);
      const diagnostico = this.determinarDiagnosticoCIE(clase.titulo); // Usar el título para determinar el diagnóstico

      return {
        codPrestador: this.getCodigoPrestador(),
        fechaInicioAtencion: this.formatFechaRIPS(clase.fecha),
        idMIPRES: null,
        numAutorizacion: null,
        codProcedimiento: this.getCodigoCUPSDinamico(tipoProcedimientoKey),
        viaIngresoServicioSalud: '01', // Consulta externa
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.individual,
        grupoServicios: ripsConfig.gruposServicios.procedimientos,
        codServicio: this.getCodigoServicioREPS(),
        finalidadTecnologiaSalud: finalidad,
        tipoDocumentoIdentificacion: clase.instructor?.tipoDocumento || 'CC',
        numDocumentoIdentificacion: clase.instructor?.numeroDocumento || '00000000',
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado: null,
        codComplicacion: null,
        vrServicio: this.sinFactura ? 0 : (clase.vrServicio || this.getValorServicioDinamico(tipoProcedimientoKey)),
        conceptoRecaudo: this.sinFactura ? '05' : '01',
        consecutivo: consecutive
      };
    } catch (error) {
      this.validationErrors.push(`Error convirtiendo procedimiento: ${error.message}`);
      return null;
    }
  }

  /**
   * Convierte sesión perinatal a procedimiento RIPS
   */
  async convertSesionPerinatal(sesion, consecutive) {
    try {
      const tipoProcedimientoKey = this.determinarTipoProcedimiento('preparación parto');
      const finalidad = this.getFinalidadDinamica(tipoProcedimientoKey);
      const diagnostico = this.determinarDiagnosticoCIE('parto');

      return {
        codPrestador: this.getCodigoPrestador(),
        fechaInicioAtencion: this.formatFechaRIPS(sesion.fecha),
        idMIPRES: null,
        numAutorizacion: null,
        codProcedimiento: this.getCodigoCUPSDinamico(tipoProcedimientoKey),
        viaIngresoServicioSalud: '01', // Consulta externa
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.individual,
        grupoServicios: ripsConfig.gruposServicios.procedimientos,
        codServicio: this.getCodigoServicioREPS(),
        finalidadTecnologiaSalud: finalidad,
        tipoDocumentoIdentificacion: sesion.profesional?.tipoDocumento || 'CC',
        numDocumentoIdentificacion: sesion.profesional?.numeroDocumento || '00000000',
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado: null,
        codComplicacion: null,
        vrServicio: this.sinFactura ? 0 : (sesion.vrServicio || this.getValorServicioDinamico(tipoProcedimientoKey)),
        conceptoRecaudo: this.sinFactura ? '05' : '01',
        consecutivo: consecutive
      };
    } catch (error) {
      this.validationErrors.push(`Error convirtiendo sesión perinatal: ${error.message}`);
      return null;
    }
  }

  /**
   * Convierte valoración de piso pélvico a procedimiento RIPS
   */
  async convertValoracionPisoPelvico(valoracion, consecutive) {
    try {
      const tipoProcedimientoKey = this.determinarTipoProcedimiento('piso pélvico');
      const finalidad = this.getFinalidadDinamica(tipoProcedimientoKey);
      const diagnostico = this.determinarDiagnosticoPisoPelvico(valoracion);

      return {
        codPrestador: this.getCodigoPrestador(),
        fechaInicioAtencion: this.formatFechaRIPS(valoracion.fecha),
        idMIPRES: null,
        numAutorizacion: null,
        codProcedimiento: this.getCodigoCUPSDinamico(tipoProcedimientoKey),
        viaIngresoServicioSalud: '01', // Consulta externa
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.individual,
        grupoServicios: ripsConfig.gruposServicios.procedimientos,
        codServicio: this.getCodigoServicioREPS(),
        finalidadTecnologiaSalud: finalidad,
        tipoDocumentoIdentificacion: 'CC',
        numDocumentoIdentificacion: '00000000',
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado: null,
        codComplicacion: null,
        vrServicio: this.sinFactura ? 0 : (valoracion.vrServicio || this.getValorServicioDinamico(tipoProcedimientoKey)),
        conceptoRecaudo: this.sinFactura ? '05' : '01',
        consecutivo: consecutive
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
    // Formato RIPS: AAAA-MM-DD HH:MM (según Resolución)
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  /**
   * Formato solo fecha: AAAA-MM-DD (para fechaNacimiento)
   */
  formatFechaNacimiento(fecha) {
    if (!fecha) return null;
    const date = new Date(fecha);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  getCodigoPrestador() {
    return ripsConfig.prestador.codPrestador ? String(ripsConfig.prestador.codPrestador) : '230010113301';
  }

  /**
   * Validaciones según reglas de la Resolución 1036 y 2275
   */
  validateRIPS(ripsData, sinFactura = false) {
    // RVG01: Estructura básica
    if (!ripsData.numDocumentoIdObligado) {
      this.validationErrors.push('RVG01: Falta información básica del obligado');
    }

    if (!sinFactura && !ripsData.numFactura) {
      this.validationErrors.push('RVG01: Falta número de factura (obligatorio si no es reporte sin factura)');
    }

    if (sinFactura && ripsData.numFactura !== null) {
      this.validationErrors.push('RVG01: Para reporte sin factura, numFactura debe ser null');
    }

    // RVG03: Al menos un servicio (verificar dentro de cada usuario)
    const tieneServicios = ripsData.usuarios.some(usuario =>
      usuario.servicios?.consultas?.length > 0 ||
      usuario.servicios?.procedimientos?.length > 0 ||
      usuario.servicios?.urgencias?.length > 0 ||
      usuario.servicios?.hospitalizacion?.length > 0 ||
      usuario.servicios?.recienNacidos?.length > 0 ||
      usuario.servicios?.medicamentos?.length > 0 ||
      usuario.servicios?.otrosServicios?.length > 0
    );

    if (!tieneServicios) {
      this.validationErrors.push('RVG03: No se encontraron servicios prestados');
    }
  }
}

module.exports = RIPSConverter;