const PDFDocument = require('pdfkit');
const axios = require('axios');

class PDFReportGenerator {
  async generateValuationPDF(valuation, paciente, type = 'nino', profesional = {}, config = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- COLORES INSTITUCIONALES ---
        const COLOR_PRIMARIO = '#4F46E5'; // Indigo-600
        const COLOR_SECUNDARIO = '#DB2777'; // Pink-600
        const COLOR_TEXTO = '#1F2937'; // Gray-800
        const COLOR_TEXTO_CLARO = '#4B5563'; // Gray-600
        const COLOR_BG_SECCION = '#EEF2FF'; // Indigo-50
        const COLOR_LINEA = '#E5E7EB'; // Gray-200

        // --- HELPERS DE FORMATEO ---
        const calcEdad = (fechaNac) => {
          if (!fechaNac) return null;
          const hoy = new Date();
          const nac = new Date(fechaNac);
          let anos = hoy.getFullYear() - nac.getFullYear();
          let meses = hoy.getMonth() - nac.getMonth();
          if (hoy.getDate() < nac.getDate()) meses--;
          if (meses < 0) { anos--; meses += 12; }
          return anos < 2 ? `${anos} años (${anos * 12 + meses} meses)` : `${anos} años`;
        };

        const fmtFecha = (d) => {
          if (!d) return null;
          try { return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(); }
          catch { return String(d); }
        };

        const sanitizeText = (text) => {
          if (text === null || text === undefined || text === '') return 'No registrado';
          return String(text);
        };

        // --- HELPERS DE DIBUJO ---
        const addPageHeader = async (doc, isFirstPage = false) => {
          // Si no es la primera página, dejamos espacio, si es la primera hacemos el encabezado completo
          if (isFirstPage) {
            // Fondo superior
            doc.rect(0, 0, doc.page.width, 10).fill(COLOR_PRIMARIO);
            doc.rect(0, 10, doc.page.width, 3).fill(COLOR_SECUNDARIO);

            // LOGO
            let logoOffset = 50;
            if (config.logo_url) {
              try {
                let buffer;
                if (config.logo_url.startsWith('http')) {
                  const resp = await axios.get(config.logo_url, { responseType: 'arraybuffer' });
                  buffer = Buffer.from(resp.data, 'binary');
                } else if (config.logo_url.startsWith('data:image')) {
                  buffer = Buffer.from(config.logo_url.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                }
                if (buffer) {
                  doc.image(buffer, 50, 25, { width: 100 });
                  logoOffset = 160;
                }
              } catch (e) { console.warn("No se pudo cargar el logo:", e.message); }
            }

            // INFO CLINICA
            doc.fillColor(COLOR_PRIMARIO).fontSize(16).font('Helvetica-Bold')
               .text(config.nombre_clinica || "Clínica", logoOffset, 30);
            
            doc.fillColor(COLOR_TEXTO_CLARO).fontSize(8).font('Helvetica')
               .text(config.slogan || "Salud y Bienestar", logoOffset, doc.y + 2);
            
            doc.moveDown(0.5);
            doc.fontSize(8).font('Helvetica-Bold').text(`NIT: `, { continued: true }).font('Helvetica').text(config.nit || "N/A", { continued: true })
               .text(` | `, { continued: true }).font('Helvetica-Bold').text(`Dir: `, { continued: true }).font('Helvetica').text(config.direccion || "N/A");
            doc.font('Helvetica-Bold').text(`Tel: `, { continued: true }).font('Helvetica').text(config.telefono || "N/A", { continued: true })
               .text(` | `, { continued: true }).font('Helvetica-Bold').text(`Email: `, { continued: true }).font('Helvetica').text(config.email || "N/A");

            // CODIGO HABILITACION (Arriba a la derecha)
            doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_SECUNDARIO)
               .text(`Habilitación MinSalud: ${config.codigo_habilitacion || "Sin Registro"}`, 50, 30, { align: 'right' });

            doc.moveTo(50, 95).lineTo(doc.page.width - 50, 95).strokeColor(COLOR_LINEA).lineWidth(2).stroke();
            doc.y = 105;
          } else {
            doc.rect(0, 0, doc.page.width, 5).fill(COLOR_PRIMARIO);
            doc.y = 30;
          }
        };

        const checkSpace = async (heightNeeded) => {
          if (doc.y + heightNeeded > doc.page.height - 70) {
            doc.addPage();
            await addPageHeader(doc, false);
          }
        };

        const tituloSeccion = async (titulo) => {
          await checkSpace(30);
          doc.moveDown(0.5);
          const y = doc.y;
          doc.rect(50, y, doc.page.width - 100, 18).fill(COLOR_BG_SECCION);
          doc.fillColor(COLOR_PRIMARIO).fontSize(10).font('Helvetica-Bold')
             .text(titulo.toUpperCase(), 55, y + 5);
          doc.y = y + 25;
          doc.fillColor(COLOR_TEXTO).fontSize(9).font('Helvetica');
        };

        const campo = async (etiqueta, valor, col = 0, yPos = null) => {
          if (valor === undefined || valor === null || valor === '' || valor === false) return;
          if (typeof valor === 'boolean') valor = 'Sí';
          
          let x = 50;
          if (col === 1) x = 50;
          if (col === 2) x = 300;

          if (yPos) {
            doc.font('Helvetica-Bold').fontSize(8.5).text(`${etiqueta}: `, x, yPos, { continued: true })
               .font('Helvetica').fillColor(COLOR_TEXTO_CLARO).text(String(valor));
            doc.fillColor(COLOR_TEXTO);
          } else {
            await checkSpace(15);
            doc.font('Helvetica-Bold').fontSize(8.5).text(`${etiqueta}: `, { continued: true })
               .font('Helvetica').fillColor(COLOR_TEXTO_CLARO).text(String(valor));
            doc.fillColor(COLOR_TEXTO);
          }
        };

        const bloque = async (etiqueta, valor) => {
          if (!valor) return;
          await checkSpace(40);
          doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_PRIMARIO).text(etiqueta.toUpperCase());
          doc.moveDown(0.2);
          doc.font('Helvetica').fontSize(9).fillColor(COLOR_TEXTO).text(String(valor), { align: 'justify' });
          doc.moveDown(0.5);
        };

