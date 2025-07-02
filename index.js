require('dotenv').config();
const express = require('express');
   mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT ||4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' })); // o más si lo necesitas
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => console.error('❌ Error al conectar a MongoDB Atlas:', err));
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Esquema de paciente
const exportarWordRouter = require("./routes/exportarWord");
app.use("/api", exportarWordRouter);
const exportarPdfRouter = require("./routes/exportar-pdf");
app.use("/api", exportarPdfRouter);
app.use("/api/clases", require("./routes/clases"));


// Ruta para guardar datos
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
const pagoPaqueteRoutes = require('./routes/pagoPaquetes');
app.use('/api/pagoPaquete', pagoPaqueteRoutes);

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

app.get("/api/registros", async (req, res) => {
  try {
    const registros = await Paciente.find();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener registros", error });
  }
});


const valoracionRoutes = require('./routes/valoraciones');
app.use('/api/valoraciones', valoracionRoutes);

const pacientesRoutes = require('./routes/pacientes');
app.use('/api/pacientes', pacientesRoutes);

const pacientesAdultosRoutes = require('./routes/pacientesAdultos');
app.use('/api/pacientes-adultos', pacientesAdultosRoutes);

const valoracionIngresoAdultosLactanciaRoutes = require('./routes/valoracionIngresoAdultosLactancia');
app.use('/api/valoracion-ingreso-adultos-lactancia', valoracionIngresoAdultosLactanciaRoutes);

const consentimientoPerinatalRouter = require('./routes/consentimientoPerinatal');
app.use('/api/consentimiento-perinatal', consentimientoPerinatalRouter);
app.use('/api/valoracion-piso-pelvico', require('./routes/valoracionPisoPelvico'));

const uploadRoutes = require('./routes/upload');
app.use('/api', uploadRoutes);

// Servir frontend si lo necesitas (opcional)
// app.use(express.static(path.join(__dirname, '../centro-estimulacion/build')));
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../centro-estimulacion/build', 'index.html'));
// });





// Inicia el servidor HTTPS
//https.createServer(credentials, app).listen(4000, () => {
  //console.log('Servidor HTTPS corriendo en el puerto 4000');
//});

// Levantar el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
