const express = require("express");
const router = express.Router();
const SesionMensual = require("../models/SesionMensual");

// Obtener resumen por meses (estadísticas) con paginación
router.get("/resumen", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const pipelineCount = [
      {
        $project: {
          mes: { $substr: ["$fecha", 0, 7] }
        }
      },
      {
        $group: {
          _id: "$mes"
        }
      },
      {
        $count: "total"
      }
    ];

    const countResult = await SesionMensual.aggregate(pipelineCount);
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalItems / limit);

    const resumen = await SesionMensual.aggregate([
      {
        $project: {
          mes: { $substr: ["$fecha", 0, 7] }, // YYYY-MM
          asistentesCount: { $size: "$asistentes" }
        }
      },
      {
        $group: {
          _id: "$mes",
          totalSesiones: { $sum: 1 },
          totalAsistencias: { $sum: "$asistentesCount" }
        }
      },
      { $sort: { _id: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    res.json({
      data: resumen,
      total: totalItems,
      totalPages,
      page,
      limit
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear sesión mensual
router.post("/", async (req, res) => {
  try {
    const sesion = new SesionMensual(req.body);
    await sesion.save();
    res.json(sesion);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear sesión mensual

// Obtener todas las sesiones mensuales (con paginación)
router.get("/", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, busqueda } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};

    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) query.fecha.$gte = fechaInicio;
      if (fechaFin) query.fecha.$lte = fechaFin;
    }

    if (busqueda) {
      query.nombre = { $regex: busqueda, $options: "i" };
    }

    const total = await SesionMensual.countDocuments(query);
    const sesiones = await SesionMensual.find(query)
      .populate("asistentes.nino")
      .sort({ fecha: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      data: sesiones,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener una sesión mensual por ID
router.get("/:id", async (req, res) => {
  try {
    const sesion = await SesionMensual.findById(req.params.id).populate("asistentes.nino");
    if (!sesion) return res.status(404).json({ error: "Sesión no encontrada" });
    res.json(sesion);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar sesión mensual (incluyendo asistentes y qué se hizo)
router.put("/:id", async (req, res) => {
  try {
    const sesion = await SesionMensual.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!sesion) return res.status(404).json({ error: "Sesión no encontrada" });
    res.json(sesion);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar sesión mensual
router.delete("/:id", async (req, res) => {
  try {
    await SesionMensual.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Sesión eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
