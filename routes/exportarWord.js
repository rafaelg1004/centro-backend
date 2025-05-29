const express = require("express");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const router = express.Router();

router.post("/exportar-word", async (req, res) => {
  const data = req.body;

  try {
    // Cargar la plantilla .docx
    const content = fs.readFileSync(
      path.resolve(__dirname, "../plantilla/VALORACIONEST.AUD.docx"),
      "binary"
    );

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Inyectar los datos desde MongoDB
    doc.compile();       // ✅ NUEVO
    doc.render(data); 

    

    const buffer = doc.getZip().generate({ type: "nodebuffer" });

    // Guardar temporalmente
    const filename = `valoracion_${Date.now()}.docx`;
    const filepath = path.resolve(__dirname, `../public/${filename}`);
    fs.writeFileSync(filepath, buffer);

    // Enviar al frontend como descarga
    res.download(filepath, filename, () => {
      fs.unlinkSync(filepath); // eliminar después
    });
  } catch (error) {
    console.error("❌ Error al generar docx:", error);
    res.status(500).send("Error al generar documento");
  }
});

module.exports = router;
