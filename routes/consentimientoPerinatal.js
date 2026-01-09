const express = require("express");
const router = express.Router();
const ConsentimientoPerinatal = require("../models/ConsentimientoPerinatal");
const { eliminarImagenesConsentimientoPerinatal } = require('../utils/s3Utils');

// Middleware para bloquear imágenes base64
const bloquearImagenesBase64 = (req, res, next) => {
  console.log('Verificando que no se envíen imágenes base64 a la base de datos...');
  
  const data = req.body;
  const camposImagen = [
    'firmaPaciente',
    'firmaFisioterapeuta',
    'firmaAutorizacion',
    'firmaPacienteConsentimiento',
    'firmaFisioterapeutaConsentimiento',
    'firmaPacienteGeneral',
    'firmaFisioterapeutaGeneral',
    'firmaPacienteGeneralIntensivo',
    'firmaFisioterapeutaGeneralIntensivo',
    // Firmas dinámicas de sesiones (Paso 7)
    'firmaPacienteSesion1',
    'firmaPacienteSesion2',
    'firmaPacienteSesion3',
    'firmaPacienteSesion4',
    'firmaPacienteSesion5',
    // Firmas dinámicas de sesiones intensivo (Paso 8)
    'firmaPacienteSesionIntensivo1',
    'firmaPacienteSesionIntensivo2',
    'firmaPacienteSesionIntensivo3'
  ];
  
  // Verificar campos individuales
  for (const campo of camposImagen) {
    if (data[campo] && typeof data[campo] === 'string' && data[campo].startsWith('data:image')) {
      console.error(`❌ Intento de guardar imagen base64 en campo ${campo}`);
      return res.status(400).json({
        error: 'No se permiten imágenes base64 en la base de datos',
        mensaje: `El campo ${campo} contiene una imagen base64. Debe convertirse a URL de S3 antes de guardar.`
      });
    }
  }
  
  // Verificar imágenes en arrays de sesiones
  if (data.sesiones && Array.isArray(data.sesiones)) {
    for (let i = 0; i < data.sesiones.length; i++) {
      const sesion = data.sesiones[i];
      if (sesion.firmaPaciente && typeof sesion.firmaPaciente === 'string' && sesion.firmaPaciente.startsWith('data:image')) {
        console.error(`❌ Intento de guardar imagen base64 en sesiones[${i}].firmaPaciente`);
        return res.status(400).json({
          error: 'No se permiten imágenes base64 en la base de datos',
          mensaje: `El campo sesiones[${i}].firmaPaciente contiene una imagen base64. Debe convertirse a URL de S3 antes de guardar.`
        });
      }
    }
  }
  
  // Verificar imágenes en arrays de sesiones intensivo
  if (data.sesionesIntensivo && Array.isArray(data.sesionesIntensivo)) {
    for (let i = 0; i < data.sesionesIntensivo.length; i++) {
      const sesion = data.sesionesIntensivo[i];
      if (sesion.firmaPaciente && typeof sesion.firmaPaciente === 'string' && sesion.firmaPaciente.startsWith('data:image')) {
        console.error(`❌ Intento de guardar imagen base64 en sesionesIntensivo[${i}].firmaPaciente`);
        return res.status(400).json({
          error: 'No se permiten imágenes base64 en la base de datos',
          mensaje: `El campo sesionesIntensivo[${i}].firmaPaciente contiene una imagen base64. Debe convertirse a URL de S3 antes de guardar.`
        });
      }
    }
  }
  
  console.log('✓ Verificación de imágenes base64 completada');
  next();
};

// ...existing code...

// ...existing code...

// Crear un nuevo consentimiento perinatal
router.post("/", bloquearImagenesBase64, async (req, res) => {
  try {
    console.log("Datos recibidos en el backend:", req.body); // <-- Ya lo tienes
    const nuevoConsentimiento = new ConsentimientoPerinatal(req.body);
    await nuevoConsentimiento.save();
    res.status(201).json(nuevoConsentimiento);
  } catch (error) {
    console.error("Error al guardar consentimiento:", error); // <-- Agrega esto
    res.status(400).json({ error: error.message, detalle: error }); // <-- Devuelve el error completo
  }
});

