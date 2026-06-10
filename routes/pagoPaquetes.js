const express = require("express");
const router = express.Router();
const {
  PagoPaquete,
  Paciente,
  Clase,
  ClaseNino,
} = require("../models-sequelize");
const { Op } = require("sequelize");

router.post("/", async (req, res) => {
  console.log("Datos recibidos para nuevo paquete:", req.body);
  try {
    const nuevo = await PagoPaquete.create(req.body);
    res.status(201).json(nuevo);
  } catch (e) {
    console.error("Error al crear paquete:", e);
    res.status(500).json({ error: e.message });
  }
});

// Obtener todos los paquetes de un niño
router.get("/por-nino/:paciente_id", async (req, res) => {
  try {
    const paquetes = await PagoPaquete.findAll({
      where: { paciente_id: req.params.paciente_id },
    });
    res.json(paquetes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Buscar paquetes por número de factura para un niño específico
router.get("/buscar-por-nino/:paciente_id", async (req, res) => {
  try {
    const { paciente_id } = req.params;
    const { query } = req.query;

    let whereClause = { paciente_id };

    if (query && query.trim()) {
      whereClause.numero_factura = { [Op.iLike]: `%${query.trim()}%` };
    }

    const paquetes = await PagoPaquete.findAll({
      where: whereClause,
      order: [["fecha_pago", "DESC"]],
    });

    res.json(paquetes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reporte completo de paquetes con información de pacientes
router.get("/reporte", async (req, res) => {
  try {
    const paquetes = await PagoPaquete.findAll({
      include: [{ model: Paciente, as: "paciente" }],
      order: [["fecha_pago", "DESC"]],
    });

    const paquetesFiltrados = paquetes.filter((paquete) => paquete.paciente);

    const reporte = await Promise.all(
      paquetesFiltrados.map(async (paquete) => {
        // Buscar clases donde se está usando este paquete (usando ClaseNino)
        const clasesConPaquete = await ClaseNino.findAll({
          where: { numero_factura: paquete.numero_factura },
          include: [{ model: Clase, as: "clase" }],
        });

        // Buscar clases donde está el paciente pero sin paquete
        const clasesSinPaquete = await ClaseNino.findAll({
          where: {
            paciente_id: paquete.paciente.id,
            numero_factura: { [Op.or]: [null, ""] },
          },
          include: [{ model: Clase, as: "clase" }],
        });

        const clasesDisponibles = paquete.clases_pagadas - paquete.clases_usadas;
        const porcentajeUso = paquete.clases_pagadas > 0
          ? Math.round((paquete.clases_usadas / paquete.clases_pagadas) * 100)
          : 0;

        return {
          id: paquete.id,
          paciente: {
            id: paquete.paciente.id,
            nombres: paquete.paciente.nombres,
            apellidos: paquete.paciente.apellidos,
            num_documento_identificacion: paquete.paciente.num_documento_identificacion,
            cod_sexo: paquete.paciente.cod_sexo,
            fecha_nacimiento: paquete.paciente.fecha_nacimiento,
            datos_contacto: paquete.paciente.datos_contacto,
          },
          numero_factura: paquete.numero_factura,
          clases_pagadas: paquete.clases_pagadas,
          clases_usadas: paquete.clases_usadas,
          clases_disponibles: clasesDisponibles,
          clasesDisponibles: clasesDisponibles,
          porcentaje_uso: porcentajeUso,
          porcentajeUso: porcentajeUso,
          fecha_pago: paquete.fecha_pago,
          estado:
            paquete.clases_usadas >= paquete.clases_pagadas
              ? "Agotado"
              : "Activo",
          clases_con_paquete: clasesConPaquete.map((cn) => ({
            id: cn.clase?.id,
            nombre: cn.clase?.nombre,
            fecha: cn.clase?.fecha,
          })),
          clasesConPaquete: clasesConPaquete.map((cn) => ({
            id: cn.clase?.id,
            nombre: cn.clase?.nombre,
            fecha: cn.clase?.fecha,
          })),
          clases_sin_paquete: clasesSinPaquete.map((cn) => ({
            id: cn.clase?.id,
            nombre: cn.clase?.nombre,
            fecha: cn.clase?.fecha,
          })),
          clasesSinPaquete: clasesSinPaquete.map((cn) => ({
            id: cn.clase?.id,
            nombre: cn.clase?.nombre,
            fecha: cn.clase?.fecha,
          })),
        };
      }),
    );

    res.json(reporte);
  } catch (e) {
    console.error("Error al generar reporte de paquetes:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/usar-clase", async (req, res) => {
  try {
    const { paciente_id, numero_factura } = req.body;
    const paquete = await PagoPaquete.findOne({
      where: { paciente_id, numero_factura },
    });

    if (!paquete) {
      return res.status(404).json({ error: "Paquete no encontrado" });
    }
    if (paquete.clases_usadas >= paquete.clases_pagadas) {
      return res
        .status(400)
        .json({ error: "Ya se usaron todas las clases de este paquete" });
    }

    await paquete.update({ clases_usadas: paquete.clases_usadas + 1 });
    res.json(paquete.toJSON());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener un paquete específico por ID (DEBE IR DESPUÉS DE LAS RUTAS ESPECÍFICAS)
router.get("/:id", async (req, res) => {
  try {
    const paquete = await PagoPaquete.findByPk(req.params.id, {
      include: [{ model: Paciente, as: "paciente" }],
    });

    if (!paquete) {
      return res.status(404).json({ error: "Paquete no encontrado" });
    }

    res.json(paquete.toJSON());
  } catch (e) {
    console.error("Error al obtener paquete:", e);
    res.status(500).json({ error: e.message });
  }
});

// Actualizar un paquete por ID
router.put("/:id", async (req, res) => {
  try {
    const { numero_factura, clases_pagadas, fecha_pago } = req.body;

    // Validaciones
    if (!numero_factura || !numero_factura.trim()) {
      return res
        .status(400)
        .json({ error: "El número de factura es obligatorio" });
    }

    if (!clases_pagadas || clases_pagadas <= 0) {
      return res
        .status(400)
        .json({ error: "El número de clases pagadas debe ser mayor a 0" });
    }

    const paquete = await PagoPaquete.findByPk(req.params.id);
    if (!paquete) {
      return res.status(404).json({ error: "Paquete no encontrado" });
    }

    // Verificar que las clases pagadas no sean menores a las ya usadas
    if (clases_pagadas < paquete.clases_usadas) {
      return res.status(400).json({
        error: `No puedes establecer menos clases pagadas (${clases_pagadas}) que las ya usadas (${paquete.clases_usadas})`,
      });
    }

    // Verificar que el número de factura sea único (si es diferente al actual)
    if (numero_factura !== paquete.numero_factura) {
      const facturaExistente = await PagoPaquete.findOne({
        where: {
          numero_factura: numero_factura.trim(),
          id: { [Op.ne]: req.params.id },
        },
      });

      if (facturaExistente) {
        return res
          .status(400)
          .json({ error: "Ya existe un paquete con este número de factura" });
      }
    }

    // Actualizar el paquete
    await paquete.update({
      numero_factura: numero_factura.trim(),
      clases_pagadas: parseInt(clases_pagadas),
      fecha_pago,
    });

    // Obtener el paquete actualizado con paciente
    const paqueteActualizado = await PagoPaquete.findByPk(req.params.id, {
      include: [{ model: Paciente, as: "paciente" }],
    });

    res.json(paqueteActualizado.toJSON());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar una factura/paquete por ID
router.delete("/:id", async (req, res) => {
  try {
    const paquete = await PagoPaquete.findByPk(req.params.id);
    if (!paquete) {
      return res.status(404).json({ error: "Paquete no encontrado" });
    }

    // Verificar si la factura está siendo usada en alguna clase (usando ClaseNino)
    const clasesConFactura = await ClaseNino.findAll({
      where: { numero_factura: paquete.numero_factura },
    });

    if (clasesConFactura.length > 0) {
      // Obtener nombres de clases
      const clasesIds = clasesConFactura.map((cn) => cn.clase_id);
      const clases = await Clase.findAll({
        where: { id: { [Op.in]: clasesIds } },
      });
      const nombresClases = clases.map((c) => c.nombre).join(", ");

      return res.status(400).json({
        error:
          "No se puede eliminar la factura porque está siendo usada en sesiones",
        clasesAfectadas: clasesConFactura.length,
        nombresClases: nombresClases,
        mensaje: `Esta factura está siendo usada en ${clasesConFactura.length} sesión(es): ${nombresClases}. Para eliminar esta factura, primero debe ir a cada sesión y eliminar al paciente de la lista de inscritos.`,
      });
    }

    await paquete.destroy();
    res.json({ mensaje: "Factura eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
