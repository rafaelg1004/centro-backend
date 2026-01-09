const express = require("express");
const axios = require("axios");

const router = express.Router();

// Endpoint proxy para obtener imágenes de S3 como base64
router.get("/proxy-image", async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: "URL de imagen requerida" });
    }

    console.log('Descargando imagen desde:', url);
    
    // Descargar la imagen desde S3
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 10000 // 10 segundos de timeout
    });
    
    // Convertir a base64
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const mimeType = response.headers['content-type'] || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    console.log('Imagen convertida a base64 exitosamente');
    
    res.json({ 
      success: true, 
      dataUrl: dataUrl,
      mimeType: mimeType,
      size: base64.length
    });

  } catch (error) {
    console.error("Error al obtener imagen:", error.message);
    res.status(500).json({ 
      error: "Error al obtener imagen", 
      details: error.message 
    });
  }
});

module.exports = router;
