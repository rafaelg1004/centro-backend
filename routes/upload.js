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

// Nuevo endpoint para eliminar imagen de S3
router.delete('/delete-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'URL de imagen requerida' });
    }

    // Extraer la key del objeto de la URL
    const url = new URL(imageUrl);
    const key = url.pathname.substring(1); // Remover el primer "/"

    // Crear comando para eliminar objeto
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    });

    // Ejecutar eliminación
    await s3Client.send(deleteCommand);
    
    res.json({ success: true, message: 'Imagen eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ error: 'Error al eliminar imagen de S3' });
  }
});

module.exports = router;