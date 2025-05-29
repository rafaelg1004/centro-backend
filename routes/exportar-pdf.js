const express = require("express");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const ImageModule = require("docxtemplater-image-module-free");
const { imageSize } = require("image-size");
const { PDFDocument } = require('pdf-lib');
const { execSync } = require("child_process");

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
  const tempDir = path.join(__dirname, "../temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  try {
    // 1. Genera el Word y conviértelo a PDF (como antes)
    const content = fs.readFileSync(
      path.resolve(__dirname, "../plantilla/VALORACIONEST.AUD.docx"),
      "binary"
    );
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);

    const filename = `valoracion_${Date.now()}`;
    const docxPath = path.join(tempDir, `${filename}.docx`);
    const pdfPath = path.join(tempDir, `${filename}.pdf`);
    fs.writeFileSync(docxPath, doc.getZip().generate({ type: "nodebuffer" }));

    execSync(`soffice --headless --convert-to pdf --outdir "${tempDir}" "${docxPath}"`);

    // 2. Inserta las firmas en el PDF usando pdf-lib
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Firma profesional (ejemplo: página 1, posición x=100, y=100, ancho=150, alto=50)
    if (data.firmaProfesional) {
      const firmaImg = await pdfDoc.embedPng(Buffer.from(data.firmaProfesional.split(",")[1], "base64"));
      const page = pdfDoc.getPages()[0];
      page.drawImage(firmaImg, { x: 100, y: 100, width: 150, height: 50 });
    }

    // Firma representante (ejemplo: página 1, posición x=100, y=50, ancho=150, alto=50)
    if (data.firmaRepresentante) {
      const firmaImg = await pdfDoc.embedPng(Buffer.from(data.firmaRepresentante.split(",")[1], "base64"));
      const page = pdfDoc.getPages()[0];
      page.drawImage(firmaImg, { x: 100, y: 50, width: 150, height: 50 });
    }

    // Firma autorización (ejemplo: página 1, posición x=100, y=10, ancho=150, alto=50)
    if (data.firmaAutorizacion) {
      const firmaImg = await pdfDoc.embedPng(Buffer.from(data.firmaAutorizacion.split(",")[1], "base64"));
      const page = pdfDoc.getPages()[0];
      page.drawImage(firmaImg, { x: 100, y: 10, width: 150, height: 50 });
    }

    const pdfWithFirmas = await pdfDoc.save();

    // 3. Devuelve el PDF modificado
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}.pdf`);
    res.send(pdfWithFirmas);

    // Limpieza de archivos temporales
    fs.unlinkSync(docxPath);
    fs.unlinkSync(pdfPath);

  } catch (error) {
    console.error("❌ Error al generar PDF:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
