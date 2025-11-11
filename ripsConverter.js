/**
 * Convertidor JSON RIPS según Resolución 1036 de 2022
 * Ministerio de Salud y Protección Social - Colombia
 */

const mongoose = require('mongoose');
const ripsConfig = require('./ripsConfig');

class RIPSConverter {
  constructor() {
    this.validationErrors = [];
    this.validationWarnings = [];
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
      // Validar estructura básica de entrada
      if (!data.numFactura || !Array.isArray(data.pacientes)) {
        throw new Error('Datos de entrada inválidos: se requiere numFactura y array de pacientes');
      }

      const ripsData = {
        numDocumentoldObligado: this.getNITFacturador(),
        numFactura: data.numFactura,
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
      this.validateRIPS(ripsData);

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
        codMunicipioResidencia: paciente.codMunicipioResidencia || null,
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
      const tipoConsulta = this.determinarTipoConsulta(valoracion.motivoDeConsulta);
      const finalidad = ripsConfig.getFinalidad(tipoConsulta);
      const diagnostico = this.determinarDiagnosticoCIE(valoracion.motivoDeConsulta);

      return {
        codPrestador: this.getCodigoPrestador(),
        fechalnicioAtencion: this.formatFechaRIPS(valoracion.fecha),
        numAutorizacion: valoracion.numAutorizacion || null,
        codConsulta: ripsConfig.getCodigoCUPS('consultaGeneral'),
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.consultaExterna,
        grupoServicios: ripsConfig.gruposServicios.consultas,
        codServicio: 1, // Fisioterapia
        finalidadTecnologiaSalud: finalidad,
        causaMotivoAtencion: ripsConfig.causasMotivoAtencion.consultaExterna,
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado1: null,
        codDiagnosticoRelacionado2: null,
        codDiagnosticoRelacionado3: null,
        tipoDiagnosticoPrincipal: '01', // Confirmado
        tipoDocumentoldentificacion: valoracion.profesionalTratante?.tipoDocumento || 'CC',
        numDocumentoldentificacion: valoracion.profesionalTratante?.numeroDocumento || '00000000',
        vrServicio: valoracion.vrServicio || ripsConfig.getValorServicio(tipoConsulta),
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
      const tipoProcedimiento = this.determinarTipoProcedimiento(clase.titulo);
      const finalidad = ripsConfig.getFinalidad('terapiaFisica');
      const diagnostico = ripsConfig.getDiagnosticoCIE('fisioterapiaGeneral');

      return {
        codPrestador: this.getCodigoPrestador(),
        fechalnicioAtencion: this.formatFechaRIPS(clase.fecha),
        idMIPRES: null,
        numAutorizacion: null,
        codProcedimiento: ripsConfig.getCodigoCUPS(tipoProcedimiento),
        viaIngresoServicioSalud: '01', // Consulta externa
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.individual,
        grupoServicios: ripsConfig.gruposServicios.procedimientos,
        codServicio: 1, // Fisioterapia
        finalidadTecnologiaSalud: finalidad,
        tipoDocumentoldentificacion: clase.instructor?.tipoDocumento || 'CC',
        numDocumentoldentificacion: clase.instructor?.numeroDocumento || '00000000',
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado: null,
        codComplicacion: null,
        vrServicio: clase.vrServicio || ripsConfig.getValorServicio(tipoProcedimiento),
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
      const finalidad = ripsConfig.getFinalidad('preparacionParto');
      const diagnostico = ripsConfig.getDiagnosticoCIE('parto');

      return {
        codPrestador: this.getCodigoPrestador(),
        fechalnicioAtencion: this.formatFechaRIPS(sesion.fecha),
        idMIPRES: null,
        numAutorizacion: null,
        codProcedimiento: ripsConfig.getCodigoCUPS('preparacionParto'),
        viaIngresoServicioSalud: '01', // Consulta externa
        modalidadGrupoServicioTecSal: ripsConfig.modalidades.individual,
        grupoServicios: ripsConfig.gruposServicios.procedimientos,
        codServicio: 1, // Fisioterapia
        finalidadTecnologiaSalud: finalidad,
        tipoDocumentoldentificacion: sesion.profesional?.tipoDocumento || 'CC',
        numDocumentoldentificacion: sesion.profesional?.numeroDocumento || '00000000',
        codDiagnosticoPrincipal: diagnostico,
        codDiagnosticoRelacionado: null,
        codComplicacion: null,
        vrServicio: sesion.vrServicio || ripsConfig.getValorServicio('preparacionParto'),
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

  determinarTipoConsulta(motivo) {
    if (!motivo) return 'consultaGeneral';

    const motivoLower = motivo.toLowerCase();
    if (motivoLower.includes('prenatal') || motivoLower.includes('embarazo')) {
      return 'consultaPrenatal';
    }
    if (motivoLower.includes('parto') || motivoLower.includes('puerperio') || motivoLower.includes('postnatal')) {
      return 'consultaPostnatal';
    }
    if (motivoLower.includes('lactancia')) {
      return 'consultaLactancia';
    }
    return 'consultaGeneral';
  }

  determinarTipoProcedimiento(titulo) {
    if (!titulo) return 'terapiaFisicaIndividual';

    const tituloLower = titulo.toLowerCase();
    if (tituloLower.includes('piso pélvico') || tituloLower.includes('piso pelvico')) {
      return 'reeducacionPisoPelvis';
    }
    if (tituloLower.includes('preparación parto') || tituloLower.includes('preparacion parto')) {
      return 'preparacionParto';
    }
    if (tituloLower.includes('masaje')) {
      return 'masajeTerapeutico';
    }
    if (tituloLower.includes('electro') || tituloLower.includes('electrostimulacion')) {
      return 'electroterapia';
    }
    if (tituloLower.includes('hidro')) {
      return 'hidroterapia';
    }
    if (tituloLower.includes('grupal') || tituloLower.includes('colectiva')) {
      return 'terapiaFisicaGrupal';
    }
    return 'terapiaFisicaIndividual';
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
   * Validaciones según reglas de la Resolución 1036
   */
  validateRIPS(ripsData) {
    // RVG01: Estructura básica
    if (!ripsData.numDocumentoldObligado || !ripsData.numFactura) {
      this.validationErrors.push('RVG01: Falta información básica de la transacción');
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