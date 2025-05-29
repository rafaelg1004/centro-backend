const express = require("express");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const ImageModule = require("docxtemplater-image-module-free");
const { imageSize } = require("image-size");

const router = express.Router();

// Funciones para manejar imágenes base64
function getImageSize(imgBase64) {
  const buffer = Buffer.from(imgBase64.split(",")[1], "base64");
  return imageSize(buffer);
}

function getImageBuffer(tagValue) {
  return Buffer.from(tagValue.split(",")[1], "base64");
}

// Endpoint para exportar Word usando Docxtemplater
router.post("/exportar-word", async (req, res) => {
  const data = req.body;
  try {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../plantilla/prueba.docx"),
      "binary"
    );
    const zip = new PizZip(content);
    const imageModule = new ImageModule({
      getImage: (tagValue) => getImageBuffer(tagValue),
      getSize: (img, tagValue) => {
        const { width, height } = getImageSize(tagValue);
        return [width * 0.03, height * 0.03]; // cm
      },
    });
    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });
    doc.render(data);

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    const filename = `valoracion_${Date.now()}.docx`;
    const filePath = path.join(__dirname, "../temp", filename);
    fs.writeFileSync(filePath, buffer);

    res.download(filePath, filename, () => {
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error("❌ Error al generar Word:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para exportar PDF usando Docxtemplater (solo genera Word y lo descarga)
router.post("/exportar-pdf", async (req, res) => {
  const data = req.body;
  try {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../plantilla/VALORACIONEST.AUD.docx"),
      "binary"
    );
    const zip = new PizZip(content);
    const imageModule = new ImageModule({
      getImage: (tagValue) => getImageBuffer(tagValue),
      getSize: (img, tagValue) => {
        const { width, height } = getImageSize(tagValue);
        return [width * 0.03, height * 0.03]; // cm
      },
    });
    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });
    doc.render(data);

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    const filename = `valoracion_${Date.now()}.docx`;
    const filePath = path.join(__dirname, "../temp", filename);
    fs.writeFileSync(filePath, buffer);

    res.download(filePath, filename, () => {
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error("❌ Error al generar Word:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
