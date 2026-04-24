/**
 * Ruta para generar RIPS según Resolución 1036 de 2022
 */

const express = require("express");
const router = express.Router();
const RIPSConverter = require("../ripsConverter");
const {
  Paciente,
  ValoracionFisioterapia,
  EvolucionSesion,
  Clase,
  ClaseNino,
} = require("../models-sequelize");
const { Op } = require("sequelize");

// Middleware de autenticación (ya viene manejado desde index.js con verificarToken, pero mantenemos referencia por si se usa req.user)
const authenticate = (req, res, next) => {
  next();
};

/**
 * POST /api/rips/generate
 * Genera archivo RIPS JSON para una factura específica
 */
router.post("/generate", authenticate, async (req, res) => {
  try {
    const { numFactura, pacienteIds, fechaInicio, fechaFin, sinFactura } =
      req.body;

    if (!sinFactura && !numFactura) {
      return res.status(400).json({
        success: false,
        message:
          "El número de factura es obligatorio (a menos que se marque sinFactura)",
      });
    }

    console.log("📋 Generando RIPS para:", {
      numFactura,
      pacienteIds,
      fechaInicio,
      fechaFin,
    });

    let idsParaProcesar = pacienteIds || [];

    // Si no se proporcionan IDs, buscar dinámicamente según servicios en el rango de fechas
    if (!idsParaProcesar.length && (fechaInicio || fechaFin)) {
      console.log(
        "🔍 Buscando pacientes dinámicamente por servicios en el rango de fechas...",
      );

      // Construir where clause para fechas
      const fechaWhere = {};
      if (fechaInicio) fechaWhere[Op.gte] = new Date(fechaInicio);
      if (fechaFin) fechaWhere[Op.lte] = new Date(fechaFin);

      const fechaQueryAtencion =
        Object.keys(fechaWhere).length > 0
          ? { fecha_inicio_atencion: fechaWhere }
          : {};

      // Para Clase, la fecha es string AAAA-MM-DD
      const fechaWhereClase = {};
      if (fechaInicio) fechaWhereClase[Op.gte] = fechaInicio;
      if (fechaFin) fechaWhereClase[Op.lte] = fechaFin;
      const fechaQueryClase =
        Object.keys(fechaWhereClase).length > 0
          ? { fecha: fechaWhereClase }
          : {};

      const [valoraciones, clasesNinos, evoluciones] = await Promise.all([
        ValoracionFisioterapia.findAll({
          where: fechaQueryAtencion,
          attributes: ["paciente_id"],
          raw: true,
        }),
        ClaseNino.findAll({
          include: [
            {
              model: Clase,
              as: "clase",
              where: fechaQueryClase,
              attributes: ["id"],
            },
          ],
          attributes: ["paciente_id"],
          raw: true,
        }),
        EvolucionSesion.findAll({
          where: fechaQueryAtencion,
          attributes: ["paciente_id"],
          raw: true,
        }),
      ]);

      const idsEncontrados = new Set();

      valoraciones.forEach(
        (v) => v.paciente_id && idsEncontrados.add(v.paciente_id.toString()),
      );
      clasesNinos.forEach(
        (cn) => cn.paciente_id && idsEncontrados.add(cn.paciente_id.toString()),
      );
      evoluciones.forEach(
        (s) => s.paciente_id && idsEncontrados.add(s.paciente_id.toString()),
      );

      idsParaProcesar = Array.from(idsEncontrados);
      console.log(
        `✅ IDs encontrados dinámicamente: ${idsParaProcesar.length}`,
      );
    }

    if (idsParaProcesar.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No se encontraron pacientes con servicios en el rango de fechas especificado",
      });
    }

    // Obtener pacientes
    const pacientes = await Paciente.findAll({
      where: { id: { [Op.in]: idsParaProcesar } },
    });

    console.log(`🔍 Procesando ${pacientes.length} pacientes...`);

    // Preparar datos para el convertidor
    const converterData = {
      numFactura,
      sinFactura,
      pacientes: [],
    };

    for (let i = 0; i < pacientes.length; i++) {
      const paciente = pacientes[i];
      const isKid = ["RC", "TI", "CN"].includes(
        paciente.tipo_documento_identificacion,
      );

      // Construir where clause para fechas
      const fechaWhere = {};
      if (fechaInicio) fechaWhere[Op.gte] = new Date(fechaInicio);
      if (fechaFin) fechaWhere[Op.lte] = new Date(fechaFin);
      const fechaQueryAtencion =
        Object.keys(fechaWhere).length > 0
          ? { fecha_inicio_atencion: fechaWhere }
          : {};

      // Obtener valoraciones
      const valoraciones = await ValoracionFisioterapia.findAll({
        where: { paciente_id: paciente.id, ...fechaQueryAtencion },
        raw: true,
      });

      // Obtener clases asistidas (usando ClaseNino)
      const fechaWhereClase = {};
      if (fechaInicio) fechaWhereClase[Op.gte] = fechaInicio;
      if (fechaFin) fechaWhereClase[Op.lte] = fechaFin;
      const fechaQueryClase =
        Object.keys(fechaWhereClase).length > 0
          ? { fecha: fechaWhereClase }
          : {};

      const clasesNinos = await ClaseNino.findAll({
        where: { paciente_id: paciente.id },
        include: [{ model: Clase, as: "clase", where: fechaQueryClase }],
        raw: true,
      });
      const clasesAsistidas = clasesNinos.map((cn) => cn.clase).filter(Boolean);

      // Obtener evoluciones/sesiones
      const sesiones = await EvolucionSesion.findAll({
        where: { paciente_id: paciente.id, ...fechaQueryAtencion },
        raw: true,
      });

      // 🛑 FILTRO IMPORTANTE: Si el paciente no tiene servicios en este rango, NO incluirlo
      if (
        valoraciones.length === 0 &&
        clasesAsistidas.length === 0 &&
        sesiones.length === 0
      ) {
        continue;
      }

      // Mapear datos unificados
      const pacienteData = {
        paciente: {
          nombres: paciente.nombres || "",
          apellidos: paciente.apellidos || "",
          tipoDocumento:
            paciente.tipo_documento_identificacion || (isKid ? "RC" : "CC"),
          numeroDocumento: paciente.num_documento_identificacion || "",
          fechaNacimiento: paciente.fecha_nacimiento,
          genero: paciente.cod_sexo === "M" ? "Masculino" : "Femenino",
          regimenAfiliacion:
            paciente.tipo_usuario === "04" ? "No asegurado" : "Contributivo",
          codPaisResidencia: paciente.cod_pais_residencia || "170",
          codMunicipioResidencia: paciente.cod_municipio_residencia || "23001",
          codZonaTerritorialResidencia:
            paciente.cod_zona_territorial_residencia || "01",
        },
        valoracionesIngreso: valoraciones.map((v) => ({
          fecha: v.fecha_inicio_atencion,
          motivoDeConsulta: v.motivo_consulta,
          codDiagnosticoPrincipal: v.cod_diagnostico_principal,
          finalidad: v.finalidad_tecnologia_salud,
          causaExterna: v.causa_motivo_atencion,
          codConsulta: v.cod_consulta,
          numAutorizacion: v.num_autorizacion,
          profesionalTratante: {
            nombre: v.firmas?.profesional?.nombre || "Dayan Villegas",
            numeroDocumento:
              v.firmas?.profesional?.registroMedico || "00000000",
          },
          vrServicio: v.vr_servicio || 0,
        })),
        clases: clasesAsistidas.map((c) => ({
          fecha: c.fecha,
          titulo: c.nombre || "Clase de Estimulación",
          instructor: "Dayan Villegas",
          vrServicio: 0, // Las clases suelen estar en paquetes
        })),
        sesionesPerinatales: sesiones.map((s) => ({
          fecha: s.fecha_inicio_atencion,
          profesional: s.firmas?.profesional?.nombre || "Dayan Villegas",
          vrServicio: s.vr_servicio || 0,
        })),
        valoracionesPisoPelvico: [], // En el nuevo modelo, todas son valoracionesIngreso mapeadas arriba
        consecutivo: converterData.pacientes.length + 1,
      };

      converterData.pacientes.push(pacienteData);
    }

    // Convertir a formato RIPS
    const converter = new RIPSConverter();
    const resultado = await converter.convertToRIPS(converterData);

    if (!resultado.isValid) {
      console.error(
        "❌ Errores de validación RIPS:",
        resultado.validationErrors,
      );
      console.warn("⚠️ Advertencias RIPS:", resultado.validationWarnings);
      return res.status(400).json({
        success: false,
        message: "Errores de validación en la generación de RIPS",
        errors: resultado.validationErrors,
        warnings: resultado.validationWarnings,
      });
    }

    // Retornar resultado
    res.json({
      success: true,
      message: "RIPS generado exitosamente",
      data: {
        rips: resultado.rips,
        resumen: {
          usuariosProcesados: resultado.rips.usuarios.length,
          totalConsultas: resultado.rips.usuarios.reduce(
            (sum, u) => sum + (u.servicios?.consultas?.length || 0),
            0,
          ),
          totalProcedimientos: resultado.rips.usuarios.reduce(
            (sum, u) => sum + (u.servicios?.procedimientos?.length || 0),
            0,
          ),
        },
        warnings: resultado.validationWarnings,
      },
    });
  } catch (error) {
    console.error("Error generando RIPS:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor al generar RIPS",
      error: error.message,
    });
  }
});

