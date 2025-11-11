const express = require("express");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const axios = require("axios");
const ImageModule = require("docxtemplater-image-module-free");
const { imageSize } = require("image-size");
const { PDFDocument, rgb } = require("pdf-lib");
const { execSync } = require("child_process");

const router = express.Router();

// Función para descargar imagen desde URL y convertir a base64
async function urlToBase64(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const base64 = Buffer.from(response.data, 'binary').toString('base64');
  return `data:image/png;base64,${base64}`;
}

// Funciones para el módulo de imágenes
function getImageBuffer(tagValue) {
  return Buffer.from(tagValue.split(",")[1], "base64");
}
function getImageSize(imgBase64) {
  const buffer = Buffer.from(imgBase64.split(",")[1], "base64");
  return imageSize(buffer);
}

router.post("/exportar-word", async (req, res) => {
  const data = req.body;
  const tempDir = path.join(__dirname, "../temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  try {
    // Procesa todas las firmas que sean URL
    const firmas = ["firmaRepresentante", "firmaProfesional", "firmaAutorizacion"];
    for (const key of firmas) {
      if (data[key] && typeof data[key] === "string" && data[key].startsWith("http")) {
        data[key] = await urlToBase64(data[key]);
      }
    }

    // Cargar la plantilla .docx
    const content = fs.readFileSync(
      path.resolve(__dirname, "../plantilla/VALORACIONEST.AUD.docx"),
      "binary"
    );

    const zip = new PizZip(content);
    const imageModule = new ImageModule({
      getImage: (tagValue) => getImageBuffer(tagValue),
      getSize: (img, tagValue) => {
        const { width, height } = getImageSize(tagValue);
        return [width * 0.03, height * 0.03];
      },
    });

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(data);

    // Generar el archivo Word directamente
    const docxBuffer = doc.getZip().generate({ type: "nodebuffer" });

    // Enviar el archivo Word al frontend
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", "attachment; filename=valoracion.docx");
    res.send(docxBuffer);

  } catch (error) {
    console.error("❌ Error al generar docx o PDF:", error);
    res.status(500).send("Error al generar documento");
  }
});

module.exports = router;
