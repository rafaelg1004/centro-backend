const mongoose = require('mongoose');
require('dotenv').config();

// Conectar a MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dmamitas';

async function verificarValoracionesPisoPelvico() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔗 Conectado a MongoDB');

    const db = mongoose.connection.db;
    
    // Verificar colecciones existentes
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Colecciones en la base de datos:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });

    // Buscar colección de valoraciones piso pélvico
    const colPisoPelvico = collections.find(col => 
      col.name.toLowerCase().includes('piso') || 
      col.name.toLowerCase().includes('pelvico') ||
      col.name.toLowerCase().includes('valoracion')
    );

    if (colPisoPelvico) {
      console.log(`\n✅ Colección encontrada: ${colPisoPelvico.name}`);
      
      const collection = db.collection(colPisoPelvico.name);
      const count = await collection.countDocuments();
      console.log(`📊 Total de documentos: ${count}`);

      if (count > 0) {
        const documentos = await collection.find({}).limit(5).toArray();
        console.log('\n📄 Ejemplos de documentos:');
        documentos.forEach((doc, index) => {
          console.log(`${index + 1}. ID: ${doc._id}`);
          console.log(`   Paciente: ${doc.paciente || 'No definido'}`);
          console.log(`   Fecha: ${doc.fecha || 'No definida'}`);
          console.log(`   Motivo: ${doc.motivoConsulta ? doc.motivoConsulta.substring(0, 50) + '...' : 'No definido'}`);
          console.log('');
        });
      }
    } else {
      console.log('\n❌ No se encontró colección de valoraciones piso pélvico');
      
      // Buscar todas las colecciones que contengan "valoracion"
      const valoracionCols = collections.filter(col => 
        col.name.toLowerCase().includes('valoracion')
      );
      
      if (valoracionCols.length > 0) {
        console.log('\n📋 Colecciones de valoración encontradas:');
        for (const col of valoracionCols) {
          const collection = db.collection(col.name);
          const count = await collection.countDocuments();
          console.log(`  - ${col.name}: ${count} documentos`);
        }
      }
    }

    // Verificar específicamente por el nombre esperado
    try {
      const valoracionpisopelvicos = db.collection('valoracionpisopelvicos');
      const countEspecifico = await valoracionpisopelvicos.countDocuments();
      console.log(`\n🔍 Colección 'valoracionpisopelvicos': ${countEspecifico} documentos`);
      
      if (countEspecifico > 0) {
        const docs = await valoracionpisopelvicos.find({}).limit(3).toArray();
        console.log('Documentos en valoracionpisopelvicos:');
        docs.forEach(doc => {
          console.log(`  - ID: ${doc._id}, Fecha: ${doc.fecha || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log('❌ Error al verificar colección valoracionpisopelvicos:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar el script
verificarValoracionesPisoPelvico();
