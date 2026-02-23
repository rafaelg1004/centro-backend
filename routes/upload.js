const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
// REMPLAZA: const AWS = require('aws-sdk');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3'); // <-- Importa DeleteObjectCommand también
const router = express.Router();

// 1. Inicializa el cliente S3 de la V3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: { // Las credenciales se configuran directamente aquí en V3
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 2. Pasa el cliente S3 de la V3 a multer-s3
const upload = multer({
  storage: multerS3({
    s3: s3Client, // <-- Pasa s3Client (la instancia de la V3)
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  })
});

router.post('/upload', upload.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }
  res.json({ url: req.file.location });
});

// Función auxiliar para extraer key de S3 desde una URL
const extraerKeyDeUrl = (urlStr) => {
  try {
    const url = new URL(urlStr);
    return url.pathname.substring(1); // Remover el primer "/"
  } catch (error) {
    return null;
  }
};

// Nuevo endpoint para eliminar imagen de S3
router.delete('/delete-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL de imagen requerida' });
    }

    const key = extraerKeyDeUrl(imageUrl);
    if (!key) {
      return res.status(400).json({ error: 'URL de imagen inválida' });
    }

    console.log('Key extraída para eliminar:', key);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    });

    await s3Client.send(deleteCommand);
    res.json({ success: true, message: 'Imagen eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ error: 'Error al eliminar imagen de S3' });
  }
});

// Endpoint para eliminar firmas de S3 en bloque (Mantenido desde index.js refactorizado)
router.post('/eliminar-firmas-s3', async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'Se requiere un array de URLs' });
    }

    console.log(`Eliminando ${urls.length} firmas de S3...`);
    const resultados = [];

    for (const url of urls) {
      const key = extraerKeyDeUrl(url);
      if (!key) {
        resultados.push({ url, success: false, error: 'URL inválida' });
        continue;
      }

      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key
        });
        await s3Client.send(deleteCommand);
        resultados.push({ url, success: true });
      } catch (err) {
        resultados.push({ url, success: false, error: err.message });
      }
    }

    const exitosos = resultados.filter(r => r.success).length;
    const fallidos = resultados.filter(r => !r.success).length;

    res.json({
      mensaje: `Eliminación completada: ${exitosos} exitosos, ${fallidos} fallidos`,
      resultados,
      exitosos,
      fallidos
    });

  } catch (error) {
    console.error('Error eliminando firmas de S3:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;