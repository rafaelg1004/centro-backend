const express = require("express");
const router = express.Router();
const Clase = require("../models/Clase");
const PagoPaquete = require("../models/PagoPaquete");

// Crear clase
router.post("/", async (req, res) => {
  try {
    const clase = new Clase(req.body);
    await clase.save();
    res.json(clase);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agregar niño a clase (evita duplicados y estructura para firma)
router.post("/:id/agregar-nino", async (req, res) => {
  try {
    const { ninoId, numeroFactura } = req.body;
    const clase = await Clase.findById(req.params.id);

    // Evita duplicados
    if (!clase.ninos.some(n => n.nino.toString() === ninoId)) {
      // Descontar clase usada en el paquete/factura
      const paquete = await PagoPaquete.findOne({ numeroFactura });
      if (!paquete) return res.status(404).json({ error: "Factura no encontrada" });

      if (paquete.clasesUsadas >= paquete.clasesPagadas) {
        return res.status(400).json({ error: "No quedan clases disponibles en este paquete" });
      }

      paquete.clasesUsadas += 1;
      await paquete.save();

      // Agregar el niño con el número de factura
      clase.ninos.push({ nino: ninoId, numeroFactura });
      await clase.save();
    }
    res.json(clase);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar firma de un niño
router.post("/:id/firma-nino", async (req, res) => {
  try {
    const clase = await Clase.findById(req.params.id);
    const nino = clase.ninos.find(n => n.nino.toString() === req.body.ninoId);
    if (nino) {
      nino.firma = req.body.firma;
      await clase.save();
      res.json(clase);
    } else {
      res.status(404).json({ error: "Niño no encontrado en la clase" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener todas las clases
router.get("/", async (req, res) => {
  try {
    const clases = await Clase.find().populate("ninos.nino");
    res.json(clases);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener una clase por ID
router.get("/:id", async (req, res) => {
  try {
    const clase = await Clase.findById(req.params.id).populate("ninos.nino");
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });
    res.json(clase);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar firma al finalizar clase (opcional, si quieres una firma general)
router.post("/:id/firma", async (req, res) => {
  try {
    const clase = await Clase.findById(req.params.id);
    clase.firma = req.body.firma;
    await clase.save();
    res.json(clase);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


router.post("/:id/eliminar-nino", async (req, res) => {
  try {
    const { ninoId } = req.body;
    const clase = await Clase.findById(req.params.id);

    // Busca el niño en la clase
    const ninoClase = clase.ninos.find(n => n.nino.toString() === ninoId);
    if (!ninoClase) return res.status(404).json({ error: "Niño no encontrado en la clase" });

    // Si tiene factura, resta una clase usada
    if (ninoClase.numeroFactura) {
      const paquete = await PagoPaquete.findOne({ numeroFactura: ninoClase.numeroFactura });
      if (paquete && paquete.clasesUsadas > 0) {
        paquete.clasesUsadas -= 1;
        await paquete.save();
      }
    }

    // Elimina el niño de la clase
    clase.ninos = clase.ninos.filter(n => n.nino.toString() !== ninoId);
    await clase.save();

    res.json(clase);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar una clase por ID
router.delete("/:id", async (req, res) => {
  try {
    const clase = await Clase.findById(req.params.id);
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });

    // Por cada niño, si tiene numeroFactura, resta 1 a clasesUsadas en el paquete
    for (const ninoClase of clase.ninos) {
      if (ninoClase.numeroFactura) {
        const paquete = await PagoPaquete.findOne({ numeroFactura: ninoClase.numeroFactura });
        if (paquete && paquete.clasesUsadas > 0) {
          paquete.clasesUsadas -= 1;
          await paquete.save();
        }
      }
    }

    await Clase.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Clase eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ruta para buscar clases donde está inscrito un paciente
router.get("/paciente/:id", async (req, res) => {
  try {
    const clases = await Clase.find({ "ninos.nino": req.params.id });
    res.json(clases);
  } catch (e) {
    res.status(500).json({ error: "Error al buscar clases del paciente" });
  }
});

// Editar (actualizar) una clase por ID
router.put("/:id", async (req, res) => {
  try {
    const clase = await Clase.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!clase) return res.status(404).json({ error: "Clase no encontrada" });
    res.json(clase);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;