        // --- INICIO DEL DOCUMENTO ---
        await addPageHeader(doc, true);

        // --- TITULO DEL REPORTE ---
        const subTitulos = {
          nino:      "VALORACIÓN DE INGRESO PEDIÁTRICA",
          adulto:    "VALORACIÓN PISO PÉLVICO POSTPARTO",
          lactancia: "VALORACIÓN Y ASESORÍA DE LACTANCIA",
          perinatal: "VALORACIÓN PROGRAMA PERINATAL"
        };
        doc.fillColor(COLOR_TEXTO).fontSize(12).font('Helvetica-Bold')
           .text(subTitulos[type] || "HISTORIA CLÍNICA", { align: 'center' });
        
        const fechaAtencion = fmtFecha(valuation.fechaInicioAtencion) || fmtFecha(new Date());
        doc.fillColor(COLOR_TEXTO_CLARO).fontSize(8).font('Helvetica')
           .text(`FECHA DE ATENCIÓN: ${fechaAtencion}   |   CÓDIGO CUPS: ${valuation.codConsulta || 'N/A'}`, { align: 'center' });
        doc.moveDown(0.5);

        // --- DATOS DEL PACIENTE ---
        await tituloSeccion("Ficha de Identificación del Paciente");

        const nombreCompleto = [paciente.nombres, paciente.apellidos].filter(Boolean).join(' ') || 'No especificado';
        const docId = paciente.numDocumentoIdentificacion
          ? `${paciente.tipoDocumentoIdentificacion || ''} ${paciente.numDocumentoIdentificacion}`.trim()
          : (paciente.registroCivil ? `R.C. ${paciente.registroCivil}` : 'N/A');
        const sexo = paciente.codSexo === 'M' ? 'Masculino' : paciente.codSexo === 'F' ? 'Femenino' : paciente.codSexo;
        const telefonoPac = paciente.datosContacto?.telefono || paciente.telefono || paciente.celular || 'N/A';
        const edad = calcEdad(paciente.fechaNacimiento) || 'N/A';

        const datosPac = [
          ['Nombre del Paciente', nombreCompleto],
          ['Documento Identidad', docId],
          ['Fecha Nacimiento', fmtFecha(paciente.fechaNacimiento)],
          ['Edad Actual', edad],
          ['Sexo Biológico', sexo],
          ['Teléfono de Contacto', telefonoPac],
          ['Dirección Residencia', paciente.direccion || 'N/A'],
          ['Entidad Aseguradora', paciente.aseguradora || 'Particular'],
        ];

