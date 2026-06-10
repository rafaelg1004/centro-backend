const express = require("express");
const router = express.Router();
const {
  Clase,
  ClaseNino,
  PagoPaquete,
  Paciente,
} = require("../models-sequelize");
const { Op } = require("sequelize");



// Crear clase
router.post("/", async (req, res) => {
  try {
    const clase = await Clase.create(req.body);
    res.json(clase);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agregar niño a clase (evita duplicados y estructura para firma)
router.post("/:id/agregar-nino", async (req, res) => {
  try {
    const { paciente_id, firma, numero_factura } = req.body;
    const clase = await Clase.findByPk(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });

    // Evita duplicados
    const existeNino = await ClaseNino.findOne({
      where: { clase_id: req.params.id, paciente_id },
    });

    if (!existeNino) {
      // Si hay numero_factura, validar y descontar clase
      if (numero_factura) {
        const paquete = await PagoPaquete.findOne({
          where: { numero_factura },
        });
        if (!paquete)
          return res.status(404).json({ error: "Factura no encontrada" });

        // Validar contra conteo REAL de ClaseNino (no el contador desfasado)
        const usadasReales = await ClaseNino.count({
          where: { numero_factura },
        });
        if (usadasReales >= paquete.clases_pagadas) {
          return res
            .status(400)
            .json({ error: "No quedan clases disponibles en este paquete" });
        }

        // Crear relación clase-niño con factura
        await ClaseNino.create({
          clase_id: req.params.id,
          paciente_id,
          numero_factura,
          firma,
        });

        // Sincronizar contador con conteo real
        const nuevoConteo = await ClaseNino.count({
          where: { numero_factura },
        });
        await paquete.update({ clases_usadas: nuevoConteo });
      } else {
        // Crear relación clase-niño sin factura
        await ClaseNino.create({
          clase_id: req.params.id,
          paciente_id,
          numero_factura: null,
          firma,
        });
      }
    }

    // Retornar clase con niños actualizados
    const claseActualizada = await Clase.findByPk(req.params.id, {
      include: [
        {
          model: ClaseNino,
          as: "ninos",
          include: [
            {
              model: Paciente,
              as: "paciente",
              attributes: ["id", "nombres", "apellidos"],
            },
          ],
        },
      ],
    });
    res.json(claseActualizada);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Asignar paquete a un niño ya agregado a la clase
router.post("/:id/asignar-paquete", async (req, res) => {
  try {
    const { paciente_id, numero_factura } = req.body;
    const clase = await Clase.findByPk(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });

    // Buscar el niño en la clase
    const ninoClase = await ClaseNino.findOne({
      where: { clase_id: req.params.id, paciente_id },
    });
    if (!ninoClase)
      return res.status(404).json({ error: "Niño no encontrado en la clase" });

    // Verificar que no tenga ya un paquete asignado
    if (ninoClase.numero_factura) {
      return res
        .status(400)
        .json({ error: "Este niño ya tiene un paquete asignado" });
    }

    // Validar el paquete
    const paquete = await PagoPaquete.findOne({
      where: { numero_factura },
    });
    if (!paquete)
      return res.status(404).json({ error: "Factura no encontrada" });

    // Validar contra conteo REAL de ClaseNino (no el contador desfasado)
    const usadasReales = await ClaseNino.count({
      where: { numero_factura },
    });
    if (usadasReales >= paquete.clases_pagadas) {
      return res
        .status(400)
        .json({ error: "No quedan clases disponibles en este paquete" });
    }

    // Asignar el paquete
    await ninoClase.update({ numero_factura });

    // Sincronizar contador con conteo real
    const nuevoConteo = await ClaseNino.count({
      where: { numero_factura },
    });
    await paquete.update({ clases_usadas: nuevoConteo });

    const claseActualizada = await Clase.findByPk(req.params.id, {
      include: [
        {
          model: ClaseNino,
          as: "ninos",
          include: [
            {
              model: Paciente,
              as: "paciente",
              attributes: ["id", "nombres", "apellidos"],
            },
          ],
        },
      ],
    });
    res.json(claseActualizada);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar firma de un niño
router.post("/:id/firma-nino", async (req, res) => {
  try {
    const { obtenerMetadatosPista } = require("../utils/auditUtils");
    const clase = await Clase.findByPk(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });
    if (clase.bloqueada)
      return res.status(403).json({ error: "Clase bloqueada" });

    const ninoClase = await ClaseNino.findOne({
      where: { clase_id: req.params.id, paciente_id: req.body.paciente_id },
    });
    if (!ninoClase)
      return res.status(404).json({ error: "Niño no encontrado en la clase" });

    await ninoClase.update({
      firma: req.body.firma,
      audit_trail: obtenerMetadatosPista(req),
    });

    const claseActualizada = await Clase.findByPk(req.params.id, {
      include: [
        {
          model: ClaseNino,
          as: "ninos",
          include: [
            {
              model: Paciente,
              as: "paciente",
              attributes: ["id", "nombres", "apellidos"],
            },
          ],
        },
      ],
    });
    res.json(claseActualizada);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener todas las clases (con filtros opcionales y paginación)
router.get("/", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, busqueda } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    let whereClause = {};

    // Filtros de fecha
    if (fechaInicio || fechaFin) {
      whereClause.fecha = {};
      if (fechaInicio) whereClause.fecha[Op.gte] = fechaInicio;
      if (fechaFin) whereClause.fecha[Op.lte] = fechaFin;
    }

    // Filtro de búsqueda por nombre
    if (busqueda) {
      whereClause.nombre = { [Op.iLike]: `%${busqueda}%` };
    }

    const total = await Clase.count({ where: whereClause });
    const clases = await Clase.findAll({
      where: whereClause,
      order: [
        ["fecha", "DESC"],
        ["id", "DESC"],
      ],
      offset,
      limit,
    });

    res.json({
      data: clases,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error("Error al obtener clases:", e);
    res.status(500).json({ error: e.message });
  }
});

// Obtener una clase por ID
router.get("/:id", async (req, res) => {
  try {
    const clase = await Clase.findByPk(req.params.id, {
      include: [
        {
          model: ClaseNino,
          as: "ninos",
          include: [
            {
              model: Paciente,
              as: "paciente",
            },
          ],
        },
      ],
    });
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });
    res.json(clase);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar firma al finalizar clase (opcional, si quieres una firma general)
router.post("/:id/firma", async (req, res) => {
  try {
    const { obtenerMetadatosPista } = require("../utils/auditUtils");
    const clase = await Clase.findByPk(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });
    if (clase.bloqueada)
      return res.status(403).json({ error: "Clase bloqueada" });

    await clase.update({
      firma: req.body.firma,
      audit_trail: obtenerMetadatosPista(req),
    });
    res.json(clase);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/eliminar-nino", async (req, res) => {
  try {
    const { paciente_id } = req.body;
    const clase = await Clase.findByPk(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });

    // Busca el niño en la clase
    const ninoClase = await ClaseNino.findOne({
      where: { clase_id: req.params.id, paciente_id },
    });
    if (!ninoClase)
      return res.status(404).json({ error: "Niño no encontrado en la clase" });

    const facturaEliminada = ninoClase.numero_factura;

    // Elimina el niño de la clase
    await ninoClase.destroy();

    // Recalcular contador del paquete con conteo real
    if (facturaEliminada) {
      const paquete = await PagoPaquete.findOne({
        where: { numero_factura: facturaEliminada },
      });
      if (paquete) {
        const nuevoConteo = await ClaseNino.count({
          where: { numero_factura: facturaEliminada },
        });
        await paquete.update({ clases_usadas: nuevoConteo });
      }
    }

    const claseActualizada = await Clase.findByPk(req.params.id, {
      include: [
        {
          model: ClaseNino,
          as: "ninos",
          include: [
            {
              model: Paciente,
              as: "paciente",
              attributes: ["id", "nombres", "apellidos"],
            },
          ],
        },
      ],
    });
    res.json(claseActualizada);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar una clase por ID
router.delete("/:id", async (req, res) => {
  try {
    const clase = await Clase.findByPk(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });

    // Obtener todos los niños de la clase
    const ninosClase = await ClaseNino.findAll({
      where: { clase_id: req.params.id },
    });

    // Recopilar facturas únicas para recalcular después
    const facturasAfectadas = new Set();
    for (const ninoClase of ninosClase) {
      if (ninoClase.numero_factura) {
        facturasAfectadas.add(ninoClase.numero_factura);
      }
    }

    // Eliminar todas las relaciones clase-niño
    await ClaseNino.destroy({ where: { clase_id: req.params.id } });

    // Recalcular contadores de paquetes afectados
    for (const numFactura of facturasAfectadas) {
      const paquete = await PagoPaquete.findOne({
        where: { numero_factura: numFactura },
      });
      if (paquete) {
        const nuevoConteo = await ClaseNino.count({
          where: { numero_factura: numFactura },
        });
        await paquete.update({ clases_usadas: nuevoConteo });
      }
    }

    // Eliminar la clase
    await clase.destroy();
    res.json({ mensaje: "Clase eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ruta para buscar clases donde está inscrito un paciente
router.get("/paciente/:id", async (req, res) => {
  try {
    const pacienteId = req.params.id;
    console.log(`[DEBUG] Buscando clases para paciente: ${pacienteId}`);

    // Buscar todas las relaciones clase-niño para este paciente
    const relaciones = await ClaseNino.findAll({
      where: { paciente_id: pacienteId },
      include: [
        {
          model: Clase,
          as: "clase",
          include: [
            {
              model: ClaseNino,
              as: "ninos",

              include: [
                {
                  model: Paciente,
                  as: "paciente",
                  attributes: ["id", "nombres", "apellidos"],
                },
              ],
            },
          ],
        },
      ],
    });

    console.log(`[DEBUG] Relaciones encontradas: ${relaciones.length}`);

    // Mapear al formato esperado por el frontend (n.nino en lugar de n.paciente)
    const clases = relaciones
      .map((r) => {
        const clase = r.clase?.toJSON();
        if (!clase) return null;
        
        console.log(
          `[DEBUG] Clase procesada: ${clase.id} - ${clase.nombre}, ninos: ${clase.ninos?.length || 0}`
        );
        return clase;
      })
      .filter((c) => c !== null);

    console.log(`[DEBUG] Total clases a devolver: ${clases.length}`);
    res.json(clases);
  } catch (e) {
    console.error("[DEBUG] Error al buscar clases del paciente:", e);
    res.status(500).json({ error: "Error al buscar clases del paciente" });
  }
});

// Editar (actualizar) una clase por ID
router.put("/:id", async (req, res) => {
  try {
    const {
      generarHash,
      obtenerMetadatosPista,
    } = require("../utils/auditUtils");
    const claseActual = await Clase.findByPk(req.params.id);
    if (!claseActual)
      return res.status(404).json({ error: "Clase no encontrada" });
    if (claseActual.bloqueada)
      return res.status(403).json({ error: "Clase bloqueada" });

    const updateData = { ...req.body };

    // Si se está bloqueando el registro
    if (req.body.bloqueada && !claseActual.bloqueada) {
      updateData.fecha_bloqueo = new Date();
      updateData.sello_integridad = generarHash({
        contenido: req.body,
        auditTrail: req.body.audit_trail || claseActual.audit_trail,
        fechaBloqueo: updateData.fecha_bloqueo,
      });
    }

    await claseActual.update(updateData);
    res.json(claseActual.toJSON());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
