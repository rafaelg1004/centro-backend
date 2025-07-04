require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => console.error('❌ Error al conectar a MongoDB Atlas:', err));
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Importa el modelo Paciente
const Paciente = require('./models/Paciente');

// Rutas
app.use("/api", require("./routes/exportarWord"));
app.use("/api", require("./routes/exportar-pdf"));
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
