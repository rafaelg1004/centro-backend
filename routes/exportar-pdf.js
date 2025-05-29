const express = require("express");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { execSync } = require("child_process");
const ImageModule = require("docxtemplater-image-module-free");
const { imageSize } = require("image-size");
const { PDFDocument } = require("pdf-lib");

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

// Endpoint para exportar PDF usando pdf-lib
router.post("/exportar-pdf", async (req, res) => {
  const data = req.body;
  try {
    // 1. Generar el Word con Docxtemplater
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

    // 2. Guardar el Word temporalmente
    const tempDir = path.resolve(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const filename = `valoracion_${Date.now()}`;
    const docxPath = path.join(tempDir, `${filename}.docx`);
    const pdfPath = path.join(tempDir, `${filename}.pdf`);

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    fs.writeFileSync(docxPath, buffer);

    // 3. Convertir el Word a PDF usando LibreOffice
    execSync(`soffice --headless --convert-to pdf --outdir "${tempDir}" "${docxPath}"`);

    // 4. Leer el PDF generado y modificarlo con pdf-lib
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // 5. Insertar las firmas y datos en la última página
const pages = pdfDoc.getPages();
const lastPage = pages[pages.length - 1];
const penultimaPage = pages[pages.length - 2];
const { width: pageWidth, height: pageHeight } = lastPage.getSize();
const { width: penWidth, height: penHeight } = penultimaPage.getSize();

// --- Firma Representante (arriba derecha, última página) ---
if (data.firmaRepresentante) {
  const base64Data = data.firmaRepresentante.split(",")[1];
  const imgBuffer = Buffer.from(base64Data, "base64");
  const pngImage = await pdfDoc.embedPng(imgBuffer);
  const firmaWidth = 120;
  const firmaHeight = (firmaWidth * pngImage.height) / pngImage.width;
  const x = 370;
  const y = 230;
    penultimaPage.drawImage(pngImage, { x, y, width: firmaWidth, height: firmaHeight });
 
  
}

// --- Firma Profesional (abajo izquierda, penúltima página) ---
if (data.firmaProfesional) {
  const base64Data = data.firmaProfesional.split(",")[1];
  const imgBuffer = Buffer.from(base64Data, "base64");
  const pngImage = await pdfDoc.embedPng(imgBuffer);
  const firmaWidth = 120;
  const firmaHeight = (firmaWidth * pngImage.height) / pngImage.width;
  const x = 100;
  const y = 230;
  penultimaPage.drawImage(pngImage, { x, y, width: firmaWidth, height: firmaHeight });
 
}

// --- Firma Autorización (abajo derecha, penúltima página) ---
if (data.firmaAutorizacion) {
  const base64Data = data.firmaAutorizacion.split(",")[1];
  const imgBuffer = Buffer.from(base64Data, "base64");
  const pngImage = await pdfDoc.embedPng(imgBuffer);
  const firmaWidth = 300;
  const firmaHeight = (firmaWidth * pngImage.height) / pngImage.width;
  const x = penWidth - firmaWidth - 20;
  const y = 400;
lastPage.drawImage(pngImage, { x, y, width: firmaWidth, height: firmaHeight });
 
}

   

    // 6. Guardar el PDF final
    const finalPdfBytes = await pdfDoc.save();
    const finalPdfPath = path.join(tempDir, `${filename}_final.pdf`);
    fs.writeFileSync(finalPdfPath, finalPdfBytes);

    // 7. Enviar el PDF final al usuario
    res.download(finalPdfPath, `${filename}_final.pdf`, () => {
      fs.unlinkSync(docxPath);
      fs.unlinkSync(pdfPath);
      fs.unlinkSync(finalPdfPath);
    });
  } catch (error) {
    console.error("❌ Error al generar Word/PDF:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
