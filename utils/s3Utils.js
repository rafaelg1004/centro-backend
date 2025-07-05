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

module.exports = {
  eliminarImagenDeS3,
  eliminarImagenesValoracion,
  s3Client
};
