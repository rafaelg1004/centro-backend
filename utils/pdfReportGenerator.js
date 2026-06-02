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
        const COLOR_TEXTO = '#1F2937'; // Gray-800
        const COLOR_TEXTO_CLARO = '#4B5563'; // Gray-600
        const COLOR_BG_SECCION = '#F3F4F6'; // Gray-100
        const COLOR_LINEA = '#D1D5DB'; // Gray-300

        // --- HELPERS DE LECTURA DE DATOS (Soporta snake_case y camelCase) ---
        const getVal = (obj, camelKey, snakeKey) => {
          if (!obj) return null;
          if (obj[camelKey] !== undefined && obj[camelKey] !== null) return obj[camelKey];
          if (snakeKey && obj[snakeKey] !== undefined && obj[snakeKey] !== null) return obj[snakeKey];
          return null;
        };

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
          if (isFirstPage) {
            let logoOffset = 50;
            // LOGO
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
                  doc.image(buffer, 50, 40, { width: 100, fit: [100, 60] });
                  logoOffset = 160;
                }
              } catch (e) { console.warn("No se pudo cargar el logo:", e.message); }
            }

            // INFO CLINICA
            doc.fillColor(COLOR_PRIMARIO).fontSize(16).font('Helvetica-Bold')
               .text(config.nombre_clinica || "Clínica", logoOffset, 45);
            
            doc.fillColor(COLOR_TEXTO_CLARO).fontSize(9).font('Helvetica')
               .text(config.slogan || "Salud y Bienestar", logoOffset, doc.y + 2);
            
            doc.moveDown(0.5);
            doc.fontSize(8).font('Helvetica-Bold').text(`NIT: `, { continued: true }).font('Helvetica').text(config.nit || "N/A", { continued: true })
               .text(` | `, { continued: true }).font('Helvetica-Bold').text(`Dir: `, { continued: true }).font('Helvetica').text(config.direccion || "N/A");
            doc.font('Helvetica-Bold').text(`Tel: `, { continued: true }).font('Helvetica').text(config.telefono || "N/A", { continued: true })
               .text(` | `, { continued: true }).font('Helvetica-Bold').text(`Email: `, { continued: true }).font('Helvetica').text(config.email || "N/A");

            // CODIGO HABILITACION (Arriba a la derecha)
            doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_TEXTO_CLARO)
               .text(`Habilitación: ${config.codigo_habilitacion || "Sin Registro"}`, 50, 45, { align: 'right' });

            doc.moveTo(50, 110).lineTo(doc.page.width - 50, 110).strokeColor(COLOR_PRIMARIO).lineWidth(1.5).stroke();
            doc.y = 125;
          } else {
            doc.y = 50;
            doc.moveTo(50, 40).lineTo(doc.page.width - 50, 40).strokeColor(COLOR_LINEA).lineWidth(0.5).stroke();
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
          doc.rect(50, y, doc.page.width - 100, 16).fill(COLOR_BG_SECCION);
          doc.fillColor(COLOR_PRIMARIO).fontSize(10).font('Helvetica-Bold')
             .text(titulo.toUpperCase(), 55, y + 4);
          doc.y = y + 25;
          doc.fillColor(COLOR_TEXTO).fontSize(9).font('Helvetica');
        };

        const campo = async (etiqueta, valor, col = 0, yPos = null) => {
          if (valor === undefined || valor === null || valor === '' || valor === false) return;
          if (typeof valor === 'boolean') valor = 'Sí';
          
          let x = 50;
          if (col === 1) x = 50;
          if (col === 2) x = doc.page.width / 2 + 10;

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
        doc.fillColor(COLOR_TEXTO).fontSize(13).font('Helvetica-Bold')
           .text(subTitulos[type] || "HISTORIA CLÍNICA", { align: 'center' });
        
        const fechaAtencionRaw = getVal(valuation, 'fechaInicioAtencion', 'fecha_inicio_atencion') || getVal(valuation, 'createdAt', 'created_at');
        const fechaAtencion = fmtFecha(fechaAtencionRaw) || fmtFecha(new Date());
        const codCups = getVal(valuation, 'codConsulta', 'cod_consulta');
        
        doc.fillColor(COLOR_TEXTO_CLARO).fontSize(8).font('Helvetica')
           .text(`FECHA DE ATENCIÓN: ${fechaAtencion}   |   CÓDIGO CUPS: ${codCups || 'N/A'}`, { align: 'center' });
        doc.moveDown(1);

        // --- DATOS DEL PACIENTE ---
        await tituloSeccion("Ficha de Identificación del Paciente");

        const nombres = getVal(paciente, 'nombres', 'nombres') || '';
        const apellidos = getVal(paciente, 'apellidos', 'apellidos') || '';
        const nombreCompleto = `${nombres} ${apellidos}`.trim() || 'No especificado';
        
        const tipoDoc = getVal(paciente, 'tipoDocumentoIdentificacion', 'tipo_documento_identificacion');
        const numDoc = getVal(paciente, 'numDocumentoIdentificacion', 'num_documento_identificacion');
        const regCivil = getVal(paciente, 'registroCivil', 'registro_civil');
        const docId = numDoc ? `${tipoDoc || ''} ${numDoc}`.trim() : (regCivil ? `R.C. ${regCivil}` : 'N/A');
        
        const codSexo = getVal(paciente, 'codSexo', 'cod_sexo');
        const sexo = codSexo === 'M' ? 'Masculino' : codSexo === 'F' ? 'Femenino' : codSexo;
        
        const datosContacto = getVal(paciente, 'datosContacto', 'datos_contacto') || {};
        const telefonoPac = datosContacto.telefono || getVal(paciente, 'telefono', 'telefono') || getVal(paciente, 'celular', 'celular') || 'N/A';
        
        const fechaNac = getVal(paciente, 'fechaNacimiento', 'fecha_nacimiento');
        const edad = calcEdad(fechaNac) || 'N/A';

        const direccion = getVal(paciente, 'direccion', 'direccion') || datosContacto.direccion;
        const aseguradora = getVal(paciente, 'aseguradora', 'aseguradora');

        const datosPac = [
          ['Nombre del Paciente', nombreCompleto],
          ['Documento Identidad', docId],
          ['Fecha Nacimiento', fmtFecha(fechaNac)],
          ['Edad Actual', edad],
          ['Sexo Biológico', sexo],
          ['Teléfono de Contacto', telefonoPac],
          ['Dirección Residencia', direccion || 'N/A'],
          ['Entidad Aseguradora', aseguradora || 'Particular'],
        ];

        const esAdulto = getVal(paciente, 'esAdulto', 'es_adulto');
        
        if (!esAdulto) {
          const nombreMadre = getVal(paciente, 'nombreMadre', 'nombre_madre');
          const ocupMadre = getVal(paciente, 'ocupacionMadre', 'ocupacion_madre');
          if (nombreMadre) datosPac.push(['Madre', `${nombreMadre}${ocupMadre ? ` (${ocupMadre})` : ''}`]);
          
          const nombrePadre = getVal(paciente, 'nombrePadre', 'nombre_padre');
          const ocupPadre = getVal(paciente, 'ocupacionPadre', 'ocupacion_padre');
          if (nombrePadre) datosPac.push(['Padre', `${nombrePadre}${ocupPadre ? ` (${ocupPadre})` : ''}`]);
          
          const pediatra = getVal(paciente, 'pediatra', 'pediatra');
          if (pediatra) datosPac.push(['Médico Pediatra', pediatra]);
        } else {
          const ocupacion = getVal(paciente, 'ocupacion', 'ocupacion');
          if (ocupacion) datosPac.push(['Ocupación Actual', ocupacion]);
          
          const semanasGestacion = getVal(paciente, 'semanasGestacion', 'semanas_gestacion');
          if (semanasGestacion) datosPac.push(['Semanas Gestación', semanasGestacion]);
        }

        const startY = doc.y;
        datosPac.forEach((r, i) => {
          campo(r[0], r[1], (i % 2 === 0) ? 1 : 2, startY + Math.floor(i / 2) * 15);
        });
        doc.y = startY + Math.ceil(datosPac.length / 2) * 15 + 10;

        // --- MOTIVO DE CONSULTA ---
        const motivoConsulta = getVal(valuation, 'motivoConsulta', 'motivo_consulta');
        await tituloSeccion("Motivo de Consulta");
        doc.font('Helvetica').fontSize(9).fillColor(COLOR_TEXTO)
           .text(sanitizeText(motivoConsulta), { align: 'justify' });

        // --- CONTENIDO CLÍNICO DINÁMICO ---
        if (type === 'nino') {
          const mp = getVal(valuation, 'moduloPediatria', 'modulo_pediatria') || {};

          if (mp.prenatales && Object.values(mp.prenatales).some(v => v)) {
            await tituloSeccion("Antecedentes Prenatales");
            const p = mp.prenatales;
            await campo("Gestación Planeada", p.gestacionPlaneada || p.gestacion_planeada);
            await campo("Gestación Controlada", p.gestacionControlada || p.gestacion_controlada);
            await campo("Semanas Gestación", p.semanasGestacion || p.semanas_gestacion);
            await campo("No. Controles Prenatales", p.numeroControles || p.numero_controles);
            await campo("Complicaciones", p.complicacionesEmbarazo || p.complicaciones_embarazo || p.complicaciones);
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

            await bloque("Tejido Tegumentario", ex.tejidoTegumentario || ex.tejido_tegumentario);
            await bloque("Tono Muscular", ex.tonoMuscular || ex.tono_muscular);
            await bloque("Control Motor", ex.controlMotor || ex.control_motor);
            await bloque("Desplazamientos", ex.desplazamientos);
            await bloque("Sistema Pulmonar", ex.sistemaPulmonar || ex.sistema_pulmonar);
          }

        } else if (type === 'adulto') {
          const mpp = getVal(valuation, 'moduloPisoPelvico', 'modulo_piso_pelvico') || {};
          const sv  = getVal(valuation, 'signosVitales', 'signos_vitales') || {};

          await tituloSeccion("Signos Vitales y Antropometría");
          const svY1 = doc.y;
          await campo("Frecuencia Cardíaca", sv.fc, 1, svY1);
          await campo("Frec. Respiratoria", sv.fr, 2, svY1);
          const svY2 = svY1 + 15;
          await campo("Presión Arterial", sv.ta, 1, svY2);
          await campo("Temperatura", sv.temperatura, 2, svY2);
          const svY3 = svY2 + 15;
          await campo("Peso Actual", sv.pesoActual || sv.peso_actual, 1, svY3);
          await campo("Talla", sv.talla, 2, svY3);
          const svY4 = svY3 + 15;
          await campo("IMC", sv.imc, 1, svY4);
          doc.y = svY4 + 20;

          if (mpp.obstetrica) {
            await tituloSeccion("Historia Ginecobstétrica");
            const ob = mpp.obstetrica;
            await campo("G / P / A / C", `G${ob.gestaciones||0} P${ob.partos||0} A${ob.abortos||0} C${ob.cesareas||0}`);
            await campo("Fecha Último Parto", ob.fechaUltimoParto || ob.fecha_ultimo_parto);
            await campo("Episiotomía", ob.episiotomia);
            await campo("Desgarro", ob.desgarro);
          }
        } else if (type === 'lactancia') {
            const ml = getVal(valuation, 'moduloLactancia', 'modulo_lactancia') || {};
            await tituloSeccion("Información de Lactancia");
            await campo("Tipo de Lactancia", ml.tipoLactancia || ml.tipo_lactancia);
            await campo("Dificultades Reportadas", ml.dificultades);
            const expPrevia = ml.experienciaPrevia || ml.experiencia_previa || (ml.obstetricos && ml.obstetricos.experienciaLactancia);
            await campo("Experiencia Previa", expPrevia);
        } else if (type === 'perinatal') {
            const mper = getVal(valuation, 'moduloPerinatal', 'modulo_perinatal') || {};
            await tituloSeccion("Datos de la Gestación Actual");
            await campo("Semanas de Gestación", mper.semanasGestacion || mper.semanas_gestacion);
            await campo("Fecha Última Menstruación", mper.fum);
            await campo("Fecha Probable de Parto", mper.fpp);
            await campo("Médico Tratante", mper.medicoTratante || mper.medico_tratante);
        }

        // --- DIAGNOSTICO Y TRATAMIENTO (Común a todos) ---
        await tituloSeccion("Diagnóstico y Plan de Tratamiento");
        const diagnostico = getVal(valuation, 'diagnosticoFisioterapeutico', 'diagnostico_fisioterapeutico');
        await bloque("Diagnóstico Fisioterapéutico", diagnostico);
        
        const plan = getVal(valuation, 'planTratamiento', 'plan_tratamiento');
        await bloque("Plan de Intervención / Tratamiento", plan);

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
        const firmas = getVal(valuation, 'firmas', 'firmas') || {};
        const acudiente = firmas.pacienteOAcudiente || firmas.paciente_o_acudiente || {};
        await pintarFirma(
          acudiente.firmaUrl || acudiente.firma_url || null,
          "Firma del Paciente / Representante",
          acudiente.nombre || nombreCompleto,
          `ID: ${acudiente.cedula || docId}`,
          50, 200
        );

        // Firma Profesional
        doc.y = currentY;
        const profNombre   = getVal(profesional, 'nombre', 'nombre') || config.representante_legal || 'Profesional de Salud';
        const profRegistro = getVal(profesional, 'registroMedico', 'registro_medico') || config.registro_profesional_representante || 'Registro N/A';
        const profFirmaUrl = getVal(profesional, 'firmaUrl', 'firma_url') || null;
        
        await pintarFirma(
          profFirmaUrl,
          "Firma Profesional Tratante",
          profNombre,
          profRegistro,
          doc.page.width / 2 + 10, 200
        );

        // --- PIE DE PÁGINA (Añadido al evento de finalizar todas las páginas) ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill('#F9FAFB');
          
          const fechaGen = new Date().toLocaleString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          
          doc.fillColor(COLOR_TEXTO_CLARO).fontSize(7).font('Helvetica')
             .text(`Generado el: ${fechaGen} | Sistema D'Mamitas | Página ${i + 1} de ${range.count}`, 50, doc.page.height - 25, { align: 'center' });
             
          doc.fontSize(6).fillColor(COLOR_TEXTO_CLARO)
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
