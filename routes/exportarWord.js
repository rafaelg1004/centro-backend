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

    // Guarda el Word temporalmente
    const filename = `valoracion_${Date.now()}`;
    const docxPath = path.join(tempDir, `${filename}.docx`);
    const pdfPath = path.join(tempDir, `${filename}.pdf`);
    fs.writeFileSync(docxPath, doc.getZip().generate({ type: "nodebuffer" }));

    // Convierte el Word a PDF usando LibreOffice
    execSync(`soffice --headless --convert-to pdf --outdir "${tempDir}" "${docxPath}"`);

    // Lee el PDF generado
    let pdfBuffer = fs.readFileSync(pdfPath);

    // --- AGREGAR FIRMAS AL PDF ---
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    // Firma profesional y representante en la penúltima página
    if (totalPages >= 2) {
      const penultima = pages[totalPages - 2];
      if (data.firmaProfesional) {
        const firmaImg = await pdfDoc.embedPng(Buffer.from(data.firmaProfesional.split(",")[1], "base64"));
        penultima.drawImage(firmaImg, { x: 100, y: 230, width: 150, height: 50 });
      }
      if (data.firmaRepresentante) {
        const firmaImg = await pdfDoc.embedPng(Buffer.from(data.firmaRepresentante.split(",")[1], "base64"));
        penultima.drawImage(firmaImg, { x: 350, y: 230, width: 150, height: 50 });
      }
    }

    // Firma autorización en la última página
    if (totalPages >= 1 && data.firmaAutorizacion) {
      const ultima = pages[totalPages - 1];
      const firmaImg = await pdfDoc.embedPng(Buffer.from(data.firmaAutorizacion.split(",")[1], "base64"));
      ultima.drawImage(firmaImg, { x: 50, y: 350, width: 150, height: 50 });
      ultima.drawText("Firma Autorización", {
        x: 50,
        y: 340,
        size: 12,
        color: rgb(0, 0, 0),
      });
    }

    pdfBuffer = await pdfDoc.save();
    // --- FIN AGREGAR FIRMAS ---

    // Enviar el PDF al frontend
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=valoracion.pdf");
    res.send(pdfBuffer);

    // Limpieza de archivos temporales
    fs.unlinkSync(docxPath);
    fs.unlinkSync(pdfPath);

  } catch (error) {
    console.error("❌ Error al generar docx o PDF:", error);
    res.status(500).send("Error al generar documento");
  }
});

module.exports = router;
