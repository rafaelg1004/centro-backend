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
        const dibujarTablaDosColumnas = async (titulo, campos) => {
          if (!campos || campos.length === 0) return;
          const tableWidth = doc.page.width - 100;
          const colWidth = tableWidth / 2;

          // Solo exigir espacio inicial para el encabezado y al menos 1 fila (36px)
          await checkSpace(36);

          let currentY = doc.y;

          const renderHeader = (esContinuacion = false) => {
            doc.rect(50, currentY, tableWidth, 16).fill('#F3F4F6');
            doc.fillColor('#1F2937').fontSize(9).font('Helvetica-Bold')
              .text(`${titulo.toUpperCase()}${esContinuacion ? ' (CONT.)' : ''}`, 55, currentY + 4);
            currentY += 16;
            doc.lineWidth(0.5).strokeColor('#D1D5DB');
            doc.moveTo(50, currentY).lineTo(50 + tableWidth, currentY).stroke();
          };

          renderHeader(false);

          for (let i = 0; i < campos.length; i += 2) {
            // Si la siguiente fila excede el límite de la página, saltar de página y continuar la tabla
            if (currentY + 16 > doc.page.height - 70) {
              doc.addPage();
              await addPageHeader(doc, false);
              currentY = doc.y;
              renderHeader(true);
            }

            const rowY = currentY;
            const c1 = campos[i];
            const c2 = campos[i + 1];

            // Bordes verticales de la fila
            doc.lineWidth(0.5).strokeColor('#D1D5DB');
            doc.moveTo(50, rowY).lineTo(50, rowY + 16).stroke();
            doc.moveTo(50 + colWidth, rowY).lineTo(50 + colWidth, rowY + 16).stroke();
            doc.moveTo(50 + tableWidth, rowY).lineTo(50 + tableWidth, rowY + 16).stroke();

            if (c1) {
              doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151').text(`${c1[0]}: `, 54, rowY + 4, { continued: true })
                .font('Helvetica').fillColor('#4B5563').text(String(c1[1]));
            }
            if (c2) {
              doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151').text(`${c2[0]}: `, 54 + colWidth, rowY + 4, { continued: true })
                .font('Helvetica').fillColor('#4B5563').text(String(c2[1]));
            }

            currentY += 16;
            doc.moveTo(50, currentY).lineTo(50 + tableWidth, currentY).stroke();
          }
          doc.y = currentY + 10;
        };

        const dibujarTablaUnaColumna = async (titulo, texto) => {
          if (!texto) return;
          const tableWidth = doc.page.width - 100;
          doc.font('Helvetica').fontSize(8);
          const textHeight = doc.heightOfString(String(texto), { width: tableWidth - 10, align: 'justify' });
          const totalHeight = 16 + textHeight + 12;

          const spaceAvailable = doc.page.height - 70 - doc.y;
          if (spaceAvailable < 40 || (totalHeight > spaceAvailable && spaceAvailable < 80)) {
            await checkSpace(spaceAvailable + 1);
          }

          const startY = doc.y;
          // Header
          doc.rect(50, startY, tableWidth, 16).fill('#F3F4F6');
          doc.fillColor('#1F2937').fontSize(9).font('Helvetica-Bold').text(titulo.toUpperCase(), 55, startY + 4);

          let currentY = startY + 16;
          doc.lineWidth(0.5).strokeColor('#D1D5DB');
          doc.moveTo(50, currentY).lineTo(50 + tableWidth, currentY).stroke();

          const initialY = currentY;
          doc.font('Helvetica').fontSize(8).fillColor('#4B5563')
            .text(String(texto), 55, currentY + 4, { width: tableWidth - 10, align: 'justify' });

          const finalY = doc.y + 4;
          doc.moveTo(50, initialY).lineTo(50, finalY).stroke();
          doc.moveTo(50 + tableWidth, initialY).lineTo(50 + tableWidth, finalY).stroke();
          doc.moveTo(50, finalY).lineTo(50 + tableWidth, finalY).stroke();

          doc.y = finalY + 10;
        };

        const addPageHeader = async (doc, isFirstPage = false) => {
          if (!isFirstPage) {
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
          nino: "VALORACIÓN DE INGRESO PEDIÁTRICA",
          adulto: "VALORACIÓN PISO PÉLVICO POSTPARTO",
          lactancia: "VALORACIÓN Y ASESORÍA DE LACTANCIA",
          perinatal: "VALORACIÓN PROGRAMA PERINATAL"
        };
        doc.fillColor(COLOR_TEXTO).fontSize(13).font('Helvetica-Bold')
          .text(subTitulos[type] || "HISTORIA CLÍNICA", { align: 'center' });

        const fmtFechaCompleta = (d) => {
          if (!d) return null;
          try {
            const date = new Date(d);
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

        let cupsDesc = '';
        if (codCups) {
          const CUPS_FALLBACK = {
            '890201': 'CONSULTA DE PRIMERA VEZ POR FISIOTERAPIA',
            '890211': 'CONSULTA DE PRIMERA VEZ POR FISIOTERAPIA',
            '890211': 'CONSULTA DE PRIMERA VEZ POR ESPECIALISTA EN MEDICINA FISICA Y REHABILITACION',
            '890384': 'CONSULTA DE CONTROL O DE SEGUIMIENTO POR FISIOTERAPIA',
            '890202': 'VALORACIÓN DE PISO PÉLVICO - PRIMERA VEZ',
            '890203': 'VALORACIÓN DE LACTANCIA - PRIMERA VEZ',
          };
          cupsDesc = CUPS_FALLBACK[codCups] || '';
          if (!cupsDesc) {
            try {
              const { CodigoCUPS, CupsCatalogo } = require('../models-sequelize');
              const cupsInfo = await CodigoCUPS.findOne({ where: { codigo: codCups } });
              if (cupsInfo && cupsInfo.nombre) {
                cupsDesc = cupsInfo.nombre;
              } else {
                const cupsCat = await CupsCatalogo.findOne({ where: { codigo_cups: codCups } });
                if (cupsCat && cupsCat.descripcion) {
                  cupsDesc = cupsCat.descripcion;
                }
              }
            } catch (e) {
              console.error("Error fetching CUPS description:", e.message);
            }
          }
        }

        const cupsLabel = cupsDesc ? `${codCups} - ${cupsDesc}` : (codCups || 'N/A');

        doc.fillColor(COLOR_TEXTO_CLARO).fontSize(8.5).font('Helvetica')
          .text(`FECHA DE ATENCIÓN: ${fechaAtencion}   |   CÓDIGO CUPS: ${cupsLabel}`, { align: 'center' });
        doc.moveDown(1.5);

        // --- DATOS DEL PRESTADOR ---
        const nitPrestador = config.nit || "901XXXXXX-X";
        const profPrestador = getVal(profesional, 'nombre', 'nombre');
        const nombrePrestador = profPrestador || config.nombre_clinica || "D'Mamitas & Babies";
        const telPrestador = config.telefono || "+57 317 2774885";
        const codHabPrestador = config.codigo_habilitacion || "1500100XXXX-X";
        const dirPrestador = config.direccion || "Cra 1 W 28-47, Tunja";
        const emailPrestador = config.email || "contacto@dmamitas.com";

        const datosPrestador = [
          ['NIT', nitPrestador],
          ['Información del Prestador', nombrePrestador],
          ['Teléfono', telPrestador],
          ['Código Hab.', codHabPrestador],
          ['Dirección de la Sede', dirPrestador],
          ['Email', emailPrestador]
        ];

        await dibujarTablaDosColumnas("DATOS DEL PRESTADOR", datosPrestador);

        // --- DATOS DEL PACIENTE ---
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
          ['Teléfono', telefonoPac],
          ['Dirección', direccion || 'N/A'],
          ['Aseguradora', aseguradora || 'Particular'],
        ];

        const estadoCivil = getVal(paciente, 'estadoCivil', 'estado_civil');
        if (estadoCivil) datosPac.push(['Estado Civil', estadoCivil]);

        const ocupacion = getVal(paciente, 'ocupacion', 'ocupacion');
        if (ocupacion) datosPac.push(['Ocupación', ocupacion]);

        const regimen = getVal(paciente, 'regimen', 'regimen');
        if (regimen) datosPac.push(['Régimen', regimen]);

        // Draw patient table
        await dibujarTablaDosColumnas("DATOS DEL PACIENTE", datosPac);

        // --- MOTIVO DE CONSULTA ---
        const motivoConsulta = getVal(valuation, 'motivoConsulta', 'motivo_consulta');
        if (motivoConsulta) {
          await dibujarTablaUnaColumna("Motivo de Consulta", sanitizeText(motivoConsulta));
        }

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

        const imprimirObjetoDinamico = async (obj, sectionTitle = '') => {
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

          if (primitives.length > 0) {
            await dibujarTablaDosColumnas(sectionTitle || "Detalles", primitives);
          }

          for (const b of blocks) {
            await dibujarTablaUnaColumna(b[0], b[1]);
          }

          for (const o of objects) {
            await imprimirObjetoDinamico(o[1], formatLabel(o[0]));
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
            await imprimirObjetoDinamico(valuation[modName], formatLabel(modName));
            modulosImpresos.add(baseName);
          }
        }

        // --- DIAGNOSTICO Y TRATAMIENTO (Común a todos) ---
        const diagnostico = getVal(valuation, 'diagnosticoFisioterapeutico', 'diagnostico_fisioterapeutico');
        if (diagnostico) {
          await dibujarTablaUnaColumna("Diagnóstico Fisioterapéutico", diagnostico);
        }

        const plan = getVal(valuation, 'planTratamiento', 'plan_tratamiento');
        if (plan) {
          await dibujarTablaUnaColumna("Plan de Intervención / Tratamiento", plan);
        }

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

        // Firma Profesional
        await checkSpace(50); // Asegurar que hay espacio para la firma
        const profNombre = getVal(profesional, 'nombre', 'nombre') || config.representante_legal || 'Profesional de Salud';
        const profRegistro = getVal(profesional, 'registroMedico', 'registro_medico') || config.registro_profesional_representante || 'Registro N/A';
        const profFirmaUrl = getVal(profesional, 'firmaUrl', 'firma_url') || null;

        await pintarFirma(
          profFirmaUrl,
          "Firma Profesional Tratante",
          profNombre,
          profRegistro,
          50, 200
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
