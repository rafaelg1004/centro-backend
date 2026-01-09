require('dotenv').config();
const mongoose = require('mongoose');
const ValoracionPisoPelvico = require('./models/ValoracionPisoPelvico');
const ValoracionLactancia = require('./models/ValoracionIngresoAdultosLactancia');
const PacienteAdulto = require('./models/PacienteAdulto');

async function migrateValoracionesAdultos() {
  console.log('🔄 Iniciando migración de valoraciones de adultos...');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar valoraciones de piso pélvico sin paciente
    const valoracionesPisoPelvicoSinPaciente = await ValoracionPisoPelvico.find({
      $or: [
        { paciente: null },
        { paciente: { $exists: false } }
      ]
    });

    console.log(`📊 Encontradas ${valoracionesPisoPelvicoSinPaciente.length} valoraciones de piso pélvico sin paciente`);

    // Buscar valoraciones de lactancia sin paciente
    const valoracionesLactanciaSinPaciente = await ValoracionLactancia.find({
      $or: [
        { paciente: null },
        { paciente: { $exists: false } }
      ]
    });

    console.log(`📊 Encontradas ${valoracionesLactanciaSinPaciente.length} valoraciones de lactancia sin paciente`);

    let totalMigradas = 0;
    let errores = 0;

    // Migrar valoraciones de piso pélvico
    for (const valoracion of valoracionesPisoPelvicoSinPaciente) {
      try {
        console.log(`🔄 Migrando valoración piso pélvico: ${valoracion._id}`);

        // Crear paciente adulto basado en los datos de la valoración
        const nuevoPaciente = new PacienteAdulto({
          nombres: `Paciente Adulto ${valoracion._id.toString().slice(-6)}`,
          cedula: `AD${valoracion._id.toString().slice(-6)}`,
          telefono: '',
          fechaNacimiento: null,
          genero: '',
          lugarNacimiento: '',
          estadoCivil: '',
          direccion: '',
          celular: '',
          ocupacion: '',
          nivelEducativo: '',
          medicoTratante: '',
          aseguradora: '',
          acompanante: '',
          telefonoAcompanante: '',
          nombreBebe: '',
          semanasGestacion: '',
          fum: null,
          fechaProbableParto: null
        });

        const pacienteGuardado = await nuevoPaciente.save();
        console.log(`✅ Paciente creado: ${pacienteGuardado._id} - ${pacienteGuardado.nombres}`);

        // Actualizar la valoración con el paciente
        await ValoracionPisoPelvico.findByIdAndUpdate(
          valoracion._id,
          { paciente: pacienteGuardado._id },
          { new: true }
        );

        console.log(`✅ Valoración actualizada con paciente: ${valoracion._id}`);
        totalMigradas++;

      } catch (error) {
        console.error(`❌ Error migrando valoración ${valoracion._id}:`, error.message);
        errores++;
      }
    }

    // Migrar valoraciones de lactancia
    for (const valoracion of valoracionesLactanciaSinPaciente) {
      try {
        console.log(`🔄 Migrando valoración lactancia: ${valoracion._id}`);

        // Crear paciente adulto basado en los datos de la valoración
        const nuevoPaciente = new PacienteAdulto({
          nombres: `Paciente Lactancia ${valoracion._id.toString().slice(-6)}`,
          cedula: `LA${valoracion._id.toString().slice(-6)}`,
          telefono: '',
          fechaNacimiento: null,
          genero: '',
          lugarNacimiento: '',
          estadoCivil: '',
          direccion: '',
          celular: '',
          ocupacion: '',
          nivelEducativo: '',
          medicoTratante: '',
          aseguradora: '',
          acompanante: '',
          telefonoAcompanante: '',
          nombreBebe: '',
          semanasGestacion: '',
          fum: null,
          fechaProbableParto: null
        });

        const pacienteGuardado = await nuevoPaciente.save();
        console.log(`✅ Paciente creado: ${pacienteGuardado._id} - ${pacienteGuardado.nombres}`);

        // Actualizar la valoración con el paciente
        await ValoracionLactancia.findByIdAndUpdate(
          valoracion._id,
          { paciente: pacienteGuardado._id },
          { new: true }
        );

        console.log(`✅ Valoración actualizada con paciente: ${valoracion._id}`);
        totalMigradas++;

      } catch (error) {
        console.error(`❌ Error migrando valoración ${valoracion._id}:`, error.message);
        errores++;
      }
    }

    console.log('\n📊 Resumen de migración:');
    console.log(`✅ Valoraciones migradas: ${totalMigradas}`);
    console.log(`❌ Errores: ${errores}`);

    // Verificación final
    const totalPisoPelvico = await ValoracionPisoPelvico.countDocuments();
    const totalPisoPelvicoConPaciente = await ValoracionPisoPelvico.countDocuments({
      paciente: { $exists: true, $ne: null }
    });

    const totalLactancia = await ValoracionLactancia.countDocuments();
    const totalLactanciaConPaciente = await ValoracionLactancia.countDocuments({
      paciente: { $exists: true, $ne: null }
    });

    console.log('\n📊 Verificación final:');
    console.log(`Piso Pélvico: ${totalPisoPelvicoConPaciente}/${totalPisoPelvico} con paciente`);
    console.log(`Lactancia: ${totalLactanciaConPaciente}/${totalLactancia} con paciente`);

    console.log('\n✅ Migración completada y conexión cerrada');

  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateValoracionesAdultos();