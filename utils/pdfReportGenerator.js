const PDFDocument = require('pdfkit');
const axios = require('axios');

class PDFReportGenerator {
  async generateValuationPDF(valuation, paciente, type = 'nino', profesional = {}, config = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          margins: { top: 50, bottom: 30, left: 50, right: 50 }, 
          size: 'A4', 
          bufferPages: true 
        });
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
        
        const fmtFechaCompleta = (d) => {
          if (!d) return null;
          try {
            const date = new Date(d);
            // Formato YYYY-MM-DD HH:mm:ss
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            const ss = String(date.getSeconds()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
          } catch { return String(d); }
        };

        const fechaAtencionRaw = getVal(valuation, 'fechaInicioAtencion', 'fecha_inicio_atencion') || getVal(valuation, 'createdAt', 'created_at');
        const fechaAtencion = fmtFechaCompleta(fechaAtencionRaw) || fmtFechaCompleta(new Date());
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

        const estadoCivil = getVal(paciente, 'estadoCivil', 'estado_civil');
        if (estadoCivil) datosPac.push(['Estado Civil', estadoCivil]);

        const ocupacion = getVal(paciente, 'ocupacion', 'ocupacion');
        if (ocupacion) datosPac.push(['Ocupación Actual', ocupacion]);
        
        const regimen = getVal(paciente, 'regimen', 'regimen');
        if (regimen) datosPac.push(['Régimen', regimen]);

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

        const esValorValido = (v) => {
          if (v === null || v === undefined || v === '') return false;
          if (typeof v === 'string') {
            const s = v.trim();
            if (s === '-' || s === '.') return false;
          }
          return true;
        };

        const formatLabel = (key) => {
          let str = key.replace(/_/g, ' ');
          str = str.replace(/([A-Z])/g, ' $1');
          return str.charAt(0).toUpperCase() + str.slice(1).trim().toLowerCase();
        };

        const imprimirObjetoDinamico = async (obj) => {
          if (!obj) return;
          const entries = Object.entries(obj).filter(([k, v]) => esValorValido(v) && k !== 'id' && k !== 'valoracion_id');
          
          const primitives = [];
          const blocks = [];
          const objects = [];

          for (const [key, value] of entries) {
            let isFlattenable = false;
            let flattenedValue = '';
            
            if (typeof value === 'object' && !Array.isArray(value)) {
              const keys = Object.keys(value);
              const hasSi = keys.includes('si') || keys.includes('SI');
              const hasTiempo = keys.includes('tiempo');
              const hasObs = keys.includes('obs') || keys.includes('observaciones');
              
              if (hasSi || hasTiempo || hasObs) {
                 isFlattenable = true;
                 const siVal = value.si || value.SI;
                 if (esValorValido(siVal)) flattenedValue += siVal;
                 const tiempoVal = value.tiempo;
                 if (esValorValido(tiempoVal)) flattenedValue += (flattenedValue ? ` (${tiempoVal})` : tiempoVal);
                 const obsVal = value.obs || value.observaciones;
                 if (esValorValido(obsVal)) flattenedValue += ` - Obs: ${obsVal}`;
              }
            }

            if (isFlattenable) {
               primitives.push([formatLabel(key), flattenedValue.trim()]);
            } else if (typeof value === 'object' && !Array.isArray(value)) {
               if (Object.values(value).some(v => esValorValido(v))) {
                 objects.push([key, value]);
               }
            } else {
              const strVal = String(value);
              if (strVal.length > 60 || strVal.includes('\n')) {
                blocks.push([formatLabel(key), strVal]);
              } else {
                primitives.push([formatLabel(key), strVal]);
              }
            }
          }

          let primY = doc.y;
          let leftY = doc.y;
          for (let i = 0; i < primitives.length; i++) {
             if (i % 2 === 0) {
                await checkSpace(25);
                primY = doc.y;
                await campo(primitives[i][0], primitives[i][1], 1, primY);
                leftY = doc.y;
             } else {
                await campo(primitives[i][0], primitives[i][1], 2, primY);
                let rightY = doc.y;
                doc.y = Math.max(leftY, rightY) + 5;
             }
          }
          if (primitives.length > 0 && primitives.length % 2 !== 0) {
             doc.y = leftY + 5;
          }

          for (const b of blocks) {
             await bloque(b[0], b[1]);
          }

          for (const o of objects) {
             await tituloSeccion(formatLabel(o[0]));
             await imprimirObjetoDinamico(o[1]);
          }
        };

        // --- CONTENIDO CLÍNICO DINÁMICO ---
        const modulosPorTipo = {
          nino: ['moduloPediatria', 'modulo_pediatria'],
          adulto: ['signosVitales', 'signos_vitales', 'moduloPisoPelvico', 'modulo_piso_pelvico'],
          lactancia: ['moduloLactancia', 'modulo_lactancia'],
          perinatal: ['signosVitales', 'signos_vitales', 'moduloPerinatal', 'modulo_perinatal']
        };
        const modulos = modulosPorTipo[type] || [];
        const modulosImpresos = new Set();
        
        for (const modName of modulos) {
          const baseName = modName.replace(/_/g, '').toLowerCase();
          if (modulosImpresos.has(baseName)) continue;

          if (valuation[modName] && Object.values(valuation[modName]).some(v => esValorValido(v))) {
            await tituloSeccion(formatLabel(modName));
            await imprimirObjetoDinamico(valuation[modName]);
            modulosImpresos.add(baseName);
          }
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
        
        // Desactivamos el salto de página automático temporalmente
        const prevBottomMargin = doc.page.margins.bottom;
        
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.page.margins.bottom = 0; // Prevenir salto de página
          
          doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill('#F9FAFB');
          
          const fechaGen = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          
          doc.fillColor(COLOR_TEXTO_CLARO).fontSize(7).font('Helvetica')
             .text(`Generado el: ${fechaGen} | Sistema D'Mamitas | Página ${i + 1} de ${range.count}`, 50, doc.page.height - 25, { align: 'center', lineBreak: false });
             
          doc.fontSize(6).fillColor(COLOR_TEXTO_CLARO)
             .text('Validez legal conforme a la Ley 527 de 1999 de la República de Colombia. Documento Confidencial.', 50, doc.page.height - 15, { align: 'center', lineBreak: false });
             
          doc.page.margins.bottom = prevBottomMargin;
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new PDFReportGenerator();