        if (!paciente.esAdulto) {
          if (paciente.nombreMadre) datosPac.push(['Madre', `${paciente.nombreMadre}${paciente.ocupacionMadre ? ` (${paciente.ocupacionMadre})` : ''}`]);
          if (paciente.nombrePadre) datosPac.push(['Padre', `${paciente.nombrePadre}${paciente.ocupacionPadre ? ` (${paciente.ocupacionPadre})` : ''}`]);
          if (paciente.pediatra)    datosPac.push(['Médico Pediatra', paciente.pediatra]);
        } else {
          if (paciente.ocupacion)        datosPac.push(['Ocupación Actual', paciente.ocupacion]);
          if (paciente.semanasGestacion) datosPac.push(['Semanas Gestación', paciente.semanasGestacion]);
        }

        const startY = doc.y;
        datosPac.forEach((r, i) => {
          campo(r[0], r[1], (i % 2 === 0) ? 1 : 2, startY + Math.floor(i / 2) * 15);
        });
        doc.y = startY + Math.ceil(datosPac.length / 2) * 15 + 10;

        // --- MOTIVO DE CONSULTA ---
        await tituloSeccion("Motivo de Consulta");
        doc.font('Helvetica').fontSize(9).fillColor(COLOR_TEXTO)
           .text(sanitizeText(valuation.motivoConsulta), { align: 'justify' });

        // --- CONTENIDO CLÍNICO DINÁMICO ---
        if (type === 'nino') {
          const mp = valuation.moduloPediatria || {};

          if (mp.prenatales && Object.values(mp.prenatales).some(v => v)) {
            await tituloSeccion("Antecedentes Prenatales");
            const p = mp.prenatales;
            await campo("Gestación Planeada", p.gestacionPlaneada);
            await campo("Gestación Controlada", p.gestacionControlada);
            await campo("Semanas Gestación", p.semanasGestacion);
            await campo("No. Controles Prenatales", p.numeroControles);
            await campo("Complicaciones", p.complicacionesEmbarazo || p.complicaciones);
            await campo("Medicamentos", p.medicamentos);
            await campo("Enfermedades", p.enfermedades);
          }

          if (mp.examen && Object.values(mp.examen).some(v => v)) {
            await tituloSeccion("Examen Físico Fisioterapéutico");
            const ex = mp.examen;
            const svY = doc.y;
            await campo("Frecuencia Cardíaca", ex.fc, 1, svY);
            await campo("Frecuencia Respiratoria", ex.fr, 2, svY);
            doc.y = svY + 15;
            await campo("Temperatura", ex.temperatura, 1, doc.y);
            doc.y += 20;

            await bloque("Tejido Tegumentario", ex.tejidoTegumentario);
            await bloque("Tono Muscular", ex.tonoMuscular);
            await bloque("Control Motor", ex.controlMotor);
            await bloque("Desplazamientos", ex.desplazamientos);
            await bloque("Sistema Pulmonar", ex.sistemaPulmonar);
          }

        } else if (type === 'adulto') {
          const mpp = valuation.moduloPisoPelvico || {};
          const sv  = valuation.signosVitales || {};

          await tituloSeccion("Signos Vitales y Antropometría");
          const svY1 = doc.y;
          await campo("Frecuencia Cardíaca", sv.fc, 1, svY1);
          await campo("Frec. Respiratoria", sv.fr, 2, svY1);
          const svY2 = svY1 + 15;
          await campo("Presión Arterial", sv.ta, 1, svY2);
          await campo("Temperatura", sv.temperatura, 2, svY2);
          const svY3 = svY2 + 15;
          await campo("Peso Actual", sv.pesoActual, 1, svY3);
          await campo("Talla", sv.talla, 2, svY3);
          const svY4 = svY3 + 15;
          await campo("IMC", sv.imc, 1, svY4);
          doc.y = svY4 + 20;

          if (mpp.obstetrica) {
            await tituloSeccion("Historia Ginecobstétrica");
            const ob = mpp.obstetrica;
            await campo("G / P / A / C", `G${ob.gestaciones||0} P${ob.partos||0} A${ob.abortos||0} C${ob.cesareas||0}`);
            await campo("Fecha Último Parto", ob.fechaUltimoParto);
            await campo("Episiotomía", ob.episiotomia);
            await campo("Desgarro", ob.desgarro);
          }
        } else if (type === 'lactancia') {
            const ml = valuation.moduloLactancia || {};
            await tituloSeccion("Información de Lactancia");
            await campo("Tipo de Lactancia", ml.tipoLactancia);
            await campo("Dificultades Reportadas", ml.dificultades);
            await campo("Experiencia Previa", ml.experienciaPrevia || ml.obstetricos?.experienciaLactancia);
        } else if (type === 'perinatal') {
            const mper = valuation.moduloPerinatal || {};
            await tituloSeccion("Datos de la Gestación Actual");
            await campo("Semanas de Gestación", mper.semanasGestacion);
            await campo("Fecha Última Menstruación", mper.fum);
            await campo("Fecha Probable de Parto", mper.fpp);
            await campo("Médico Tratante", mper.medicoTratante);
        }

