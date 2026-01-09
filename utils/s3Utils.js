const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Inicializar cliente S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Función para eliminar imagen de S3
async function eliminarImagenDeS3(imageUrl) {
  try {
    if (!imageUrl || !imageUrl.includes('amazonaws.com')) {
      return { success: false, error: 'URL no válida o no es de S3' };
    }

    const url = new URL(imageUrl);
    const key = url.pathname.substring(1);
    
    console.log(`Eliminando imagen de S3: ${key}`);
    
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    });

    await s3Client.send(deleteCommand);
    console.log(`✓ Imagen eliminada exitosamente de S3: ${key}`);
    return { success: true };
  } catch (error) {
    console.error(`Error eliminando imagen de S3:`, error);
    return { success: false, error: error.message };
  }
}

// Función para eliminar todas las imágenes de una valoración
async function eliminarImagenesValoracion(valoracion, camposImagen) {
  console.log(`Eliminando imágenes de valoración...`);

  const resultadosEliminacion = [];
  for (const campo of camposImagen) {
    if (valoracion[campo] && valoracion[campo].includes('amazonaws.com')) {
      console.log(`Eliminando imagen del campo ${campo}: ${valoracion[campo]}`);
      const resultado = await eliminarImagenDeS3(valoracion[campo]);
      resultadosEliminacion.push({ campo, resultado });
    }
  }

  console.log(`✓ Imágenes procesadas:`, resultadosEliminacion);
  return resultadosEliminacion;
}

// Función especial para eliminar todas las imágenes de un consentimiento perinatal
async function eliminarImagenesConsentimientoPerinatal(consentimiento, camposImagen) {
  console.log(`Eliminando imágenes de consentimiento perinatal...`);

  const resultadosEliminacion = [];
  
  // Eliminar imágenes de campos directos
  for (const campo of camposImagen) {
    if (consentimiento[campo] && consentimiento[campo].includes('amazonaws.com')) {
      console.log(`Eliminando imagen del campo ${campo}: ${consentimiento[campo]}`);
      const resultado = await eliminarImagenDeS3(consentimiento[campo]);
      resultadosEliminacion.push({ campo, resultado });
    }
  }

  // Eliminar imágenes de arrays de sesiones
  if (consentimiento.sesiones && Array.isArray(consentimiento.sesiones)) {
    for (let i = 0; i < consentimiento.sesiones.length; i++) {
      const sesion = consentimiento.sesiones[i];
      if (sesion.firmaPaciente && sesion.firmaPaciente.includes('amazonaws.com')) {
        console.log(`Eliminando firma de sesión ${i + 1}: ${sesion.firmaPaciente}`);
        const resultado = await eliminarImagenDeS3(sesion.firmaPaciente);
        resultadosEliminacion.push({ campo: `sesiones[${i}].firmaPaciente`, resultado });
      }
    }
  }

  // Eliminar imágenes de arrays de sesiones intensivo
  if (consentimiento.sesionesIntensivo && Array.isArray(consentimiento.sesionesIntensivo)) {
    for (let i = 0; i < consentimiento.sesionesIntensivo.length; i++) {
      const sesion = consentimiento.sesionesIntensivo[i];
      if (sesion.firmaPaciente && sesion.firmaPaciente.includes('amazonaws.com')) {
        console.log(`Eliminando firma de sesión intensivo ${i + 1}: ${sesion.firmaPaciente}`);
        const resultado = await eliminarImagenDeS3(sesion.firmaPaciente);
        resultadosEliminacion.push({ campo: `sesionesIntensivo[${i}].firmaPaciente`, resultado });
      }
    }
  }

  console.log(`✓ Imágenes de consentimiento perinatal procesadas:`, resultadosEliminacion);
  return resultadosEliminacion;
}

module.exports = {
  eliminarImagenDeS3,
  eliminarImagenesValoracion,
  eliminarImagenesConsentimientoPerinatal,
  s3Client
};
