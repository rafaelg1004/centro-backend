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
    const { ninoId, numeroFactura } = req.body;
    const clase = await Clase.findByPk(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });

    // Evita duplicados
    const existeNino = await ClaseNino.findOne({
      where: { clase_id: req.params.id, paciente_id: ninoId },
    });

    if (!existeNino) {
      // Si hay numeroFactura, validar y descontar clase
      if (numeroFactura) {
        const paquete = await PagoPaquete.findOne({
          where: { numero_factura: numeroFactura },
        });
        if (!paquete)
          return res.status(404).json({ error: "Factura no encontrada" });

        if (paquete.clases_usadas >= paquete.clases_pagadas) {
          return res
            .status(400)
            .json({ error: "No quedan clases disponibles en este paquete" });
        }

        await paquete.update({ clases_usadas: paquete.clases_usadas + 1 });

        // Crear relación clase-niño con factura
        await ClaseNino.create({
          clase_id: req.params.id,
          paciente_id: ninoId,
          numero_factura: numeroFactura,
        });
      } else {
        // Crear relación clase-niño sin factura
        await ClaseNino.create({
          clase_id: req.params.id,
          paciente_id: ninoId,
          numero_factura: null,
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
    const { ninoId, numeroFactura } = req.body;
    const clase = await Clase.findByPk(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });

    // Buscar el niño en la clase
    const ninoClase = await ClaseNino.findOne({
      where: { clase_id: req.params.id, paciente_id: ninoId },
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
      where: { numero_factura: numeroFactura },
    });
    if (!paquete)
      return res.status(404).json({ error: "Factura no encontrada" });

    if (paquete.clases_usadas >= paquete.clases_pagadas) {
      return res
        .status(400)
        .json({ error: "No quedan clases disponibles en este paquete" });
    }

    // Asignar el paquete y descontar una clase
    await ninoClase.update({ numero_factura: numeroFactura });
    await paquete.update({ clases_usadas: paquete.clases_usadas + 1 });

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
      where: { clase_id: req.params.id, paciente_id: req.body.ninoId },
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
    res.json(clase.toJSON());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/eliminar-nino", async (req, res) => {
  try {
    const { ninoId } = req.body;
    const clase = await Clase.findByPk(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });

    // Busca el niño en la clase
    const ninoClase = await ClaseNino.findOne({
      where: { clase_id: req.params.id, paciente_id: ninoId },
    });
    if (!ninoClase)
      return res.status(404).json({ error: "Niño no encontrado en la clase" });

    // Si tiene factura, resta una clase usada
    if (ninoClase.numero_factura) {
      const paquete = await PagoPaquete.findOne({
        where: { numero_factura: ninoClase.numero_factura },
      });
      if (paquete && paquete.clases_usadas > 0) {
        await paquete.update({ clases_usadas: paquete.clases_usadas - 1 });
      }
    }

    // Elimina el niño de la clase
    await ninoClase.destroy();

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

    // Por cada niño, si tiene numero_factura, resta 1 a clases_usadas en el paquete
    for (const ninoClase of ninosClase) {
      if (ninoClase.numero_factura) {
        const paquete = await PagoPaquete.findOne({
          where: { numero_factura: ninoClase.numero_factura },
        });
        if (paquete && paquete.clases_usadas > 0) {
          await paquete.update({ clases_usadas: paquete.clases_usadas - 1 });
        }
      }
    }

    // Eliminar todas las relaciones clase-niño
    await ClaseNino.destroy({ where: { clase_id: req.params.id } });

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
              as: "clase_ninos", // Usar clase_ninos en lugar de ninos
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
        if (!clase) {
          console.log(`[DEBUG] Relación sin clase:`, r.toJSON());
          return null;
        }

        // Transformar clase_ninos para que tengan nino en lugar de paciente
        if (clase.clase_ninos) {
          clase.ninos = clase.clase_ninos.map((n) => ({
            ...n,
            numero_factura: n.numero_factura,
            nino: n.paciente, // Agregar alias nino para compatibilidad con frontend
          }));
          delete clase.clase_ninos; // Eliminar el campo original
        }

        console.log(
          `[DEBUG] Clase procesada: ${clase.id} - ${clase.nombre}, ninos: ${clase.ninos?.length || 0}`,
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
