const mongoose = require("mongoose");
const PacienteAdulto = require("../models/PacienteAdulto");

// Configuración de la base de datos
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/centro-estimulacion";

async function migrateEstadoEmbarazo() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(mongoURI);
    console.log("📦 Conectado a MongoDB");

    // Buscar todos los pacientes adultos que no tienen el campo estadoEmbarazo
    const pacientesSinEstado = await PacienteAdulto.find({ 
      estadoEmbarazo: { $exists: false } 
    });

    console.log(`📋 Encontrados ${pacientesSinEstado.length} pacientes sin estado de embarazo`);

    if (pacientesSinEstado.length > 0) {
      // Actualizar todos los pacientes existentes estableciendo estadoEmbarazo como 'gestacion'
      const resultado = await PacienteAdulto.updateMany(
        { estadoEmbarazo: { $exists: false } },
        { $set: { estadoEmbarazo: 'gestacion' } }
      );

      console.log(`✅ Actualizados ${resultado.modifiedCount} pacientes con estado 'gestacion'`);
    } else {
      console.log("✅ Todos los pacientes ya tienen el campo estadoEmbarazo");
    }

    // Verificar la migración
    const totalPacientes = await PacienteAdulto.countDocuments();
    const pacientesConEstado = await PacienteAdulto.countDocuments({ 
      estadoEmbarazo: { $exists: true } 
    });

    console.log(`📊 Total de pacientes: ${totalPacientes}`);
    console.log(`📊 Pacientes con estado de embarazo: ${pacientesConEstado}`);

    if (totalPacientes === pacientesConEstado) {
      console.log("🎉 Migración completada exitosamente");
    } else {
      console.log("⚠️  Algunos pacientes aún no tienen el campo estadoEmbarazo");
    }

  } catch (error) {
    console.error("❌ Error durante la migración:", error);
  } finally {
    // Cerrar la conexión
    await mongoose.connection.close();
    console.log("📦 Conexión cerrada");
  }
}

// Ejecutar la migración si se llama directamente
if (require.main === module) {
  migrateEstadoEmbarazo();
}

module.exports = { migrateEstadoEmbarazo };
