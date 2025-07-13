const express = require("express");
const axios = require("axios");
const router = express.Router();

// Endpoint para descargar imágenes desde S3 y convertirlas a base64
router.get("/proxy-image", async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: "URL es requerida" });
    }

    console.log('Descargando imagen desde URL:', url);
    
    // Descargar la imagen desde S3
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000 // 10 segundos de timeout
    });

    // Convertir a base64
    const base64 = Buffer.from(response.data).toString('base64');
    const mimeType = response.headers['content-type'] || 'image/png';
    
    // Enviar como base64 data URL
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    res.json({ 
      success: true, 
      dataUrl: dataUrl,
      mimeType: mimeType,
      size: response.data.length
    });

  } catch (error) {
    console.error("Error descargando imagen:", error.message);
    res.status(500).json({ 
      error: "Error al descargar la imagen",
      details: error.message 
    });
  }
});

module.exports = router;
