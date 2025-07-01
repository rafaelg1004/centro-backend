const express = require("express");
const router = express.Router();
const PagoPaquete = require("../models/PagoPaquete");

router.post("/", async (req, res) => {
  try {
    const nuevo = new PagoPaquete(req.body);
    await nuevo.save();
    res.status(201).json(nuevo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener todos los paquetes de un niño
router.get("/por-nino/:ninoId", async (req, res) => {
  try {
    const paquetes = await PagoPaquete.find({ nino: req.params.ninoId });
    res.json(paquetes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
router.post("/usar-clase", async (req, res) => {
  try {
    const { ninoId, numeroFactura } = req.body;
    const paquete = await PagoPaquete.findOne({ nino: ninoId, numeroFactura });

    if (!paquete) {
      return res.status(404).json({ error: "Paquete no encontrado" });
    }
    if (paquete.clasesUsadas >= paquete.clasesPagadas) {
      return res.status(400).json({ error: "Ya se usaron todas las clases de este paquete" });
    }

    paquete.clasesUsadas += 1;
    await paquete.save();
    res.json(paquete);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// Eliminar una factura/paquete por ID
router.delete("/:id", async (req, res) => {
  try {
    await PagoPaquete.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Factura eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



module.exports = router;