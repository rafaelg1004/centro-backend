/**
 * Script de prueba para el convertidor RIPS
 */

const RIPSConverter = require('./ripsConverter');

async function testRIPSConverter() {
  console.log('🧪 Probando Convertidor RIPS según Resolución 1036 de 2022\n');

  const converter = new RIPSConverter();

  // Datos de prueba simulados
  const testData = {
    numFactura: 'FE001-2024',
    pacientes: [
      {
        paciente: {
          nombres: 'María José',
          apellidos: 'García López',
          tipoDocumento: 'CC',
          numeroDocumento: '12345678',
          fechaNacimiento: new Date('1990-05-15'),
          genero: 'Femenino',
          regimenAfiliacion: 'Contributivo',
          eps: 'Nueva EPS'
        },
        valoracionesIngreso: [
          {
            fecha: new Date('2024-01-15T10:30:00'),
            motivoDeConsulta: 'Valoración inicial de fisioterapia prenatal',
            profesionalTratante: {
              tipoDocumento: 'CC',
              numeroDocumento: '87654321',
              nombre: 'Dr. Juan Pérez',
              registroProfesional: 'PT-123456'
            },
            vrServicio: 50000
          }
        ],
        clases: [
          {
            fecha: new Date('2024-01-20T14:00:00'),
            titulo: 'Fisioterapia Prenatal - Sesión 1',
            instructor: {
              tipoDocumento: 'CC',
              numeroDocumento: '87654321',
              nombre: 'Dr. Juan Pérez'
            },
            vrServicio: 35000
          }
        ],
        sesionesPerinatales: [
          {
            fecha: new Date('2024-01-25T11:00:00'),
            profesional: {
              tipoDocumento: 'CC',
              numeroDocumento: '87654321',
              nombre: 'Dr. Juan Pérez'
            },
            vrServicio: 45000
          }
        ],
        consecutivo: 1
      },
      {
        paciente: {
          nombres: 'Carlos Andrés',
          apellidos: 'Rodríguez Silva',
          tipoDocumento: 'TI',
          numeroDocumento: '987654321',
          fechaNacimiento: new Date('2010-08-20'),
          genero: 'Masculino',
          regimenAfiliacion: 'Subsidiado',
          eps: 'Coomeva EPS'
        },
        valoracionesIngreso: [
          {
            fecha: new Date('2024-02-01T09:15:00'),
            motivoDeConsulta: 'Valoración fisioterapéutica pediátrica',
            profesionalTratante: {
              tipoDocumento: 'CC',
              numeroDocumento: '11223344',
              nombre: 'Dra. Ana María González',
              registroProfesional: 'PT-654321'
            },
            vrServicio: 40000
          }
        ],
        clases: [
          {
            fecha: new Date('2024-02-05T16:30:00'),
            titulo: 'Fisioterapia Pediátrica - Sesión 1',
            instructor: {
              tipoDocumento: 'CC',
              numeroDocumento: '11223344',
              nombre: 'Dra. Ana María González'
            },
            vrServicio: 30000
          }
        ],
        consecutivo: 2
      }
    ]
  };

  try {
    console.log('📊 Convirtiendo datos a formato RIPS...\n');

    const resultado = await converter.convertToRIPS(testData);

    if (resultado.isValid) {
      console.log('✅ Conversión exitosa!\n');

      console.log('📋 Estructura RIPS generada:');
      console.log(JSON.stringify(resultado.rips, null, 2));

      console.log('\n📈 Resumen:');
      console.log(`- Usuarios procesados: ${resultado.rips.usuarios.length}`);
      console.log(`- Servicios tecnológicos: ${resultado.rips.serviciosTecnologias.length}`);

      // Contar servicios por tipo
      resultado.rips.serviciosTecnologias.forEach((servicio, index) => {
        console.log(`\nUsuario ${index + 1}:`);
        console.log(`  - Consultas: ${servicio.consultas.length}`);
        console.log(`  - Procedimientos: ${servicio.procedimientos.length}`);
        console.log(`  - Urgencias: ${servicio.urgencias.length}`);
        console.log(`  - Hospitalizaciones: ${servicio.hospitalizacion.length}`);
        console.log(`  - Recién nacidos: ${servicio.recienNacidos.length}`);
        console.log(`  - Medicamentos: ${servicio.medicamentos.length}`);
        console.log(`  - Otros servicios: ${servicio.otrosServicios.length}`);
      });

    } else {
      console.log('❌ Errores de validación encontrados:');
      resultado.validationErrors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }

    if (resultado.validationWarnings.length > 0) {
      console.log('\n⚠️  Advertencias:');
      resultado.validationWarnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }

  } catch (error) {
    console.error('💥 Error durante la prueba:', error.message);
  }
}

// Ejecutar prueba
testRIPSConverter().catch(console.error);