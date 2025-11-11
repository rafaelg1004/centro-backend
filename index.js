require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Conectado a MongoDB Atlas');
  // Limpiar cache de modelos si hay conflictos de esquema
  mongoose.connection.db.collection('valoracioningresos').updateMany(
    { rutinaDiaria: { $type: "array" } },
    { $set: { rutinaDiaria: "" } }
  ).catch(err => console.log('Info: No hay campos rutinaDiaria problemáticos'));
})
.catch(err => console.error('❌ Error al conectar a MongoDB Atlas:', err));
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Importa el modelo Paciente
const Paciente = require('./models/Paciente');

// Rutas
app.use("/api", require("./routes/exportarWord"));
app.use("/api", require("./routes/exportar-pdf"));
app.use("/api", require("./routes/proxy-images"));
app.use("/api", require("./routes/proxyImages"));
app.use("/api/clases", require("./routes/clases"));
app.use('/api/pagoPaquete', require('./routes/pagoPaquetes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/valoraciones', require('./routes/valoraciones'));
app.use('/api/pacientes', require('./routes/pacientes'));
app.use('/api/pacientes-adultos', require('./routes/pacientesAdultos'));
app.use('/api/valoracion-ingreso-adultos-lactancia', require('./routes/valoracionIngresoAdultosLactancia'));
app.use('/api/consentimiento-perinatal', require('./routes/consentimientoPerinatal'));
app.use('/api/valoracion-piso-pelvico', require('./routes/valoracionPisoPelvico'));
app.use('/api', require('./routes/upload'));

// Endpoint para eliminar firmas de S3
const { eliminarImagenDeS3 } = require('./utils/s3Utils');
app.post('/api/eliminar-firmas-s3', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'Se requiere un array de URLs' });
    }
    
    console.log(`Eliminando ${urls.length} firmas de S3...`);
    const resultados = [];
    
    for (const url of urls) {
      const resultado = await eliminarImagenDeS3(url);
      resultados.push({ url, ...resultado });
    }
    
    const exitosos = resultados.filter(r => r.success).length;
    const fallidos = resultados.filter(r => !r.success).length;
    
    console.log(`✓ Eliminación completada: ${exitosos} exitosos, ${fallidos} fallidos`);
    
    res.json({
      mensaje: `Eliminación completada: ${exitosos} exitosos, ${fallidos} fallidos`,
      resultados,
      exitosos,
      fallidos
    });
    
  } catch (error) {
    console.error('Error eliminando firmas de S3:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUGGING: Endpoint temporal para interceptar datos del frontend
app.post('/api/debug-consentimiento-perinatal', async (req, res) => {
  console.log('\n=== DEBUG: DATOS RECIBIDOS DEL FRONTEND ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Headers Content-Type:', req.headers['content-type']);
  console.log('Body keys:', Object.keys(req.body));
  
  // Buscar campos de sesiones
  const camposSesiones = {};
  for (let i = 1; i <= 10; i++) {
    if (req.body[`fechaSesion${i}`] || req.body[`firmaPacienteSesion${i}`]) {
      camposSesiones[`fechaSesion${i}`] = req.body[`fechaSesion${i}`] || 'vacío';
      camposSesiones[`firmaPacienteSesion${i}`] = req.body[`firmaPacienteSesion${i}`] ? 'TIENE_FIRMA' : 'SIN_FIRMA';
    }
  }
  
  console.log('Campos de sesiones encontrados:', Object.keys(camposSesiones).length);
  console.log('Detalle campos sesiones:', camposSesiones);
  
  // Verificar si ya vienen arrays
  console.log('Array sesiones:', req.body.sesiones ? `${req.body.sesiones.length} elementos` : 'NO_EXISTE');
  console.log('Array sesionesIntensivo:', req.body.sesionesIntensivo ? `${req.body.sesionesIntensivo.length} elementos` : 'NO_EXISTE');
  
  if (req.body.sesiones && Array.isArray(req.body.sesiones)) {
    console.log('Detalle sesiones array:');
    req.body.sesiones.forEach((sesion, index) => {
      console.log(`  ${index + 1}. ${sesion.nombre} - ${sesion.fecha} - ${sesion.firmaPaciente ? 'CON_FIRMA' : 'SIN_FIRMA'}`);
    });
  }
  
  if (req.body.sesionesIntensivo && Array.isArray(req.body.sesionesIntensivo)) {
    console.log('Detalle sesionesIntensivo array:');
    req.body.sesionesIntensivo.forEach((sesion, index) => {
      console.log(`  ${index + 1}. ${sesion.nombre} - ${sesion.fecha} - ${sesion.firmaPaciente ? 'CON_FIRMA' : 'SIN_FIRMA'}`);
    });
  }
  
  // Responder como si fuera el endpoint real
  res.json({
    mensaje: 'Debug completado',
    _id: 'debug-id-' + Date.now(),
    sesiones: req.body.sesiones || [],
    sesionesIntensivo: req.body.sesionesIntensivo || [],
    debug: {
      camposSesionesEncontrados: Object.keys(camposSesiones).length,
      tieneSesionesArray: !!req.body.sesiones,
      tieneSesionesIntensivoArray: !!req.body.sesionesIntensivo
    }
  });
});

// DEBUGGING: Endpoint temporal para interceptar datos de valoraciones de niños (VERSIÓN MÓVIL)
app.put('/api/debug-valoraciones/:id', async (req, res) => {
  console.log('\n=== DEBUG: EDICIÓN VALORACIÓN NIÑO (MÓVIL) ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('ID de valoración:', req.params.id);
  
  // Información del navegador/dispositivo
  console.log('\n📱 INFORMACIÓN DEL DISPOSITIVO:');
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Content-Length:', req.headers['content-length']);
  console.log('Accept:', req.headers['accept']);
  console.log('Accept-Encoding:', req.headers['accept-encoding']);
  console.log('Connection:', req.headers['connection']);
  
  // Verificar si es realmente móvil
  const userAgent = req.headers['user-agent'] || '';
  const esMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
  console.log('Detectado como móvil:', esMobile);
  
  // Información del payload
  console.log('\n📦 INFORMACIÓN DEL PAYLOAD:');
  const bodyString = JSON.stringify(req.body);
  console.log('Tamaño total del body:', bodyString.length, 'caracteres');
  console.log('Tamaño en KB:', Math.round(bodyString.length / 1024), 'KB');
  console.log('Body keys:', Object.keys(req.body));
  console.log('Total de campos:', Object.keys(req.body).length);
  
  // Verificar si el body está truncado o vacío
  if (Object.keys(req.body).length === 0) {
    console.log('❌ ALERTA: Body completamente vacío');
  }
  
  // Verificar campos importantes
  console.log('\n📋 CAMPOS PRINCIPALES:');
  const camposClave = ['paciente', 'fecha', 'motivoDeConsulta', '_id'];
  camposClave.forEach(campo => {
    if (req.body[campo]) {
      console.log(`✅ ${campo}: ${req.body[campo]}`);
    } else {
      console.log(`❌ ${campo}: FALTANTE`);
    }
  });
  
  // Análisis detallado de firmas
  console.log('\n✍️ ANÁLISIS DE FIRMAS:');
  const camposFirmas = [
    'firmaProfesional', 'firmaRepresentante', 'firmaAcudiente', 
    'firmaFisioterapeuta', 'firmaAutorizacion', 'consentimiento_firmaAcudiente', 
    'consentimiento_firmaFisio'
  ];
  
  let firmasBase64 = 0;
  let firmasS3 = 0;
  let firmasVacias = 0;
  
  camposFirmas.forEach(campo => {
    if (req.body[campo]) {
      const valor = req.body[campo];
      if (valor.startsWith('data:image')) {
        console.log(`❌ ${campo}: BASE64 (${Math.round(valor.length/1024)}KB)`);
        firmasBase64++;
      } else if (valor.includes('amazonaws.com')) {
        console.log(`✅ ${campo}: S3 URL`);
        firmasS3++;
      } else {
        console.log(`⚠️ ${campo}: OTRO VALOR`);
      }
    } else {
      console.log(`⭕ ${campo}: VACÍO`);
      firmasVacias++;
    }
  });
  
  console.log(`\nResumen firmas: ${firmasS3} S3, ${firmasBase64} Base64, ${firmasVacias} vacías`);
  
  // Verificar si hay problemas de memoria/tamaño
  console.log('\n🔍 DIAGNÓSTICO DE PROBLEMAS:');
  
  if (bodyString.length > 5 * 1024 * 1024) { // 5MB
    console.log('⚠️ ALERTA: Payload muy grande (>5MB)');
  }
  
  if (firmasBase64 > 0) {
    console.log('⚠️ ALERTA: Hay firmas en Base64 (deberían ser S3)');
  }
  
  if (Object.keys(req.body).length < 10) {
    console.log('⚠️ ALERTA: Muy pocos campos enviados');
  }
  
  // Verificar si es una actualización parcial
  const camposEsperados = 50; // Aproximadamente
  const camposRecibidos = Object.keys(req.body).length;
  if (camposRecibidos < camposEsperados * 0.5) {
    console.log('⚠️ ALERTA: Posible envío incompleto de datos');
  }
  
  // Simular la actualización real para ver si funciona
  console.log('\n🧪 SIMULACIÓN DE ACTUALIZACIÓN:');
  try {
    const ValoracionIngreso = require('./models/ValoracionIngreso');
    
    // Solo hacer validación, no actualizar realmente
    const valoracionExistente = await ValoracionIngreso.findById(req.params.id);
    if (!valoracionExistente) {
      console.log('❌ Valoración no existe en BD');
    } else {
      console.log('✅ Valoración existe en BD');
      console.log('Paciente en BD:', valoracionExistente.paciente);
      
      // Verificar si los datos enviados son válidos para actualización
      if (req.body.paciente && req.body.paciente === valoracionExistente.paciente.toString()) {
        console.log('✅ Paciente coincide');
      } else {
        console.log('❌ Paciente no coincide o faltante');
      }
    }
  } catch (error) {
    console.log('❌ Error en simulación:', error.message);
  }
  
  // Respuesta con información detallada
  res.json({
    debug: {
      timestamp: new Date().toISOString(),
      dispositivo: {
        userAgent: userAgent,
        esMobile: esMobile,
        contentLength: req.headers['content-length']
      },
      payload: {
        tamanoTotal: bodyString.length,
        tamanoKB: Math.round(bodyString.length / 1024),
        totalCampos: Object.keys(req.body).length,
        camposConDatos: Object.keys(req.body).filter(k => req.body[k] && req.body[k] !== '').length
      },
      firmas: {
        s3: firmasS3,
        base64: firmasBase64,
        vacias: firmasVacias
      },
      validacion: {
        pacientePresente: !!req.body.paciente,
        fechaPresente: !!req.body.fecha,
        idPresente: !!req.body._id
      }
    },
    mensaje: 'Debug completado - revisar logs del servidor'
  });
});

// Endpoint adicional para capturar información del dispositivo al cargar la página
app.post('/api/debug-device-info', (req, res) => {
  console.log('\n=== INFO DEL DISPOSITIVO AL CARGAR ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('Información del dispositivo:', req.body);
  
  // Analizar el dispositivo
  const userAgent = req.headers['user-agent'] || '';
  const esMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
  
  console.log('Tipo de dispositivo detectado:', esMobile ? 'MÓVIL' : 'ESCRITORIO');
  
  if (req.body.screenWidth) {
    console.log(`Resolución de pantalla: ${req.body.screenWidth}x${req.body.screenHeight}`);
    console.log(`Ventana del navegador: ${req.body.windowWidth}x${req.body.windowHeight}`);
  }
  
  if (req.body.memory) {
    console.log('Memoria del dispositivo:', req.body.memory);
  }
  
  if (req.body.connectionType) {
    console.log('Tipo de conexión:', req.body.connectionType);
  }
  
  res.json({ 
    mensaje: 'Info del dispositivo capturada',
    timestamp: new Date().toISOString(),
    dispositivoDetectado: esMobile ? 'móvil' : 'escritorio'
  });
});

// Para debugging también del GET (obtener valoración)
app.get('/api/debug-valoraciones/:id', async (req, res) => {
  console.log('\n=== DEBUG: OBTENER VALORACIÓN NIÑO ===');
  console.log('ID solicitado:', req.params.id);
  
  try {
    // Obtener la valoración real
    const ValoracionIngreso = require('./models/ValoracionIngreso');
    const valoracion = await ValoracionIngreso.findById(req.params.id).populate('paciente');
    
    if (!valoracion) {
      console.log('❌ Valoración no encontrada');
      return res.status(404).json({ error: 'Valoración no encontrada' });
    }
    
    console.log('✅ Valoración encontrada');
    console.log('Paciente:', valoracion.paciente?.nombres || 'Sin nombre');
    console.log('Fecha:', valoracion.fecha);
    console.log('Campos totales:', Object.keys(valoracion.toObject()).length);
    
    // Verificar firmas
    const camposFirmas = [
      'firmaProfesional', 'firmaRepresentante', 'firmaAcudiente', 
      'firmaFisioterapeuta', 'firmaAutorizacion', 'consentimiento_firmaAcudiente', 
      'consentimiento_firmaFisio'
    ];
    
    console.log('Firmas en BD:');
    camposFirmas.forEach(campo => {
      if (valoracion[campo]) {
        console.log(`✅ ${campo}: ${valoracion[campo].substring(0, 50)}...`);
      } else {
        console.log(`❌ ${campo}: vacío`);
      }
    });
    
    res.json(valoracion);
    
  } catch (error) {
    console.error('Error obteniendo valoración:', error);
    res.status(500).json({ error: error.message });
  }
});

// Para debugging también del GET (obtener valoración piso pélvico)
app.get('/api/debug-valoracion-piso-pelvico/:id', async (req, res) => {
  console.log('\n=== DEBUG: OBTENER VALORACIÓN PISO PÉLVICO ===');
  console.log('ID solicitado:', req.params.id);
  
  try {
    // Obtener la valoración real
    const ValoracionPisoPelvico = require('./models/ValoracionPisoPelvico');
    const valoracion = await ValoracionPisoPelvico.findById(req.params.id).populate('paciente');
    
    if (!valoracion) {
      console.log('❌ Valoración no encontrada');
      return res.status(404).json({ error: 'Valoración no encontrada' });
    }
    
    console.log('✅ Valoración encontrada');
    console.log('Paciente:', valoracion.paciente?.nombres || 'Sin nombre');
    console.log('Fecha:', valoracion.fecha);
    console.log('Campos totales:', Object.keys(valoracion.toObject()).length);
    
    // Verificar firmas
    const camposFirmas = [
      'firmaPaciente', 'firmaFisioterapeuta', 'firmaAutorizacion', 'consentimientoFirma'
    ];
    
    console.log('Firmas en BD:');
    camposFirmas.forEach(campo => {
      if (valoracion[campo]) {
        console.log(`✅ ${campo}: ${valoracion[campo].substring(0, 50)}...`);
      } else {
        console.log(`❌ ${campo}: vacío`);
      }
    });
    
    res.json(valoracion);
    
  } catch (error) {
    console.error('Error obteniendo valoración piso pélvico:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Listar todas las valoraciones piso pélvico para verificar IDs
app.get('/api/debug-list-valoraciones-piso-pelvico', async (req, res) => {
  console.log('\n=== DEBUG: LISTAR VALORACIONES PISO PÉLVICO ===');
  
  try {
    const ValoracionPisoPelvico = require('./models/ValoracionPisoPelvico');
    const valoraciones = await ValoracionPisoPelvico.find().populate('paciente');
    
    console.log(`Total de valoraciones: ${valoraciones.length}`);
    
    valoraciones.forEach((v, index) => {
      console.log(`${index + 1}. ID: ${v._id} - Paciente: ${v.paciente?.nombres || 'Sin nombre'} - Fecha: ${v.fecha || 'Sin fecha'}`);
    });
    
    res.json({
      total: valoraciones.length,
      valoraciones: valoraciones.map(v => ({
        _id: v._id,
        paciente: v.paciente?.nombres || 'Sin nombre',
        fecha: v.fecha,
        motivoConsulta: v.motivoConsulta
      }))
    });
    
  } catch (error) {
    console.error('Error listando valoraciones piso pélvico:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoints directos
app.post('/api/registro', async (req, res) => {
  try {
    const nuevo = new Paciente(req.body);
    await nuevo.save();
    res.status(201).json({ mensaje: 'Registro guardado exitosamente' });
  } catch (error) {
    console.error('Error al guardar:', error);
    res.status(500).send('Error en el servidor');
  }
});

app.get("/api/registros", async (req, res) => {
  try {
    const registros = await Paciente.find();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener registros", error });
  }
});

// Servir frontend (opcional, si no usas Nginx)
// app.use(express.static(path.join(__dirname, '../centro-estimulacion/build')));
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../centro-estimulacion/build', 'index.html'));
// });

// Inicia el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
