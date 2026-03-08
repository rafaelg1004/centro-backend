require('dotenv').config();
const mongoose = require('mongoose');
const ValoracionIngreso = require('./models/ValoracionIngreso');
const Paciente = require('./models/Paciente');

async function migrateLegacyValoraciones() {
  try {
    console.log('🔄 Iniciando migración de valoraciones legacy...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar todas las valoraciones que NO tienen el campo paciente
    const valoracionesLegacy = await ValoracionIngreso.find({
      paciente: { $exists: false }
    });

    console.log(`📊 Encontradas ${valoracionesLegacy.length} valoraciones legacy para migrar`);

    let migradas = 0;
    let errores = 0;

    for (const valoracion of valoracionesLegacy) {
      try {
        console.log(`\n🔄 Migrando valoración: ${valoracion._id}`);

        // Verificar que al menos tengamos datos básicos para crear el paciente
        // Si no hay nombres ni registro civil, usaremos datos generados
        console.log(`📝 Creando paciente para valoración ${valoracion._id}`);

        // Crear un paciente con los datos de la valoración
        const nuevoPaciente = new Paciente({
          nombres: valoracion.nombres || `Paciente ${valoracion._id.toString().slice(-6)}`,
          registroCivil: valoracion.registroCivil || `RC${valoracion._id.toString().slice(-6)}`,
          genero: valoracion.genero,
          lugarNacimiento: valoracion.lugarNacimiento,
          fechaNacimiento: valoracion.nacimiento || valoracion.fechaNacimiento,
          edad: valoracion.edad,
          peso: valoracion.peso,
          talla: valoracion.talla,
          direccion: valoracion.direccion,
          telefono: valoracion.telefono,
          celular: valoracion.celular,
          pediatra: valoracion.pediatra,
          aseguradora: valoracion.aseguradora,
          nombreMadre: valoracion.madreNombre || valoracion.nombreMadre,
          edadMadre: valoracion.madreEdad || valoracion.edadMadre,
          ocupacionMadre: valoracion.madreOcupacion || valoracion.ocupacionMadre,
          nombrePadre: valoracion.padreNombre || valoracion.nombrePadre,
          edadPadre: valoracion.padreEdad || valoracion.edadPadre,
          ocupacionPadre: valoracion.padreOcupacion || valoracion.ocupacionPadre,
          documentoRepresentante: valoracion.documentoRepresentante
        });

        // Guardar el paciente
        const pacienteGuardado = await nuevoPaciente.save();
        console.log(`✅ Paciente creado: ${pacienteGuardado._id} - ${pacienteGuardado.nombres}`);

        // Actualizar la valoración con la referencia al paciente
        await ValoracionIngreso.findByIdAndUpdate(
          valoracion._id,
          { paciente: pacienteGuardado._id },
          { new: true }
        );

        console.log(`✅ Valoración actualizada con paciente: ${valoracion._id}`);
        migradas++;

      } catch (error) {
        console.error(`❌ Error migrando valoración ${valoracion._id}:`, error.message);
        errores++;
      }
    }

    console.log(`\n📊 Resumen de migración:`);
    console.log(`✅ Valoraciones migradas: ${migradas}`);
    console.log(`❌ Errores: ${errores}`);

    // Verificar que todas las valoraciones ahora tienen paciente
    const totalValoraciones = await ValoracionIngreso.countDocuments();
    const valoracionesConPaciente = await ValoracionIngreso.countDocuments({
      paciente: { $exists: true, $ne: null }
    });

    console.log(`\n📊 Verificación final:`);
    console.log(`Total valoraciones: ${totalValoraciones}`);
    console.log(`Con paciente: ${valoracionesConPaciente}`);
    console.log(`Sin paciente: ${totalValoraciones - valoracionesConPaciente}`);

    await mongoose.disconnect();
    console.log('✅ Migración completada y conexión cerrada');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
migrateLegacyValoraciones();