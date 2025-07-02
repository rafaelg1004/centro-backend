const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
// REMPLAZA: const AWS = require('aws-sdk');
const { S3Client } = require('@aws-sdk/client-s3'); // <-- Importa S3Client de la V3
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
    acl: 'public-read',
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

module.exports = router;