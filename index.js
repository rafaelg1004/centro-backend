require('dotenv').config();
const express = require('express');
   mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT ||4000;

// Middleware
app.use(cors({
  origin: [
    'https://centro-de-estimulacion.web.app', // tu frontend en Firebase Hosting
    'https://www.centro-de-estimulacion.web.app', // por si usas el www
    'http://localhost:3000' // tu frontend local
  ]
}));
app.use(express.json());

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

const PacienteSchema = new mongoose.Schema({
  nombre: String,
  edad: Number,
  procedimiento: String,
  firma: String,
});
const Paciente = mongoose.model('Paciente', PacienteSchema);

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
app.get("/api/registros", async (req, res) => {
  try {
    const registros = await Paciente.find();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener registros", error });
  }
});
const valoracionRoutes = require('./routes/valoraciones');
app.use('/api', valoracionRoutes);

// Servir frontend si lo necesitas (opcional)
// app.use(express.static(path.join(__dirname, '../centro-estimulacion/build')));
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../centro-estimulacion/build', 'index.html'));
// });

// Levantar el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
