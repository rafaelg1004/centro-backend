require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// === Middleware Global ===
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Middleware de Auditoría (Registra cambios de estado y login en BD)
app.use(logger.auditMiddleware());

// === Base de Datos ===
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Conectado a MongoDB Atlas');
  })
  .catch(err => console.error('❌ Error fatal en base de datos:', err));

// === Rutas Públicas e Infraestructura ===
app.use('/api/auth', require('./routes/auth'));
app.use('/api/system', require('./routes/system'));
app.use('/api', require('./routes/proxy-images'));
app.use('/api', require('./routes/proxyImages'));

// Legacy Health Check redirect
app.get('/api/health', (req, res) => res.redirect('/api/system/health'));

// === Rutas Protegidas (Requieren Token JWT) ===
const { verificarToken } = require("./routes/auth");

// Pacientes y Registros (Unificados)
app.use('/api/pacientes', verificarToken(), require('./routes/pacientes'));

// Módulos Médicos y Valoraciones (Unificados)
app.use('/api/valoraciones', verificarToken(), require('./routes/valoraciones'));

// Academia y Pagos
app.use('/api/clases', verificarToken(), require('./routes/clases'));
app.use('/api/pagoPaquete', verificarToken(), require('./routes/pagoPaquetes'));
app.use('/api/sesiones-mensuales', verificarToken(), require('./routes/sesionesMensuales'));

// Sesiones Perinatales (Evoluciones)
app.use('/api/sesiones-perinatal', verificarToken(), require('./routes/sesiones-perinatal'));

// Reportes y Exportación
app.use('/api', verificarToken(), require('./routes/exportarWord'));
app.use('/api', verificarToken(), require('./routes/exportar-pdf'));
app.use('/api/valoraciones/reporte', verificarToken(), require('./routes/exportarReporte'));

// Archivos y S3
app.use('/api', verificarToken(), require('./routes/upload'));

// Otros Servicios (RIPS, RDA, CUPS)
app.use('/api/rips', verificarToken(), require('./routes/rips'));
app.use('/api/rda', verificarToken(), require('./routes/rda'));
app.use('/api/cups', verificarToken(), require('./routes/cups'));
app.use('/api/cups-catalogo', verificarToken(), require('./routes/cups-catalogo'));
app.use('/api/cie10', verificarToken(), require('./routes/cie10'));
app.use('/api/indicators', verificarToken(), require('./routes/indicators'));


// Gestión del Sistema (Admin Only)
app.use('/api/logs', verificarToken(['administracion']), require('./routes/logs'));

// === Inicialización ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
