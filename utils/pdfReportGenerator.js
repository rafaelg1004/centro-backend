const PDFDocument = require('pdfkit');
const axios = require('axios');

class PDFReportGenerator {
  async generateValuationPDF(valuation, paciente, type = 'nino', profesional = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const COLOR_TITULO = '#4338ca';
        const COLOR_HEADER = '#1e1b4b';
        const COLOR_TEXTO  = '#374151';

        // ── Helpers ──────────────────────────────────────────────────
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
          try { return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }); }
          catch { return String(d); }
        };

        // Muestra sección con fondo
        const seccion = (titulo) => {
          doc.moveDown(0.4);
          if (doc.y > 715) doc.addPage();
          const y = doc.y;
          doc.rect(50, y, 500, 15).fill('#eef2ff');
          doc.fillColor(COLOR_TITULO).fontSize(8.5).font('Helvetica-Bold')
             .text(titulo.toUpperCase(), 55, y + 4);
          doc.y = y + 19;
          doc.fillColor(COLOR_TEXTO).fontSize(9).font('Helvetica');
        };

        // Imprime campo solo si tiene valor
        const campo = (etiqueta, valor) => {
          if (valor === undefined || valor === null || valor === '' || valor === false) return;
          if (typeof valor === 'boolean') valor = 'Sí';
          doc.font('Helvetica-Bold').text(`${etiqueta}: `, { continued: true })
             .font('Helvetica').text(String(valor));
        };

        // Bloque de texto multilinea
        const bloque = (etiqueta, valor) => {
          if (!valor) return;
          doc.font('Helvetica-Bold').text(`${etiqueta}:`);
          doc.font('Helvetica').text(String(valor), { align: 'justify' });
          doc.moveDown(0.2);
        };

        // ── CABECERA ──────────────────────────────────────────────────
        doc.fillColor(COLOR_HEADER).fontSize(15).font('Helvetica-Bold')
           .text("D'Mamitas & Babies", { align: 'center' });
        doc.fontSize(8.5).font('Helvetica').fillColor(COLOR_TEXTO)
           .text("Centro de Estimulación, Fisioterapia y Programas Perinatales", { align: 'center' });
        doc.moveDown(0.2);
        doc.fillColor(COLOR_TITULO).fontSize(12).font('Helvetica-Bold')
           .text("HISTORIA CLÍNICA", { align: 'center' });

        const subTitulos = {
          nino:      "Valoración de Ingreso Pediátrica",
          adulto:    "Valoración Piso Pélvico",
          lactancia: "Valoración y Asesoría de Lactancia",
          perinatal: "Programa Perinatal"
        };
        doc.fontSize(10).font('Helvetica').fillColor(COLOR_TEXTO)
           .text(subTitulos[type] || "Reporte Clínico", { align: 'center' });
        doc.moveDown(0.2);
        const fechaAtencion = fmtFecha(valuation.fechaInicioAtencion) || fmtFecha(new Date());
        doc.fontSize(8).text(`Fecha de atención: ${fechaAtencion}  |  Código CUPS: ${valuation.codConsulta || ''}  |  CIE-10: ${valuation.codDiagnosticoPrincipal || ''}`, { align: 'right' });
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor(COLOR_TITULO).lineWidth(1).stroke();
        doc.moveDown(0.3);

        // ── DATOS DEL PACIENTE ────────────────────────────────────────
        seccion("Datos del Paciente");

        const nombreCompleto = [paciente.nombres, paciente.apellidos].filter(Boolean).join(' ') || 'No especificado';
        const docId = paciente.numDocumentoIdentificacion
          ? `${paciente.tipoDocumentoIdentificacion || ''} ${paciente.numDocumentoIdentificacion}`.trim()
          : (paciente.registroCivil ? `R.C. ${paciente.registroCivil}` : null);
        const sexo = paciente.codSexo === 'M' ? 'Masculino' : paciente.codSexo === 'F' ? 'Femenino' : paciente.codSexo;
        const telefono = paciente.datosContacto?.telefono || paciente.telefono || paciente.celular;
        const edad = calcEdad(paciente.fechaNacimiento);

        // 2 columnas para datos del paciente
        const fila = (lbl, val, x, y) => {
          if (!val) return;
          doc.font('Helvetica-Bold').fontSize(9).text(`${lbl}: `, x, y, { continued: true })
             .font('Helvetica').text(String(val));
        };

        const datosPac = [
          ['Nombre', nombreCompleto],
          ['Documento', docId],
          ['F. Nacimiento', fmtFecha(paciente.fechaNacimiento)],
          ['Edad', edad],
          ['Sexo', sexo],
          ['Teléfono', telefono],
          ['Dirección', paciente.direccion],
          ['Aseguradora', paciente.aseguradora || 'Particular'],
        ].filter(r => r[1]);

        if (!paciente.esAdulto) {
          if (paciente.nombreMadre) datosPac.push(['Madre', `${paciente.nombreMadre}${paciente.ocupacionMadre ? ` (${paciente.ocupacionMadre})` : ''}`]);
          if (paciente.nombrePadre) datosPac.push(['Padre', `${paciente.nombrePadre}${paciente.ocupacionPadre ? ` (${paciente.ocupacionPadre})` : ''}`]);
          if (paciente.pediatra)    datosPac.push(['Pediatra', paciente.pediatra]);
        } else {
          if (paciente.ocupacion)        datosPac.push(['Ocupación', paciente.ocupacion]);
          if (paciente.semanasGestacion) datosPac.push(['Sem. Gestación', paciente.semanasGestacion]);
        }

        const startY = doc.y;
        datosPac.forEach((r, i) => {
          fila(r[0], r[1], i % 2 === 0 ? 55 : 300, startY + Math.floor(i / 2) * 13);
        });
        doc.y = startY + Math.ceil(datosPac.length / 2) * 13 + 6;

        // ── MOTIVO DE CONSULTA ────────────────────────────────────────
        seccion("Motivo de Consulta");
        doc.font('Helvetica').fontSize(9)
           .text(valuation.motivoConsulta || 'No especificado', { align: 'justify' });

        // ── CONTENIDO CLÍNICO POR TIPO ────────────────────────────────
        if (type === 'nino') {
          const mp = valuation.moduloPediatria || {};

          if (mp.prenatales && Object.values(mp.prenatales).some(v => v)) {
            seccion("Antecedentes Prenatales");
            const p = mp.prenatales;
            if (p.gestacionPlaneada)  campo("Gestación Planeada", "Sí");
            if (p.gestacionControlada) campo("Gestación Controlada", "Sí");
            campo("Semanas Gestación", p.semanasGestacion);
            campo("No. Controles Prenatales", p.numeroControles);
            campo("Complicaciones", p.complicacionesEmbarazo || p.complicaciones);
            campo("Medicamentos", p.medicamentos);
            campo("Enfermedades Durante Gestación", p.enfermedades);
          }

          if (mp.perinatales && Object.values(mp.perinatales).some(v => v)) {
            seccion("Antecedentes Perinatales");
            const p = mp.perinatales;
            campo("Tipo de Parto", p.tipoParto);
            campo("Peso al Nacer", p.pesoAlNacer);
            campo("Talla al Nacer", p.tallaAlNacer);
            campo("APGAR", p.apgar);
            campo("Semanas de Gestación al Nacer", p.semanasGestacion);
            campo("Complicaciones Neonatales", p.complicaciones);
            campo("Médico Tratante", p.medicoTratante);
            campo("Atendida Oportunamente", p.atendidaOportunamente);
          }

          if (mp.recienNacido && Object.values(mp.recienNacido).some(v => v)) {
            seccion("Recién Nacido");
            const r = mp.recienNacido;
            campo("Alimentación", r.alimentacion);
            campo("Lactancia Materna", r.lactanciaMaterna);
            campo("Tiempo Lactancia", r.tiempoLactancia);
            campo("Sueño", r.sueno);
            campo("Posición de Sueño", r.posicionSueno);
            campo("Cólicos", r.colicos);
            campo("Uso de Cargador", r.usoCargador);
            campo("Uso de Caminador", r.usoCaminador);
          }

          if (mp.desarrolloSocial && Object.values(mp.desarrolloSocial).some(v => v)) {
            seccion("Desarrollo Social");
            const ds = mp.desarrolloSocial;
            campo("Sonrisa Social", ds.sonrisaSocial);
            campo("Seguimiento Visual", ds.seguimientoVisual);
            campo("Orientación Auditiva", ds.orientacionAuditiva);
            campo("Reconoce Personas", ds.reconocePersonas);
            campo("Juego", ds.juego);
          }

          if (mp.examen && Object.values(mp.examen).some(v => v)) {
            seccion("Examen Físico");
            const ex = mp.examen;
            campo("Frecuencia Cardíaca", ex.fc);
            campo("Frecuencia Respiratoria", ex.fr);
            campo("Temperatura", ex.temperatura);
            bloque("Tejido Tegumentario", ex.tejidoTegumentario);
            bloque("Tono Muscular", ex.tonoMuscular);
            bloque("Control Motor", ex.controlMotor);
            bloque("Desplazamientos", ex.desplazamientos);
            bloque("Reflejos Osteotendinosos", ex.reflejos);
            campo("Reflejos Anormales", ex.anormales);
            campo("Reflejos Patológicos", ex.patologicos);
            bloque("Sensibilidad", ex.sensibilidad);
            bloque("Perfil Sensorial", ex.perfilSensorial);
            bloque("Deformidades / Contracturas", ex.deformidades);
            bloque("Sistema Pulmonar", ex.sistemaPulmonar);
            bloque("Problemas Asociados", ex.problemasAsociados);
          }

          const hitos = mp.hitos || {};
          if (Object.keys(hitos).length > 0) {
            seccion("Hitos del Desarrollo Motor");
            ['controlCefalico', 'rodamiento', 'sedestacion', 'gateo', 'bipedestacion', 'marcha'].forEach(h => {
              if (hitos[h]?.edad) campo(h.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), hitos[h].edad + (hitos[h].obs ? ` — ${hitos[h].obs}` : ''));
            });
          }

          if (mp.motricidadFina && Object.values(mp.motricidadFina).some(v => v)) {
            seccion("Motricidad Fina");
            const mf = mp.motricidadFina;
            campo("Prensión Palmar", mf.presionPalmar);
            campo("Pinza Superior", mf.pinzaSuperior);
            campo("Encaja Piezas", mf.encajaPiezas);
            campo("Garabatea", mf.garabatea);
          }

          if (mp.lenguaje && Object.values(mp.lenguaje).some(v => v)) {
            seccion("Lenguaje");
            const l = mp.lenguaje;
            campo("Balbucea", l.balbucea);
            campo("Dice Mamá/Papá", l.diceMamaPapa);
            campo("Señala lo que Quiere", l.senalaQueQuiere);
            campo("Entiende Órdenes", l.entiendeOrdenes);
            campo("Usa Frases", l.usaFrases);
          }

          if (mp.socioemocional && Object.values(mp.socioemocional).some(v => v)) {
            seccion("Área Socioemocional");
            const s = mp.socioemocional;
            campo("Sonríe Socialmente", s.sonrieSocialmente);
            campo("Responde al Nombre", s.respondeNombre);
            campo("Interés por Otros Niños", s.interesaOtrosNinos);
            campo("Juego Simbólico", s.juegoSimbolico);
            campo("Se Despide", s.seDespide);
          }

          if (mp.emocionesExpresadas?.length || mp.relacionEntorno) {
            seccion("Observación de la Sesión");
            if (mp.emocionesExpresadas?.length) campo("Emociones Expresadas", mp.emocionesExpresadas.join(', '));
            campo("Relación con el Entorno", mp.relacionEntorno);
          }

          seccion("Diagnóstico y Plan de Tratamiento");
          bloque("Diagnóstico Fisioterapéutico", valuation.diagnosticoFisioterapeutico);
          bloque("Plan de Tratamiento", valuation.planTratamiento);

        } else if (type === 'adulto') {
          const mpp = valuation.moduloPisoPelvico || {};
          const sv  = valuation.signosVitales || {};

          seccion("Signos Vitales y Antropometría");
          campo("Frecuencia Cardíaca", sv.fc);
          campo("Frecuencia Respiratoria", sv.fr);
          campo("Temperatura", sv.temperatura);
          campo("Presión Arterial", sv.ta);
          campo("Peso Previo", sv.pesoPrevio);
          campo("Peso Actual", sv.pesoActual);
          campo("Talla", sv.talla);
          campo("IMC", sv.imc);

          if (mpp.obstetrica) {
            seccion("Historia Ginecobstétrica");
            const ob = mpp.obstetrica;
            campo("G / P / A / C", `G${ob.gestaciones||0} P${ob.partos||0} A${ob.abortos||0} C${ob.cesareas||0}`);
            campo("Último Parto / Fecha", ob.fechaUltimoParto);
            campo("Episiotomía", ob.episiotomia);
            campo("Desgarro", ob.desgarro);
          }

          bloque("Diagnóstico Fisioterapéutico", valuation.diagnosticoFisioterapeutico);
          bloque("Plan de Tratamiento", valuation.planTratamiento);

        } else if (type === 'lactancia') {
          const ml = valuation.moduloLactancia || {};

          seccion("Información de Lactancia");
          campo("Tipo de Lactancia", ml.tipoLactancia);
          campo("Semanas Gestación del Bebé", ml.bebe?.semanasGestacion || ml.semanasGestacionBebe);
          campo("Peso Bebé al Nacer", ml.bebe?.pesoNacer);
          campo("Peso Bebé Actual", ml.bebe?.pesoActual);
          campo("Tipo de Parto", ml.bebe?.tipoParto);
          campo("Dificultades", ml.dificultades);
          campo("Experiencia Previa de Lactancia", ml.experienciaPrevia || ml.obstetricos?.experienciaLactancia);

          bloque("Diagnóstico Fisioterapéutico", valuation.diagnosticoFisioterapeutico);
          bloque("Plan de Tratamiento", valuation.planTratamiento);

        } else if (type === 'perinatal') {
          const mper = valuation.moduloPerinatal || {};
          const sv   = valuation.signosVitales || {};

          seccion("Datos de la Gestación Actual");
          campo("Semanas de Gestación", mper.semanasGestacion);
          campo("Fecha Última Menstruación (FUM)", mper.fum);
          campo("Fecha Probable de Parto (FPP)", mper.fpp);
          campo("Plan Elegido", mper.planElegido);
          campo("Número de Gestación", mper.numeroGestacion);
          campo("Médico Tratante", mper.medicoTratante);

          seccion("Signos Vitales");
          campo("Presión Arterial", sv.ta);
          campo("Frecuencia Cardíaca", sv.fc);
          campo("Frecuencia Respiratoria", sv.fr);
          campo("Temperatura", sv.temperatura);
          campo("Peso Previo", mper.pesoPrevio || sv.pesoPrevio);
          campo("Peso Actual", sv.pesoActual);
          campo("Talla", sv.talla);
          campo("IMC", sv.imc);

          bloque("Diagnóstico Fisioterapéutico", valuation.diagnosticoFisioterapeutico);
          bloque("Plan de Tratamiento", valuation.planTratamiento);
        }

        // ── FIRMAS ────────────────────────────────────────────────────
        doc.addPage();

        const profNombre   = profesional.nombre        || 'Ft. Dayan Ivonne Villegas Gamboa';
        const profRegistro = profesional.registroMedico || '52862625 - Reg. Salud Departamental';
        const profFirmaUrl = profesional.firmaUrl || null;

        const pintarFirma = async (imageSource, etiqueta, nombre, identificacion) => {
          doc.moveDown(0.5);
          if (doc.y > 700) doc.addPage();
          doc.font('Helvetica-Bold').fontSize(9).text(etiqueta);
          if (nombre) doc.font('Helvetica').fontSize(8.5).text(`Nombre: ${nombre}`);
          if (identificacion) doc.text(`Identificación: ${identificacion}`);

          if (!imageSource) {
            // Recuadro vacío para firma manual
            doc.rect(55, doc.y + 4, 160, 55).stroke();
            doc.y += 64;
          } else {
            try {
              let buffer;
              if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
                const resp = await axios.get(imageSource, { responseType: 'arraybuffer' });
                buffer = Buffer.from(resp.data, 'binary');
              } else if (typeof imageSource === 'string' && imageSource.startsWith('data:image')) {
                buffer = Buffer.from(imageSource.replace(/^data:image\/\w+;base64,/, ''), 'base64');
              }
              if (buffer) doc.image(buffer, 55, doc.y + 4, { fit: [160, 55] });
              doc.y += 64;
            } catch {
              doc.rect(55, doc.y + 4, 160, 55).stroke();
              doc.y += 64;
            }
          }
          doc.moveDown(0.2);
        };

        seccion("Firmas");

        const acudiente = valuation.firmas?.pacienteOAcudiente || {};
        await pintarFirma(
          acudiente.firmaUrl || null,
          "Firma del Paciente / Acudiente / Representante Legal",
          acudiente.nombre,
          acudiente.cedula
        );

        await pintarFirma(
          profFirmaUrl,
          "Firma del Profesional - Fisioterapeuta",
          profNombre,
          profRegistro
        );

        // ── PIE DE PÁGINA LEGAL ───────────────────────────────────────
        doc.moveDown(1.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
        doc.moveDown(0.4);
        const ahora = new Date();
        const fechaGen = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
        const horaGen  = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        doc.fillColor('#888').fontSize(7)
           .text(
             `Documento generado el ${fechaGen} a las ${horaGen}. Firmado electrónicamente mediante acceso seguro por ${profNombre}.`,
             { align: 'center' }
           )
           .text('Validez legal conforme a la Ley 527 de 1999 de la República de Colombia.', { align: 'center' });

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new PDFReportGenerator();