// Obtener todos los consentimientos perinatales (con filtros opcionales)
router.get("/", async (req, res) => {
  try {
    const { busqueda, fechaInicio, fechaFin } = req.query;
    let query = {};

    // Filtros de fecha
    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) query.fecha.$gte = fechaInicio;
      if (fechaFin) query.fecha.$lte = fechaFin;
    }

    const consentimientos = await ConsentimientoPerinatal.find(query).populate("paciente", "nombres apellidos cedula telefono fechaNacimiento edad genero lugarNacimiento estadoCivil direccion celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto");
    
    // Filtro de búsqueda por nombre o cédula (aplicado después del populate)
    let consentimientosFiltrados = consentimientos;
    if (busqueda) {
      consentimientosFiltrados = consentimientos.filter(c => {
        const paciente = c.paciente;
        if (!paciente) return false;
        const nombres = paciente.nombres || '';
        const cedula = paciente.cedula || '';
        return nombres.toLowerCase().includes(busqueda.toLowerCase()) ||
               cedula.toLowerCase().includes(busqueda.toLowerCase());
      });
    }
    
    res.json(consentimientosFiltrados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Buscar consentimiento por nombre o documento del paciente adulto
router.get("/buscar", async (req, res) => {
  const q = req.query.q || "";
  try {
    // Buscar en el modelo PacienteAdulto por nombre o cedula
    const PacienteAdulto = require("../models/PacienteAdulto");
    const pacientes = await PacienteAdulto.find({
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { cedula: { $regex: q, $options: "i" } }
      ]
    });

    console.log("Consulta recibida:", q);
    console.log("Pacientes encontrados:", pacientes);

    if (!pacientes.length) {
      return res.json([]);
    }

    // Buscar consentimientos de esos pacientes
    const consentimientos = await ConsentimientoPerinatal.find({
      paciente: { $in: pacientes.map(p => p._id) }
    }).populate("paciente", "nombres apellidos cedula telefono fechaNacimiento edad genero lugarNacimiento estadoCivil direccion celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto");

    console.log("Consentimientos encontrados:", consentimientos);

    res.json(consentimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener consentimiento por ID
router.get("/:id", async (req, res) => {
  try {
    const consentimiento = await ConsentimientoPerinatal.findById(req.params.id).populate("paciente", "nombres apellidos cedula telefono fechaNacimiento edad genero lugarNacimiento estadoCivil direccion celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto");
    if (!consentimiento) return res.status(404).json({ error: "No encontrado" });
    res.json(consentimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener consentimiento por paciente adulto
router.get("/paciente/:pacienteId", async (req, res) => {
  try {
    console.log('Buscando consentimientos para paciente ID:', req.params.pacienteId);
    const consentimiento = await ConsentimientoPerinatal.find({ paciente: req.params.pacienteId }).populate("paciente", "nombres apellidos cedula telefono fechaNacimiento edad genero lugarNacimiento estadoCivil direccion celular ocupacion nivelEducativo medicoTratante aseguradora acompanante telefonoAcompanante nombreBebe semanasGestacion fum fechaProbableParto");
    console.log('Consentimientos encontrados:', consentimiento.length);
    console.log('IDs de pacientes en consentimientos:', consentimiento.map(c => c.paciente?._id || c.paciente));
    res.json(consentimiento);
  } catch (error) {
    console.error('Error al buscar consentimientos por paciente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar consentimiento por ID
router.put("/:id", bloquearImagenesBase64, async (req, res) => {
  try {
    // Obtener el consentimiento actual para comparar imágenes
    const consentimientoActual = await ConsentimientoPerinatal.findById(req.params.id);
    if (!consentimientoActual) {
      return res.status(404).json({ error: "Consentimiento no encontrado" });
    }

    console.log(`Actualizando consentimiento perinatal ${req.params.id}...`);

    // Lista de campos que pueden contener imágenes
    const camposImagen = [
      'firmaPaciente',
      'firmaFisioterapeuta',
      'firmaAutorizacion',
      'firmaPacienteConsentimiento',
      'firmaFisioterapeutaConsentimiento',
      'firmaPacienteGeneral',
      'firmaFisioterapeutaGeneral',
      'firmaPacienteGeneralIntensivo',
      'firmaFisioterapeutaGeneralIntensivo',
      // Firmas dinámicas de sesiones (Paso 7)
      'firmaPacienteSesion1',
      'firmaPacienteSesion2',
      'firmaPacienteSesion3',
      'firmaPacienteSesion4',
      'firmaPacienteSesion5',
      // Firmas dinámicas de sesiones intensivo (Paso 8)
      'firmaPacienteSesionIntensivo1',
      'firmaPacienteSesionIntensivo2',
      'firmaPacienteSesionIntensivo3'
    ];

    // Importar función de eliminación
    const { eliminarImagenDeS3, eliminarImagenesConsentimientoPerinatal } = require('../utils/s3Utils');
    
    // Detectar imágenes que han cambiado y eliminar las anteriores
    let imagenesEliminadas = 0;
    
    // Primero verificar campos individuales
    for (const campo of camposImagen) {
      const imagenAnterior = consentimientoActual[campo];
      const imagenNueva = req.body[campo];
      
      // Si había una imagen anterior y ahora es diferente (o se eliminó)
      if (imagenAnterior && 
          imagenAnterior.includes('amazonaws.com') && 
          imagenAnterior !== imagenNueva) {
        
        console.log(`Eliminando imagen anterior del campo ${campo}: ${imagenAnterior}`);
        const resultado = await eliminarImagenDeS3(imagenAnterior);
        if (resultado.success) {
          imagenesEliminadas++;
          console.log(`✓ Imagen anterior eliminada de ${campo}`);
        } else {
          console.error(`❌ Error eliminando imagen de ${campo}:`, resultado.error);
        }
      }
    }

    // También verificar arrays de sesiones
    if (consentimientoActual.sesiones && Array.isArray(consentimientoActual.sesiones)) {
      for (let i = 0; i < consentimientoActual.sesiones.length; i++) {
        const sesionAnterior = consentimientoActual.sesiones[i];
        const sesionNueva = req.body.sesiones && req.body.sesiones[i];
        
        if (sesionAnterior.firmaPaciente && 
            sesionAnterior.firmaPaciente.includes('amazonaws.com') &&
            (!sesionNueva || sesionAnterior.firmaPaciente !== sesionNueva.firmaPaciente)) {
          
          console.log(`Eliminando firma anterior de sesión ${i + 1}: ${sesionAnterior.firmaPaciente}`);
          const resultado = await eliminarImagenDeS3(sesionAnterior.firmaPaciente);
          if (resultado.success) {
            imagenesEliminadas++;
            console.log(`✓ Imagen anterior eliminada de sesión ${i + 1}`);
          }
        }
      }
    }

    // Similar para sesionesIntensivo
    if (consentimientoActual.sesionesIntensivo && Array.isArray(consentimientoActual.sesionesIntensivo)) {
      for (let i = 0; i < consentimientoActual.sesionesIntensivo.length; i++) {
        const sesionAnterior = consentimientoActual.sesionesIntensivo[i];
        const sesionNueva = req.body.sesionesIntensivo && req.body.sesionesIntensivo[i];
        
        if (sesionAnterior.firmaPaciente && 
            sesionAnterior.firmaPaciente.includes('amazonaws.com') &&
            (!sesionNueva || sesionAnterior.firmaPaciente !== sesionNueva.firmaPaciente)) {
          
          console.log(`Eliminando firma anterior de sesión intensivo ${i + 1}: ${sesionAnterior.firmaPaciente}`);
          const resultado = await eliminarImagenDeS3(sesionAnterior.firmaPaciente);
          if (resultado.success) {
            imagenesEliminadas++;
            console.log(`✓ Imagen anterior eliminada de sesión intensivo ${i + 1}`);
          }
        }
      }
    }

    // Actualizar el consentimiento con los nuevos datos
    const consentimientoActualizado = await ConsentimientoPerinatal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    console.log(`✓ Consentimiento perinatal actualizado. Imágenes anteriores eliminadas: ${imagenesEliminadas}`);
    
    res.json({
      ...consentimientoActualizado.toObject(),
      imagenesAnterioresEliminadas: imagenesEliminadas
    });
  } catch (error) {
    console.error('Error al actualizar consentimiento:', error);
    res.status(400).json({ error: error.message });
  }
});

// Eliminar consentimiento por ID
router.delete("/:id", async (req, res) => {
  try {
    // Primero obtener el consentimiento para acceder a las imágenes
    const consentimiento = await ConsentimientoPerinatal.findById(req.params.id);
    if (!consentimiento) {
      return res.status(404).json({ error: "Consentimiento no encontrado" });
    }

    console.log(`Eliminando consentimiento perinatal ${req.params.id} y sus imágenes asociadas...`);

    // Lista de campos que pueden contener imágenes en consentimientos perinatales
    const camposImagen = [
      'firmaPaciente',
      'firmaFisioterapeuta',
      'firmaAutorizacion',
      'firmaPacienteConsentimiento',
      'firmaFisioterapeutaConsentimiento',
      'firmaPacienteGeneral',
      'firmaFisioterapeutaGeneral',
      'firmaPacienteGeneralIntensivo',
      'firmaFisioterapeutaGeneralIntensivo',
      // Firmas dinámicas de sesiones (Paso 7)
      'firmaPacienteSesion1',
      'firmaPacienteSesion2',
      'firmaPacienteSesion3',
      'firmaPacienteSesion4',
      'firmaPacienteSesion5',
      // Firmas dinámicas de sesiones intensivo (Paso 8)
      'firmaPacienteSesionIntensivo1',
      'firmaPacienteSesionIntensivo2',
      'firmaPacienteSesionIntensivo3'
    ];

    // Eliminar todas las imágenes de S3 (incluyendo arrays de sesiones)
    const resultadosEliminacion = await eliminarImagenesConsentimientoPerinatal(consentimiento, camposImagen);

    // Eliminar el consentimiento de la base de datos
    await ConsentimientoPerinatal.findByIdAndDelete(req.params.id);
    
    res.json({ 
      mensaje: 'Consentimiento eliminado exitosamente',
      imagenesEliminadas: resultadosEliminacion.filter(r => r.resultado.success).length,
      totalImagenes: resultadosEliminacion.length
    });
  } catch (error) {
    console.error('Error al eliminar consentimiento perinatal:', error);
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;