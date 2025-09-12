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

// Buscar paquetes por número de factura para un niño específico
router.get("/buscar-por-nino/:ninoId", async (req, res) => {
  try {
    const { ninoId } = req.params;
    const { query } = req.query;
    
    let filtro = { nino: ninoId };
    
    if (query && query.trim()) {
      filtro.numeroFactura = { $regex: query.trim(), $options: 'i' };
    }
    
    const paquetes = await PagoPaquete.find(filtro)
      .sort({ fechaPago: -1 });
    
    res.json(paquetes);
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
    
    // Obtener información de clases para cada paquete
    const Clase = require("../models/Clase");
    const reporte = await Promise.all(paquetesFiltrados.map(async (paquete) => {
      // Buscar clases donde se está usando este paquete
      const clasesConPaquete = await Clase.find({ "ninos.numeroFactura": paquete.numeroFactura });
      
      // Buscar clases donde está el paciente pero sin paquete
      const clasesSinPaquete = await Clase.find({ 
        "ninos.nino": paquete.nino._id,
        "ninos.numeroFactura": { $in: [null, ""] }
      });
      
      return {
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
        estado: paquete.clasesUsadas >= paquete.clasesPagadas ? 'Agotado' : 'Activo',
        clasesConPaquete: clasesConPaquete.map(clase => ({
          _id: clase._id,
          nombre: clase.nombre,
          fecha: clase.fecha
        })),
        clasesSinPaquete: clasesSinPaquete.map(clase => ({
          _id: clase._id,
          nombre: clase.nombre,
          fecha: clase.fecha
        }))
      };
    }));

    res.json(reporte);
  } catch (e) {
    console.error('Error al generar reporte de paquetes:', e);
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

// Obtener un paquete específico por ID (DEBE IR DESPUÉS DE LAS RUTAS ESPECÍFICAS)
router.get("/:id", async (req, res) => {
  try {
    const paquete = await PagoPaquete.findById(req.params.id);
    
    if (!paquete) {
      return res.status(404).json({ error: "Paquete no encontrado" });
    }
    
    // Obtener el paciente manualmente
    const Paciente = require("../models/Paciente");
    const paciente = await Paciente.findById(paquete.nino);
    
    // Crear el objeto de respuesta con la información del paciente
    const paqueteConPaciente = {
      _id: paquete._id,
      nino: paciente,
      numeroFactura: paquete.numeroFactura,
      clasesPagadas: paquete.clasesPagadas,
      clasesUsadas: paquete.clasesUsadas,
      fechaPago: paquete.fechaPago
    };
    
    res.json(paqueteConPaciente);
  } catch (e) {
    console.error('Error al obtener paquete:', e);
    res.status(500).json({ error: e.message });
  }
});

// Actualizar un paquete por ID
router.put("/:id", async (req, res) => {
  try {
    const { numeroFactura, clasesPagadas, fechaPago } = req.body;
    
    // Validaciones
    if (!numeroFactura || !numeroFactura.trim()) {
      return res.status(400).json({ error: "El número de factura es obligatorio" });
    }
    
    if (!clasesPagadas || clasesPagadas <= 0) {
      return res.status(400).json({ error: "El número de clases pagadas debe ser mayor a 0" });
    }
    
    const paquete = await PagoPaquete.findById(req.params.id);
    if (!paquete) {
      return res.status(404).json({ error: "Paquete no encontrado" });
    }
    
    // Verificar que las clases pagadas no sean menores a las ya usadas
    if (clasesPagadas < paquete.clasesUsadas) {
      return res.status(400).json({ 
        error: `No puedes establecer menos clases pagadas (${clasesPagadas}) que las ya usadas (${paquete.clasesUsadas})` 
      });
    }
    
    // Verificar que el número de factura sea único (si es diferente al actual)
    if (numeroFactura !== paquete.numeroFactura) {
      const facturaExistente = await PagoPaquete.findOne({ 
        numeroFactura: numeroFactura.trim(),
        _id: { $ne: req.params.id }
      });
      
      if (facturaExistente) {
        return res.status(400).json({ error: "Ya existe un paquete con este número de factura" });
      }
    }
    
    // Actualizar el paquete
    const paqueteActualizado = await PagoPaquete.findByIdAndUpdate(
      req.params.id,
      {
        numeroFactura: numeroFactura.trim(),
        clasesPagadas: parseInt(clasesPagadas),
        fechaPago: fechaPago
      },
      { new: true }
    );
    
    // Obtener el paciente manualmente
    const Paciente = require("../models/Paciente");
    const paciente = await Paciente.findById(paqueteActualizado.nino);
    
    // Crear el objeto de respuesta con la información del paciente
    const paqueteConPaciente = {
      _id: paqueteActualizado._id,
      nino: paciente,
      numeroFactura: paqueteActualizado.numeroFactura,
      clasesPagadas: paqueteActualizado.clasesPagadas,
      clasesUsadas: paqueteActualizado.clasesUsadas,
      fechaPago: paqueteActualizado.fechaPago
    };
    
    res.json(paqueteConPaciente);
  } catch (e) {
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