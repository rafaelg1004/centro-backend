require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Logger middleware solo para operaciones de modificación y login
app.use((req, res, next) => {
  // Solo registrar operaciones de modificación (POST, PUT, DELETE) y login
  const shouldLog = ['POST', 'PUT', 'DELETE'].includes(req.method) ||
    req.path.includes('/auth/login') ||
    req.path.includes('/auth/verify-2fa-login');

  if (shouldLog) {
    // Usar el middleware del logger solo para estas operaciones
    return logger.middleware()(req, res, next);
  }

  next();
});

// Importa los modelos ANTES de conectar a la base de datos
const Paciente = require('./models/Paciente');
const PacienteAdulto = require('./models/PacienteAdulto');

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB Atlas');
    // Limpiar cache de modelos si hay conflictos de esquema
    mongoose.connection.db.collection('valoracioningresos').updateMany(
      { rutinaDiaria: { $type: "array" } },
      { $set: { rutinaDiaria: "" } }
    ).catch(err => console.log('Info: No hay campos rutinaDiaria problemáticos'));
  })
  .catch(err => console.error('❌ Error al conectar a MongoDB Atlas:', err));

// Rutas
const { verificarToken } = require("./routes/auth");

app.use("/api", verificarToken(), require("./routes/exportarWord"));
app.use("/api", verificarToken(), require("./routes/exportar-pdf"));
app.use("/api", require("./routes/proxy-images"));
app.use("/api", require("./routes/proxyImages"));
app.use("/api/clases", verificarToken(), require("./routes/clases"));
app.use('/api/pagoPaquete', verificarToken(), require('./routes/pagoPaquetes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/valoraciones', verificarToken(), require('./routes/valoraciones'));
app.use('/api/pacientes', verificarToken(), require('./routes/pacientes'));
app.use('/api/pacientes-adultos', verificarToken(), require('./routes/pacientesAdultos'));
app.use('/api/valoracion-ingreso-adultos-lactancia', verificarToken(), require('./routes/valoracionIngresoAdultosLactancia'));
app.use('/api/consentimiento-perinatal', verificarToken(), require('./routes/consentimientoPerinatal'));
app.use('/api/valoracion-piso-pelvico', verificarToken(), require('./routes/valoracionPisoPelvico'));
app.use('/api', verificarToken(), require('./routes/upload'));
app.use('/api/valoraciones/reporte', verificarToken(), require('./routes/exportarReporte'));
app.use('/api/rips', verificarToken(), require('./routes/rips'));
app.use('/api/rda', verificarToken(), require('./routes/rda'));
app.use('/api/cups', verificarToken(), require('./routes/cups'));
app.use('/api/sesiones-mensuales', verificarToken(), require('./routes/sesionesMensuales'));

// Endpoint para eliminar firmas de S3 (Solo administración)
const { eliminarImagenDeS3 } = require('./utils/s3Utils');
app.post('/api/eliminar-firmas-s3', verificarToken(['administracion']), async (req, res) => {
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

// Endpoints de depuración desactivados en producción para proteger PII
/*
app.post('/api/debug-consentimiento-perinatal', ...);
app.put('/api/debug-valoraciones/:id', ...);
app.post('/api/debug-device-info', ...);
app.get('/api/debug-valoraciones/:id', ...);
app.get('/api/debug-valoracion-piso-pelvico/:id', ...);
app.get('/api/debug-list-valoraciones-piso-pelvico', ...);
*/

// Health check endpoint para monitoreo
app.get('/api/health', async (req, res) => {
  try {
    // Verificar conexión a base de datos
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Información básica del sistema
    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        status: dbStatus,
        name: mongoose.connection.name
      },
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    };

    // Si la BD no está conectada, cambiar status
    if (dbStatus !== 'connected') {
      healthCheck.status = 'error';
      res.status(503);
    }

    res.json(healthCheck);
  } catch (error) {
    console.error('Error en health check:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Endpoint para consultar logs (Solo administración)
app.get('/api/logs', verificarToken(['administracion']), async (req, res) => {
  try {
    const Log = require('./models/Log');
    const { limit = 50, category, level, user } = req.query;

    let query = {};
    if (category) query.category = category;
    if (level) query.level = level;
    if (user) query.user = user;

    const logs = await Log.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({
      total: logs.length,
      logs: logs
    });
  } catch (error) {
    console.error('Error obteniendo logs:', error);
    res.status(500).json({ error: 'Error obteniendo logs' });
  }
});

// Endpoints directos protegidos
app.post('/api/registro', verificarToken(), async (req, res) => {
  try {
    const nuevo = new Paciente(req.body);
    await nuevo.save();
    res.status(201).json({ mensaje: 'Registro guardado exitosamente' });
  } catch (error) {
    console.error('Error al guardar:', error);
    res.status(500).send('Error en el servidor');
  }
});

app.get("/api/registros", verificarToken(['administracion']), async (req, res) => {
  try {
    const registros = await Paciente.find().select('-__v');
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
