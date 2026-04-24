const express = require("express");
const router = express.Router();
const {
  SesionMensual,
  SesionMensualAsistente,
  Paciente,
  sequelize,
} = require("../models-sequelize");
const { Op } = require("sequelize");

// Obtener resumen por meses (estadísticas) con paginación
router.get("/resumen", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    // Usar SQL raw para obtener resumen por mes
    const resumenQuery = `
      SELECT 
        SUBSTRING(fecha::TEXT, 1, 7) as mes,
        COUNT(*) as total_sesiones,
        COALESCE(SUM(asistentes_count), 0) as total_asistencias
      FROM (
        SELECT s.fecha, COUNT(sa.id) as asistentes_count
        FROM sesion_mensuals s
        LEFT JOIN sesion_mensual_asistentes sa ON s.id = sa.sesion_mensual_id
        GROUP BY s.id, s.fecha
      ) as subquery
      GROUP BY mes
      ORDER BY mes DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const resumen = await sequelize.query(resumenQuery, {
      type: sequelize.QueryTypes.SELECT,
    });

    // Contar meses distintos
    const countQuery = `
      SELECT COUNT(DISTINCT SUBSTRING(fecha::TEXT, 1, 7)) as total
      FROM sesion_mensuals
    `;
    const countResult = await sequelize.query(countQuery, {
      type: sequelize.QueryTypes.SELECT,
    });
    const totalItems = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      data: resumen.map((r) => ({
        _id: r.mes,
        totalSesiones: parseInt(r.total_sesiones),
        totalAsistencias: parseInt(r.total_asistencias),
      })),
      total: totalItems,
      totalPages,
      page,
      limit,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear sesión mensual
router.post("/", async (req, res) => {
  try {
    const sesion = await SesionMensual.create(req.body);
    res.json(sesion);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener todas las sesiones mensuales (con paginación)
router.get("/", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, busqueda } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    let whereClause = {};

    if (fechaInicio || fechaFin) {
      whereClause.fecha = {};
      if (fechaInicio) whereClause.fecha[Op.gte] = fechaInicio;
      if (fechaFin) whereClause.fecha[Op.lte] = fechaFin;
    }

    if (busqueda) {
      whereClause.nombre = { [Op.iLike]: `%${busqueda}%` };
    }

    const total = await SesionMensual.count({ where: whereClause });
    const sesiones = await SesionMensual.findAll({
      where: whereClause,
      include: [
        {
          model: SesionMensualAsistente,
          as: "sesion_asistentes",
          include: [{ model: Paciente, as: "paciente" }],
        },
      ],
      order: [
        ["fecha", "DESC"],
        ["id", "DESC"],
      ],
      offset,
      limit,
    });

    res.json({
      data: sesiones,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener una sesión mensual por ID
router.get("/:id", async (req, res) => {
  try {
    const sesion = await SesionMensual.findByPk(req.params.id, {
      include: [
        {
          model: SesionMensualAsistente,
          as: "sesion_asistentes",
          include: [{ model: Paciente, as: "paciente" }],
        },
      ],
    });
    if (!sesion) return res.status(404).json({ error: "Sesión no encontrada" });
    res.json(sesion);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar sesión mensual (incluyendo asistentes y qué se hizo)
router.put("/:id", async (req, res) => {
  try {
    const {
      generarHash,
      obtenerMetadatosPista,
    } = require("../utils/auditUtils");
    const sesionActual = await SesionMensual.findByPk(req.params.id);

    if (!sesionActual)
      return res.status(404).json({ error: "Sesión no encontrada" });
    if (sesionActual.bloqueada && !req.body.forzarDesbloqueo) {
      return res.status(403).json({ error: "Sesión bloqueada e inmutable" });
    }

    const updateData = { ...req.body };

    // Capture audit trail for signature
    if (
      req.body.firmaFisioterapeuta &&
      req.body.firmaFisioterapeuta !== sesionActual.firma_fisioterapeuta
    ) {
      const metadatos = obtenerMetadatosPista(req);
      metadatos.registroProfesional =
        req.usuario?.registro_medico || "No registrado";
      const auditTrail = sesionActual.audit_trail || {};
      auditTrail.firmaFisioterapeuta = metadatos;
      updateData.audit_trail = auditTrail;
    }

    // Seal registry if blocking
    if (req.body.bloqueada && !sesionActual.bloqueada) {
      updateData.fecha_bloqueo = new Date();
      updateData.sello_integridad = generarHash({
        contenido: req.body,
        auditTrail: updateData.audit_trail || sesionActual.audit_trail,
        fechaBloqueo: updateData.fecha_bloqueo,
      });
    }

    await sesionActual.update(updateData);

    const sesionActualizada = await SesionMensual.findByPk(req.params.id, {
      include: [
        {
          model: SesionMensualAsistente,
          as: "sesion_asistentes",
          include: [{ model: Paciente, as: "paciente" }],
        },
      ],
    });
    res.json(sesionActualizada);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar sesión mensual
router.delete("/:id", async (req, res) => {
  try {
    const sesion = await SesionMensual.findByPk(req.params.id);
    if (!sesion) return res.status(404).json({ error: "Sesión no encontrada" });
    await sesion.destroy();
    res.json({ mensaje: "Sesión eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
