const express = require("express");
const router = express.Router();
const { sequelize } = require("../database/config");

/**
 * Módulo de Cumpleaños - Centro de Salud D'Mamitas
 * Consulta la vista `v_proximos_cumpleanos` en PostgreSQL.
 */

// GET /api/cumpleanos/proximos
// Filtra próximos cumpleaños por días faltantes (por defecto 30), mes, o búsqueda de paciente.
router.get("/proximos", async (req, res) => {
  try {
    const {
      dias = 30,
      mes,
      adulto,
      search,
      limit = 50,
      offset = 0,
    } = req.query;

    const parsedDias = parseInt(dias, 10);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const conditions = [];
    const replacements = {
      limit: parsedLimit,
      offset: parsedOffset,
    };

    if (!isNaN(parsedDias) && parsedDias >= 0) {
      conditions.push("dias_faltantes <= :dias");
      replacements.dias = parsedDias;
    }

    if (mes !== undefined) {
      const parsedMes = parseInt(mes, 10);
      if (parsedMes >= 1 && parsedMes <= 12) {
        conditions.push("EXTRACT(MONTH FROM fecha_nacimiento) = :mes");
        replacements.mes = parsedMes;
      }
    }

    if (adulto !== undefined) {
      conditions.push("es_adulto = :adulto");
      replacements.adulto = adulto === "true" || adulto === true || adulto === "1";
    }

    if (search && search.trim()) {
      conditions.push(
        "(nombre_completo ILIKE :search OR num_documento_identificacion ILIKE :search)"
      );
      replacements.search = `%${search.trim()}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Conteo total para paginación
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM v_proximos_cumpleanos
      ${whereClause}
    `;
    const [countResult] = await sequelize.query(countQuery, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });
    const total = parseInt(countResult?.total || 0, 10);

    // Consulta de registros ordenados por proximidad
    const dataQuery = `
      SELECT 
        paciente_id,
        tipo_documento_identificacion,
        num_documento_identificacion,
        nombre_completo,
        nombres,
        apellidos,
        fecha_nacimiento,
        es_adulto,
        nombre_madre,
        nombre_padre,
        telefono,
        direccion,
        nombre_acompanante,
        proximo_cumpleanos,
        dias_faltantes,
        edad_actual,
        edad_a_cumplir
      FROM v_proximos_cumpleanos
      ${whereClause}
      ORDER BY dias_faltantes ASC, nombre_completo ASC
      LIMIT :limit OFFSET :offset
    `;
    const pacientes = await sequelize.query(dataQuery, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    // Resumen de métricas rápidas
    const summaryQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE dias_faltantes = 0) AS hoy,
        COUNT(*) FILTER (WHERE dias_faltantes <= 7) AS esta_semana,
        COUNT(*) FILTER (WHERE dias_faltantes <= 30) AS este_mes
      FROM v_proximos_cumpleanos
    `;
    const [summaryResult] = await sequelize.query(summaryQuery, {
      type: sequelize.QueryTypes.SELECT,
    });

    res.json({
      success: true,
      resumen: {
        hoy: parseInt(summaryResult?.hoy || 0, 10),
        esta_semana: parseInt(summaryResult?.esta_semana || 0, 10),
        este_mes: parseInt(summaryResult?.este_mes || 0, 10),
        total_en_rango: total,
      },
      data: pacientes,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  } catch (error) {
    console.error("❌ Error en GET /api/cumpleanos/proximos:", error);
    res.status(500).json({
      success: false,
      error: "Error interno al consultar próximos cumpleaños",
      detalles: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/cumpleanos/hoy
// Retorna exclusivamente los pacientes que cumplen años hoy (dias_faltantes = 0)
router.get("/hoy", async (req, res) => {
  try {
    const query = `
      SELECT 
        paciente_id,
        tipo_documento_identificacion,
        num_documento_identificacion,
        nombre_completo,
        nombres,
        apellidos,
        fecha_nacimiento,
        es_adulto,
        telefono,
        direccion,
        nombre_acompanante,
        proximo_cumpleanos,
        dias_faltantes,
        edad_actual,
        edad_a_cumplir
      FROM v_proximos_cumpleanos
      WHERE dias_faltantes = 0
      ORDER BY nombre_completo ASC
    `;

    const pacientes = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
    });

    res.json({
      success: true,
      total: pacientes.length,
      data: pacientes,
    });
  } catch (error) {
    console.error("❌ Error en GET /api/cumpleanos/hoy:", error);
    res.status(500).json({
      success: false,
      error: "Error interno al consultar los cumpleaños de hoy",
    });
  }
});

// GET /api/cumpleanos/mes/:mes
// Retorna los cumpleaños de un mes específico (1-12) ordenados por día del mes
router.get("/mes/:mes", async (req, res) => {
  try {
    const mes = parseInt(req.params.mes, 10);
    if (isNaN(mes) || mes < 1 || mes > 12) {
      return res.status(400).json({
        success: false,
        error: "El mes debe ser un número entero entre 1 y 12",
      });
    }

    const query = `
      SELECT 
        paciente_id,
        tipo_documento_identificacion,
        num_documento_identificacion,
        nombre_completo,
        fecha_nacimiento,
        es_adulto,
        telefono,
        proximo_cumpleanos,
        dias_faltantes,
        edad_actual,
        edad_a_cumplir
      FROM v_proximos_cumpleanos
      WHERE EXTRACT(MONTH FROM fecha_nacimiento) = :mes
      ORDER BY EXTRACT(DAY FROM fecha_nacimiento) ASC, nombre_completo ASC
    `;

    const pacientes = await sequelize.query(query, {
      replacements: { mes },
      type: sequelize.QueryTypes.SELECT,
    });

    res.json({
      success: true,
      mes,
      total: pacientes.length,
      data: pacientes,
    });
  } catch (error) {
    console.error(`❌ Error en GET /api/cumpleanos/mes/${req.params.mes}:`, error);
    res.status(500).json({
      success: false,
      error: "Error interno al consultar cumpleaños del mes",
    });
  }
});

// GET /api/cumpleanos/estadisticas
// Distribución mensual y contadores generales
router.get("/estadisticas", async (req, res) => {
  try {
    const contadoresQuery = `
      SELECT 
        COUNT(*) AS total_con_fecha,
        COUNT(*) FILTER (WHERE dias_faltantes = 0) AS hoy,
        COUNT(*) FILTER (WHERE dias_faltantes <= 7) AS proximos_7_dias,
        COUNT(*) FILTER (WHERE dias_faltantes <= 15) AS proximos_15_dias,
        COUNT(*) FILTER (WHERE dias_faltantes <= 30) AS proximos_30_dias
      FROM v_proximos_cumpleanos
    `;

    const distribucionQuery = `
      SELECT 
        EXTRACT(MONTH FROM fecha_nacimiento)::int AS mes,
        COUNT(*)::int AS total
      FROM pacientes
      WHERE fecha_nacimiento IS NOT NULL
      GROUP BY EXTRACT(MONTH FROM fecha_nacimiento)
      ORDER BY mes ASC
    `;

    const [[contadores], distribucion] = await Promise.all([
      sequelize.query(contadoresQuery, { type: sequelize.QueryTypes.SELECT }),
      sequelize.query(distribucionQuery, { type: sequelize.QueryTypes.SELECT }),
    ]);

    const mesesNombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const distribucionCompleta = mesesNombres.map((nombre, idx) => {
      const numMes = idx + 1;
      const encontrado = distribucion.find((d) => d.mes === numMes);
      return {
        mes: numMes,
        nombre,
        total: encontrado ? encontrado.total : 0,
      };
    });

    res.json({
      success: true,
      resumen: {
        total_pacientes: parseInt(contadores?.total_con_fecha || 0, 10),
        hoy: parseInt(contadores?.hoy || 0, 10),
        proximos_7_dias: parseInt(contadores?.proximos_7_dias || 0, 10),
        proximos_15_dias: parseInt(contadores?.proximos_15_dias || 0, 10),
        proximos_30_dias: parseInt(contadores?.proximos_30_dias || 0, 10),
      },
      distribucion_mensual: distribucionCompleta,
    });
  } catch (error) {
    console.error("❌ Error en GET /api/cumpleanos/estadisticas:", error);
    res.status(500).json({
      success: false,
      error: "Error interno al consultar estadísticas de cumpleaños",
    });
  }
});

module.exports = router;