        // --- DIAGNOSTICO Y TRATAMIENTO (Común a todos) ---
        await tituloSeccion("Diagnóstico y Plan de Tratamiento");
        await bloque("Diagnóstico Fisioterapéutico", valuation.diagnosticoFisioterapeutico);
        await bloque("Plan de Intervención / Tratamiento", valuation.planTratamiento);

        // --- FIRMAS ---
        await checkSpace(150);
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(COLOR_LINEA).lineWidth(1).stroke();
        doc.moveDown(2);

        const pintarFirma = async (imageSource, etiqueta, nombre, identificacion, xPos, width) => {
          doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO).text(etiqueta, xPos, doc.y);
          if (nombre) doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_TEXTO_CLARO).text(nombre, xPos, doc.y);
          if (identificacion) doc.text(identificacion, xPos, doc.y);

          const endY = doc.y;
          doc.y = endY - 65;

          if (imageSource) {
            try {
              let buffer;
              if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
                const resp = await axios.get(imageSource, { responseType: 'arraybuffer' });
                buffer = Buffer.from(resp.data, 'binary');
              } else if (typeof imageSource === 'string' && imageSource.startsWith('data:image')) {
                buffer = Buffer.from(imageSource.replace(/^data:image\/\w+;base64,/, ''), 'base64');
              }
              if (buffer) doc.image(buffer, xPos, doc.y, { fit: [width, 40] });
            } catch (e) { console.warn("Error cargando firma", e.message); }
          }
          
          doc.y = endY + 5;
          doc.moveTo(xPos, doc.y - 30).lineTo(xPos + width, doc.y - 30).strokeColor(COLOR_TEXTO).lineWidth(0.5).stroke();
        };

        const currentY = doc.y;
        
        // Firma Paciente
        const acudiente = valuation.firmas?.pacienteOAcudiente || {};
        await pintarFirma(
          acudiente.firmaUrl || null,
          "Firma del Paciente / Representante",
          acudiente.nombre || nombreCompleto,
          `ID: ${acudiente.cedula || docId}`,
          50, 200
        );

        // Firma Profesional
        doc.y = currentY;
        const profNombre   = profesional.nombre || config.representante_legal || 'Profesional de Salud';
        const profRegistro = profesional.registroMedico || config.registro_profesional_representante || 'Registro N/A';
        const profFirmaUrl = profesional.firmaUrl || null;
        
        await pintarFirma(
          profFirmaUrl,
          "Firma Profesional Tratante",
          profNombre,
          profRegistro,
          300, 200
        );

        // --- PIE DE PÁGINA (Añadido al evento de finalizar todas las páginas) ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(COLOR_BG_SECCION);
          
          const fechaGen = new Date().toLocaleString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          
          doc.fillColor(COLOR_TEXTO_CLARO).fontSize(7).font('Helvetica')
             .text(`Generado el: ${fechaGen} | Sistema D'Mamitas | Página ${i + 1} de ${range.count}`, 50, doc.page.height - 25, { align: 'center' });
             
          doc.fontSize(6).fillColor(COLOR_PRIMARIO)
             .text('Validez legal conforme a la Ley 527 de 1999 de la República de Colombia. Documento Confidencial.', 50, doc.page.height - 15, { align: 'center' });
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new PDFReportGenerator();
