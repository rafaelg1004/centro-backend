const express = require("express");
const router = express.Router();
const {
  ValoracionFisioterapia,
  Paciente,
  Usuario,
  ConfiguracionClinica,
} = require("../models-sequelize");


/**
 * GET /api/valoraciones/reporte/exportar-pdf/:id
 * Exporta una valoración completa con firmas desde el backend.
 * Ahora busca en la colección única `valoracionfisioterapias`.
 */
router.get("/exportar-pdf/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    // Buscar en el modelo unificado
    const valoracion = await ValoracionFisioterapia.findByPk(id);
    if (!valoracion) {
      return res.status(404).json({ message: "Valoración no encontrada" });
    }

    // Cargar paciente y creador manualmente
    const pacienteData = await Paciente.findByPk(valoracion.paciente_id);
    const creadorData = await Usuario.findByPk(valoracion.creado_por || valoracion.usuario_id, {
      attributes: ["nombre", "registro_medico", "firma_url"],
    });

    if (!valoracion) {
      return res.status(404).json({ message: "Valoración no encontrada" });
    }

    // Determinar el tipo de reporte según el módulo activo y el paciente
    const modLactancia = valoracion.modulo_lactancia || {};
    const modPisoPelvico = valoracion.modulo_piso_pelvico || {};
    const modPediatria = valoracion.modulo_pediatria || {};
    const tp = (valoracion.tipo_programa || "").toLowerCase();
    const legacy = valoracion.datos_legacy || valoracion._datos_legacy || {};

    const esPediatrico =
      tp.includes("pediatr") ||
      tp.includes("estimulaci") ||
      Boolean(modPediatria && Object.keys(modPediatria).length > 0 && Object.values(modPediatria).some(v => v && (typeof v !== 'object' || Object.keys(v).length > 0))) ||
      (legacy && String(legacy.tipoPrograma || "").toLowerCase().includes("pediatr")) ||
      (pacienteData && pacienteData.fecha_nacimiento && (() => {
        const diffAnios = (new Date() - new Date(pacienteData.fecha_nacimiento)) / (1000 * 60 * 60 * 24 * 365.25);
        return diffAnios < 12;
      })());

    let reportType = type;
    if (esPediatrico && (!reportType || reportType === "perinatal")) {
      reportType = "nino";
    } else if (!reportType) {
      if (modPediatria.desarrollo_motor || modPediatria.desarrolloMotor) reportType = "nino";
      else if (modPisoPelvico.icicq_frecuencia) reportType = "adulto";
      else if (modLactancia.experiencia_lactancia) reportType = "lactancia";
      else if (tp.includes("lactancia")) reportType = "lactancia";
      else if (tp.includes("piso") || valoracion.cod_consulta === "890202") reportType = "adulto";
      else if (tp.includes("perinatal")) reportType = "perinatal";
      else reportType = "nino";
    }

    const paciente = pacienteData
      ? pacienteData.toJSON()
      : {
        nombres: valoracion.nombres || "Paciente Desconocido",
        cedula: valoracion.num_documento_identificacion || "S/D",
        genero: valoracion.cod_sexo || "N/A",
      };

    // Datos del profesional: se toman del usuario que CREÓ la valoración
    const creador = creadorData ? creadorData.toJSON() : null;
    const profesional = {
      nombre: creador?.nombre || "Ft. Dayan Ivonne Villegas Gamboa",
      registroMedico:
        creador?.registro_medico || "52862625 - Reg. Salud Departamental",
      firmaUrl: creador?.firma_url || null, // null = no se pinta nada
    };

    // Obtener la configuración dinámica de la clínica
    let configClinica = await ConfiguracionClinica.findOne();
    if (!configClinica) {
      // Si no existe, usar valores por defecto (fallback seguro)
      configClinica = {
        nombre_clinica: "D'Mamitas & Babies",
        slogan: "Centro de Estimulación, Fisioterapia y Programas Perinatales",
        codigo_habilitacion: "Sin Registro",
        direccion: "Cra 1 W 28-47, Tunja",
        telefono: "+57 317 2774885"
      };
    } else {
      configClinica = configClinica.toJSON();
    }

    // Intentar cargar el generador de PDF si existe
    try {
      const pdfGenerator = require("../utils/pdfReportGenerator");
      const pdfBuffer = await pdfGenerator.generateValuationPDF(
        valoracion.toJSON ? valoracion.toJSON() : valoracion,
        paciente,
        reportType,
        profesional,
        configClinica
      );
      const sanitizedName = (paciente.nombres || "REPORTE").replace(
        /\s+/g,
        "_",
      );
      const fileName = `REPORTE_${reportType.toUpperCase()}_${sanitizedName}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.send(pdfBuffer);
    } catch (pdfErr) {
      // Si el generador de PDF falla, devolver los datos en JSON para debug
      console.warn(
        "PDF generator not available, returning JSON data:",
        pdfErr.message,
      );
      res.json({ valoracion, paciente, reportType });
    }
  } catch (error) {
    console.error("Error exportando reporte PDF:", error);
    res
      .status(500)
      .json({
        message: "Error interno al generar el reporte",
        error: error.message,
      });
  }
});

module.exports = router;