/**
 * GET /api/rips/validate
 * Valida la estructura de un archivo RIPS
 */
router.post("/validate", authenticate, async (req, res) => {
  try {
    const { ripsData } = req.body;

    if (!ripsData) {
      return res.status(400).json({
        success: false,
        message: "Los datos RIPS son obligatorios",
      });
    }

    const converter = new RIPSConverter();

    // Simular conversión para validar
    const resultado = await converter.convertToRIPS({
      numFactura: ripsData.numFactura || "VALIDATION-001",
      pacientes: [], // No necesitamos pacientes para validación básica
    });

    // Validar estructura específica
    converter.validateRIPS(ripsData);

    res.json({
      success: true,
      message: "Validación completada",
      data: {
        isValid: converter.validationErrors.length === 0,
        errors: converter.validationErrors,
        warnings: converter.validationWarnings,
      },
    });
  } catch (error) {
    console.error("Error validando RIPS:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor al validar RIPS",
      error: error.message,
    });
  }
});

/**
 * GET /api/rips/config
 * Obtiene configuración necesaria para RIPS
 */
router.get("/config", authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      nitFacturador: process.env.NIT_FACTURADOR || "2300101133",
      codPrestador: process.env.COD_PRESTADOR || "230010113301",
      nombrePrestador: "Dayan Ivonne Villegas Gamboa",
      versionResolucion: "Resolución 2275 de 2023 (Sin Factura)",
      formatosFecha: ["AAAA-MM-DD HH:MM"],
      tiposUsuario: {
        "01": "Cotizante",
        "02": "Beneficiario",
        "03": "Especial",
        "04": "No asegurado",
      },
      tiposDocumento: {
        CC: "Cédula ciudadanía",
        TI: "Tarjeta identidad",
        RC: "Registro civil",
        CE: "Cédula extranjería",
        PA: "Pasaporte",
        PE: "Permiso especial",
        CN: "Certificado nacido vivo",
        MS: "Menor sin identificar",
      },
    },
  });
});

module.exports = router;
