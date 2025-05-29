const express = require("express");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const axios = require("axios");
const ImageModule = require("docxtemplater-image-module-free");
const { imageSize } = require("image-size");
const FormData = require("form-data");

const router = express.Router();

// Función para descargar imagen desde URL y convertir a base64
async function urlToBase64(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const base64 = Buffer.from(response.data, 'binary').toString('base64');
  // Ajusta el tipo si tus firmas pueden ser jpg, png, etc.
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
        return [width * 0.03, height * 0.03]; // Ajusta el tamaño si lo necesitas
      },
    });

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(data);

    const buffer = doc.getZip().generate({ type: "nodebuffer" });

    // Convertir a PDF usando el servicio externo
    const pdfBuffer = await convertirDocxAPdf(buffer);

    // Enviar el PDF al frontend
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=valoracion.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ Error al generar docx:", error);
    res.status(500).send("Error al generar documento");
  }
});

async function convertirDocxAPdf(docxBuffer) {
  const apiKey = "binaria.0920@gmail.com_wBp2idsLSVMv74iKWAq1qXQzLA7jkSU71D8zaUU4GlfJKrKXSUUQKNtSqPtbZY2u"; // <-- pon aquí tu API Key
  const url = "https://api.pdf.co/v1/pdf/convert/from/doc";

  const formData = new FormData();
  formData.append("file", docxBuffer, "documento.docx");

  const response = await axios.post(url, formData, {
    headers: {
      ...formData.getHeaders(),
      "x-api-key": apiKey,
    },
    responseType: "arraybuffer",
  });

  return response.data; // PDF en buffer
}

module.exports = router;
