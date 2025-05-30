const express = require("express");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const axios = require("axios");
const ImageModule = require("docxtemplater-image-module-free");
const { imageSize } = require("image-size");
const FormData = require("form-data");
const { PDFDocument } = require("pdf-lib");

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

    // Convertir a PDF usando el servicio externo (PDF.co)
    let pdfBuffer = await convertirDocxAPdf(buffer);

    // --- AGREGAR FIRMAS AL PDF ---
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    // Firma profesional y representante en la penúltima página
    if (totalPages >= 2) {
      const penultima = pages[totalPages - 2];
      if (data.firmaProfesional) {
        const firmaImg = await pdfDoc.embedPng(Buffer.from(data.firmaProfesional.split(",")[1], "base64"));
        penultima.drawImage(firmaImg, { x: 100, y: 200, width: 150, height: 50 });
      }
      if (data.firmaRepresentante) {
        const firmaImg = await pdfDoc.embedPng(Buffer.from(data.firmaRepresentante.split(",")[1], "base64"));
        penultima.drawImage(firmaImg, { x: 350, y: 200, width: 150, height: 50 });
      }
    }

    // Firma autorización en la última página
    if (totalPages >= 1 && data.firmaAutorizacion) {
      const ultima = pages[totalPages - 1];
      const firmaImg = await pdfDoc.embedPng(Buffer.from(data.firmaAutorizacion.split(",")[1], "base64"));
      ultima.drawImage(firmaImg, { x: 50, y: 400, width: 150, height: 50 });
    }

    pdfBuffer = await pdfDoc.save();
    // --- FIN AGREGAR FIRMAS ---

    // Enviar el PDF al frontend
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=valoracion.pdf");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ Error al generar docx o PDF:", error);
    res.status(500).send("Error al generar documento");
  }
});

// SUBIDA Y CONVERSIÓN PDF.CO
async function uploadFileToPdfCo(docxBuffer) {
  const apiKey = "binaria.0920@gmail.com_wBp2idsLSVMv74iKWAq1qXQzLA7jkSU71D8zaUU4GlfJKrKXSUUQKNtSqPtbZY2u";
  const url = "https://api.pdf.co/v1/file/upload/get-presigned-url?contenttype=application/vnd.openxmlformats-officedocument.wordprocessingml.document&name=documento.docx";

  // 1. Obtén la URL de subida
  const presigned = await axios.get(url, {
    headers: { "x-api-key": apiKey }
  });
  const uploadUrl = presigned.data.presignedUrl;
  const fileUrl = presigned.data.url;

  // 2. Sube el archivo a la URL presignada
  await axios.put(uploadUrl, docxBuffer, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
  });

  return fileUrl; // Esta URL la usarás en el siguiente paso
}

async function convertirDocxAPdf(docxBuffer) {
  const apiKey = "binaria.0920@gmail.com_wBp2idsLSVMv74iKWAq1qXQzLA7jkSU71D8zaUU4GlfJKrKXSUUQKNtSqPtbZY2u";
  // 1. Sube el archivo y obtén la URL
  const fileUrl = await uploadFileToPdfCo(docxBuffer);

  // 2. Llama al endpoint de conversión usando la URL
  const url = "https://api.pdf.co/v1/pdf/convert/from/doc";
  const body = {
    url: fileUrl,
    name: "documento.pdf"
  };

  const response = await axios.post(url, body, {
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json"
    }
  });

  // 3. Descarga el PDF generado
  if (!response.data.url) {
    console.error("❌ Error PDF.co:", response.data);
    throw new Error("No se pudo obtener el PDF");
  }
  const pdfUrl = response.data.url;
  const pdfResponse = await axios.get(pdfUrl, { responseType: "arraybuffer" });
  return pdfResponse.data;
}

module.exports = router;
