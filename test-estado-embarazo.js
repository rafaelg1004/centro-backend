// Script de prueba para verificar la funcionalidad de estadoEmbarazo
const mongoose = require("mongoose");
const PacienteAdulto = require("./models/PacienteAdulto");

// Configuración de la base de datos
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/centro-estimulacion";

async function testEstadoEmbarazo() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(mongoURI);
    console.log("📦 Conectado a MongoDB");

    // Crear un paciente de prueba en gestación
    const pacienteGestacion = new PacienteAdulto({
      nombres: "María Gestación Test",
      cedula: "12345678901",
      genero: "Femenino",
      lugarNacimiento: "Bogotá",
      fechaNacimiento: "1990-01-01",
      edad: "34",
      estadoCivil: "Casada",
      direccion: "Calle 123",
      telefono: "1234567",
      celular: "3001234567",
      ocupacion: "Profesional",
      nivelEducativo: "Universitario",
      medicoTratante: "Dr. Test",
      aseguradora: "Test EPS",
      acompanante: "Juan Test",
      telefonoAcompanante: "3007654321",
      nombreBebe: "Bebé Test",
      estadoEmbarazo: "gestacion",
      semanasGestacion: "32",
      fum: "2024-01-01",
      fechaProbableParto: "2024-10-01"
    });

    // Crear un paciente de prueba en posparto
    const pacientePosparto = new PacienteAdulto({
      nombres: "Ana Posparto Test",
      cedula: "98765432109",
      genero: "Femenino",
      lugarNacimiento: "Medellín",
      fechaNacimiento: "1985-05-15",
      edad: "39",
      estadoCivil: "Soltera",
      direccion: "Carrera 456",
      telefono: "7654321",
      celular: "3009876543",
      ocupacion: "Empleada",
      nivelEducativo: "Técnico",
      medicoTratante: "Dra. Test",
      aseguradora: "Test Salud",
      acompanante: "Luis Test",
      telefonoAcompanante: "3001234567",
      nombreBebe: "Bebé Test 2",
      estadoEmbarazo: "posparto"
    });

    // Guardar los pacientes de prueba
    await pacienteGestacion.save();
    console.log("✅ Paciente en gestación creado:", pacienteGestacion._id);

    await pacientePosparto.save();
    console.log("✅ Paciente en posparto creado:", pacientePosparto._id);

    // Verificar que se guardaron correctamente
    const pacientes = await PacienteAdulto.find();
    console.log("📊 Total de pacientes:", pacientes.length);
    
    pacientes.forEach(p => {
      console.log(`- ${p.nombres}: ${p.estadoEmbarazo}`);
    });

    // Limpiar datos de prueba
    await PacienteAdulto.deleteMany({ cedula: { $in: ["12345678901", "98765432109"] } });
    console.log("🧹 Datos de prueba eliminados");

    console.log("🎉 Todas las pruebas pasaron exitosamente");

  } catch (error) {
    console.error("❌ Error durante las pruebas:", error);
  } finally {
    // Cerrar la conexión
    await mongoose.connection.close();
    console.log("📦 Conexión cerrada");
  }
}

// Ejecutar las pruebas si se llama directamente
if (require.main === module) {
  testEstadoEmbarazo();
}

module.exports = { testEstadoEmbarazo };
