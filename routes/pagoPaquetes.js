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
// Reporte completo de paquetes con información de pacientes
router.get("/reporte", async (req, res) => {
  try {
    const paquetes = await PagoPaquete.find()
      .populate('nino', 'nombres registroCivil genero edad celular')
      .sort({ fechaPago: -1 });

    const paquetesFiltrados = paquetes.filter(paquete => paquete.nino);
    
    const reporte = paquetesFiltrados.map(paquete => ({
        _id: paquete._id,
        paciente: {
          _id: paquete.nino._id,
          nombres: paquete.nino.nombres,
          registroCivil: paquete.nino.registroCivil,
          genero: paquete.nino.genero,
          edad: paquete.nino.edad,
          celular: paquete.nino.celular
        },
        numeroFactura: paquete.numeroFactura,
        clasesPagadas: paquete.clasesPagadas,
        clasesUsadas: paquete.clasesUsadas,
        clasesDisponibles: paquete.clasesPagadas - paquete.clasesUsadas,
        porcentajeUso: Math.round((paquete.clasesUsadas / paquete.clasesPagadas) * 100),
        fechaPago: paquete.fechaPago,
        estado: paquete.clasesUsadas >= paquete.clasesPagadas ? 'Agotado' : 'Activo'
      }));

    res.json(reporte);
  } catch (e) {
    console.error('Error al generar reporte de paquetes:', e);
    res.status(500).json({ error: e.message });
  }
});

// Eliminar una factura/paquete por ID
router.delete("/:id", async (req, res) => {
  try {
    const paquete = await PagoPaquete.findById(req.params.id);
    if (!paquete) {
      return res.status(404).json({ error: "Paquete no encontrado" });
    }
    
    // Verificar si la factura está siendo usada en alguna clase
    const Clase = require("../models/Clase");
    const clasesConFactura = await Clase.find({ "ninos.numeroFactura": paquete.numeroFactura });
    
    if (clasesConFactura.length > 0) {
      const nombresClases = clasesConFactura.map(clase => clase.nombre).join(', ');
      return res.status(400).json({ 
        error: "No se puede eliminar la factura porque está siendo usada en sesiones",
        clasesAfectadas: clasesConFactura.length,
        nombresClases: nombresClases,
        mensaje: `Esta factura está siendo usada en ${clasesConFactura.length} sesión(es): ${nombresClases}. Para eliminar esta factura, primero debe ir a cada sesión y eliminar al paciente de la lista de inscritos.`
      });
    }
    
    await PagoPaquete.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Factura eliminada correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



module.exports = router;