const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class PDFReportGenerator {
  /**
   * Generates a complete PDF report for a valuation
   */
  async generateValuationPDF(valuation, paciente, type = 'nino', profesional = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- Styles ---
        const titleColor = '#4338ca'; // indigo-700
        const headerColor = '#1e1b4b'; // indigo-950
        const textColor = '#374151'; // gray-700

        // --- Header ---
        doc.fillColor(headerColor).fontSize(16).font('Helvetica-Bold').text("D'Mamitas & Babies", 50, 50, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text("NIT: 900.000.000-0", { align: 'center' });
        doc.text("Celular: 3000000000", { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor(titleColor).fontSize(14).font('Helvetica-Bold').text("HISTORIA CLÍNICA", { align: 'center' });

        let subTitle = "Reporte Clínico";
        if (type === 'nino') subTitle = "Valoración de Ingreso Pediátrica";
        else if (type === 'adulto') subTitle = "Valoración de Piso Pélvico - Adultos";
        else if (type === 'lactancia') subTitle = "Valoración Adultos y Asesoría de Lactancia";
        else if (type === 'perinatal') subTitle = "Consentimiento y Valoración Programa Perinatal";

        doc.fontSize(11).text(subTitle, { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // --- Section Helper ---
        const addSectionTitle = (title) => {
          doc.moveDown();
          let currentY = doc.y;
          doc.rect(50, currentY, 500, 16).fill('#eef2ff');
          doc.fillColor(titleColor).fontSize(10).font('Helvetica-Bold').text(title.toUpperCase(), 55, currentY + 4);
          doc.y = currentY + 22; // Salto manual después del rect
          doc.fillColor(textColor).fontSize(10);
        };

        const addField = (label, value) => {
          if (value === undefined || value === null || value === "") value = 'No especificado';
          if (typeof value === 'boolean') value = value ? 'Sí' : 'No';
          doc.font('Helvetica-Bold').text(`${label}: `, { continued: true })
             .font('Helvetica').text(String(value));
        };

        // --- Patient Data ---
        addSectionTitle("Datos del Paciente");
        
        const patientFields = [
          { label: "Nombre", value: paciente.nombres },
          { label: "Identificación", value: paciente.numeroDocumento || paciente.registroCivil || paciente.cedula },
          { label: "Edad", value: paciente.edad },
          { label: "Género", value: paciente.genero },
          { label: "F. Nacimiento", value: paciente.fechaNacimiento },
          { label: "Dirección", value: paciente.direccion },
          { label: "Celular", value: paciente.celular || paciente.telefono },
          { label: "Aseguradora", value: paciente.aseguradora || 'No especificada' }
        ];

        let ptY = doc.y;
        patientFields.forEach((field, idx) => {
          let isEven = idx % 2 === 0;
          let x = isEven ? 55 : 300;
          let y = ptY + Math.floor(idx / 2) * 15;
          doc.font('Helvetica-Bold').fontSize(10).text(`${field.label}: `, x, y, { continued: true })
             .font('Helvetica').text(String(field.value || 'No especificado'));
        });
        doc.y = ptY + Math.ceil(patientFields.length / 2) * 15 + 10;


        // --- Valuation Specifics ---
        if (type === 'nino') {
          addSectionTitle("Antecedentes");
          addField("Motivo de Consulta", valuation.motivoDeConsulta);
          addField("Tipo de Parto", valuation.tipoParto);
          addField("Patológicos", valuation.patologicos);
          addField("Alimentación", valuation.dieta);

          addSectionTitle("Diagnóstico y Plan");
          doc.text(valuation.diagnosticoFisioterapeutico || "No especificado");
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').text("Plan de Manejo:");
          doc.font('Helvetica').text(valuation.planTratamiento || "No especificado");

        } else if (type === 'adulto') {
          addSectionTitle("Resumen Clínico");
          addField("Motivo Consulta", valuation.motivoConsulta);
          addField("Ginecobstétricos (G/P/A/C)", `${valuation.numEmbarazos || 0}/${valuation.numPartosVaginales || 0}/${valuation.numAbortos || 0}/${valuation.numCesareas || 0}`);
          addField("Alergias", valuation.alergias);
          
          addSectionTitle("Diagnóstico y Plan de Intervención");
          addField("Diagnóstico", valuation.diagnosticoFisio);
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').text("Plan:");
          doc.font('Helvetica').text(valuation.planIntervencion);

        } else if (type === 'lactancia') {
          addSectionTitle("Antecedentes y Lactancia");
          addField("Motivo", valuation.motivoConsulta);
          addField("Experiencia Lactancia", valuation.experienciaLactancia);
          addField("Dificultades", valuation.dificultadesLactancia);
          addField("Plan Intervención", valuation.planIntervencion);

        } else if (type === 'perinatal') {
          addSectionTitle("Programa Perinatal");
          addField("Tipo de Programa", valuation.tipoPrograma);
          addField("Semanas Gestación", valuation.semanasGestacion);
          addField("Diagnóstico", valuation.diagnosticoFisioterapeutico);
          addField("Plan Intervención", valuation.planIntervencion);
        }

        // --- SIGNATURES AND TEXTS ---
        doc.addPage();

        // Datos del profesional:
        // - Nombre/registro: lo que guardó el formulario tiene prioridad (quien firmó)
        // - Firma: prioridad a la firma dibujada/guardada en la valoración; solo si no existe se usa la firma del perfil (estampada)
        const profNombre = valuation.firmas?.profesional?.nombre || profesional.nombre || 'Ft. Dayan Ivonne Villegas Gamboa';
        const profRegistro = valuation.firmas?.profesional?.registroMedico || profesional.registroMedico || '52862625 - Reg. Salud Departamental';
        // Firma del profesional: únicamente del perfil del creador (firmaUrl = null si no tiene firma guardada)
        const profFirmaUrl = profesional.firmaUrl || null;

        const addSignature = async (imageSource, label, name, id) => {
          if (!imageSource) return;
          doc.moveDown();
          doc.font('Helvetica-Bold').text(label);
          if (name) doc.font('Helvetica').text(`Nombre: ${name}`);
          if (id) doc.text(`Identificación: ${id}`);
          
          try {
            let buffer;
            if (imageSource.startsWith('http')) {
              const response = await axios.get(imageSource, { responseType: 'arraybuffer' });
              buffer = Buffer.from(response.data, 'binary');
            } else if (imageSource.startsWith('data:image')) {
              const imgData = imageSource.replace(/^data:image\/\w+;base64,/, "");
              buffer = Buffer.from(imgData, 'base64');
            }
            if (buffer) doc.image(buffer, { fit: [180, 80], align: 'center' });
          } catch (err) {
            doc.text("[Error al cargar firma]");
          }
          doc.moveDown(0.5);
        };

        const renderAllSignatures = async () => {
           if (type === 'nino') {
             addSectionTitle("Autorización de Uso de Imagen");
             doc.fontSize(8).text(`Atendiendo al ejercicio de la Patria Potestad, establecido en el Código Civil Colombiano en su artículo 288, el artículo 24 del Decreto 2820 de 1974 y la Ley de Infancia y Adolescencia, el Ministerio de Educación Nacional solicita la autorización escrita del padre/madre de familia o acudiente del menor de edad: ${paciente.nombres}, identificado(a) con Registro Civil número ${paciente.registroCivil}, para reproducir fotografías e imágenes de las actividades en las que participe, para ser utilizadas en publicaciones, proyectos, redes sociales y página Web.\n\nPara constancia de lo anterior se firma y otorga en la ciudad de ${valuation.ciudadFirma || 'Montería'}, el día ${valuation.diaFirma || '___'} del mes de ${valuation.mesFirma || '___'} de ${valuation.anioFirma || '___'}.`, { align: 'justify' });
             await addSignature(valuation.firmaAutorizacion, "Firma Autorización Imagen", valuation.nombreAcudiente, valuation.cedulaAutorizacion);

             doc.addPage();
             addSectionTitle("Constancia de Consentimiento Informado");
             doc.fontSize(8).text(`Yo ${valuation.consentimiento_nombreAcudiente} mayor de edad e Identificado con c.c. ${valuation.consentimiento_ccAcudiente} de ${valuation.consentimiento_lugarExpedicion} actuando en nombre propio o como representante legal de ${paciente.nombres} identificado con Registro Civil No. ${paciente.registroCivil} HAGO CONSTAR que he sido informado hoy ${valuation.consentimiento_fecha} por la Fisioterapeuta Dayan Ivonne Villegas Gamboa, sobre el programa de Estimulación Adecuada de D'Mamitas&Babies...\n\nDurante la atención se pueden generar riesgos como lesiones osteomusculares, caída o golpes... se explicó la importancia de acompañar permanentemente a mi hijo/a...`, { align: 'justify' });
             await addSignature(valuation.consentimiento_firmaAcudiente, "Firma Consentimiento Acudiente", valuation.consentimiento_nombreAcudiente, valuation.consentimiento_ccFirmaAcudiente);

             doc.addPage();
             addSectionTitle("Aval Final");
             await addSignature(profFirmaUrl, "Firma del Profesional", profNombre, profRegistro);
             await addSignature(valuation.firmas?.pacienteOAcudiente?.firmaUrl || valuation.firmaRepresentante, "Firma del Representante", valuation.firmas?.pacienteOAcudiente?.nombre || valuation.nombreAcudiente, valuation.firmas?.pacienteOAcudiente?.cedula || valuation.cedulaAcudiente);

           } else if (type === 'adulto') {
             addSectionTitle("Autorización de Uso de Imagen");
             doc.fontSize(9).text("Autorizo a D'Mamitas & Babies para reproducir fotografías e imágenes de las actividades en las que participe, para ser utilizadas en sus publicaciones, proyectos, redes sociales y página web.", { align: 'justify' });
             await addSignature(valuation.firmaAutorizacion, "Firma Autorización Imagen", paciente.nombres, paciente.cedula);

             doc.addPage();
             addSectionTitle("Consentimiento Informado");
             doc.fontSize(8).text("Reconozco y entiendo que me han remitido a fisioterapia pélvica para evaluación y tratamiento. Entiendo los procedimientos que incluyen inspección y palpación detallada del área abdominal, pélvica y genital externa/interna si se requiere.", { align: 'justify' });
             await addSignature(valuation.consentimientoFirma, "Firma Consentimiento Paciente", valuation.consentimientoNombre || paciente.nombres, valuation.consentimientoCC || paciente.cedula);

             doc.addPage();
             addSectionTitle("Aval Final");
             await addSignature(profFirmaUrl, "Firma del Profesional", profNombre, profRegistro);
             await addSignature(valuation.firmas?.pacienteOAcudiente?.firmaUrl || valuation.firmaPaciente, "Firma del Paciente", paciente.nombres, paciente.cedula);

           } else if (type === 'lactancia') {
             addSectionTitle("Autorización de Imagen");
             doc.fontSize(9).text("Autorizo el uso de imágenes para fines clínicos y educativos de D'Mamitas & Babies.", { align: 'justify' });
             await addSignature(valuation.firmaAutorizacion, "Firma Autorización", paciente.nombres, paciente.cedula);

             doc.addPage();
             addSectionTitle("Consentimiento de Lactancia");
             doc.fontSize(8).text(`Yo ${paciente.nombres} con CC ${paciente.cedula} acepto participar en la asesoría de lactancia, entendiendo que no reemplaza una consulta médica y que el éxito depende de mi disposición.`, { align: 'justify' });
             await addSignature(valuation.firmas?.pacienteOAcudiente?.firmaUrl || valuation.firmaConsentimientoLactancia, "Firma Madre/Paciente", paciente.nombres, paciente.cedula);
             await addSignature(profFirmaUrl, "Firma Profesional Responsable", profNombre, profRegistro);

             doc.addPage();
             addSectionTitle("Aceptación Plan de Intervención");
             await addSignature(valuation.firmas?.pacienteOAcudiente?.firmaUrl || valuation.firmaPaciente, "Firma Paciente", paciente.nombres, paciente.cedula);
             await addSignature(profFirmaUrl, "Firma Fisioterapeuta", profNombre, profRegistro);

           } else if (type === 'perinatal') {
             addSectionTitle("Autorización de Imagen");
             doc.fontSize(9).text("Autorizo el uso de imágenes para redes sociales y proyectos educativos de la entidad.", { align: 'justify' });
             await addSignature(valuation.firmaAutorizacion, "Firma Autorización", paciente.nombres, paciente.cedula);

             doc.addPage();
             addSectionTitle("Consentimiento Programa Perinatal");
             doc.fontSize(8).text(`Yo ${paciente.nombres} identificada con CC ${paciente.cedula} doy mi consentimiento expreso para el tratamiento y comprendo los beneficios y riesgos del programa.`, { align: 'justify' });
             await addSignature(valuation.firmas?.pacienteOAcudiente?.firmaUrl || valuation.firmaPaciente, "Firma Paciente", paciente.nombres, paciente.cedula);
             await addSignature(profFirmaUrl, "Firma Fisioterapeuta", profNombre, profRegistro);
             // Programas específicos si aplican
             if (valuation.firmaPacienteConsentimiento || (valuation.tipoPrograma === 'fisico' || valuation.tipoPrograma === 'ambos')) {
               doc.addPage();
               addSectionTitle("Consentimiento Acondicionamiento Físico");
               doc.fontSize(8).text("Programa de acondicionamiento físico perinatal (8 sesiones). Comprendo los riesgos y beneficios descritos en el protocolo de la entidad.", { align: 'justify' });
               await addSignature(valuation.firmaPacienteConsentimiento || valuation.firmaPacienteFisico, "Firma Paciente (Físico)", paciente.nombres, null);
               await addSignature(profFirmaUrl, "Firma Fisioterapeuta (Físico)", profNombre, profRegistro);
             }

             if (valuation.firmaPacienteGeneral || (valuation.tipoPrograma === 'educacion' || valuation.tipoPrograma === 'ambos')) {
               doc.addPage();
               addSectionTitle("Consentimiento Educación Perinatal");
               doc.fontSize(8).text("Programa de preparación para el nacimiento (10 sesiones). Entiendo los objetivos educativos y prácticos del programa.", { align: 'justify' });
               await addSignature(valuation.firmaPacienteGeneral, "Firma Paciente (Educación)", paciente.nombres, null);
               await addSignature(profFirmaUrl, "Firma Fisioterapeuta (Educación)", profNombre, profRegistro);
             }

             if (valuation.sesiones && valuation.sesiones.length > 0) {
                addSectionTitle("Resumen de Sesiones Realizadas");
                valuation.sesiones.forEach((s, idx) => {
                  if (s.fecha) doc.text(`${idx + 1}. ${s.nombre || 'Sesión'}: ${s.fecha} - [${s.firmaPaciente ? 'Firmada' : 'No firmada'}]`);
                });
             }
           }
           // Pie de página legal - firma estampada
           doc.moveDown(2);
           doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
           doc.moveDown(0.5);
           const ahora = new Date();
           const fechaFirma = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
           const horaFirma = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
           doc.fillColor('#555555').fontSize(7)
              .text(`Documento firmado electrónicamente mediante acceso seguro de usuario ${profNombre} el día ${fechaFirma} a las ${horaFirma}.`, { align: 'center' })
              .text('Este documento tiene validez legal de conformidad con la Ley 527 de 1999 de la República de Colombia.', { align: 'center' });

           doc.end();
        };

        await renderAllSignatures();

      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new PDFReportGenerator();
