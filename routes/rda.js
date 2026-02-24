const express = require('express');
const router = express.Router();
const fhirMapper = require('../utils/fhirMapper');
const Paciente = require('../models/Paciente');
const ValoracionFisioterapia = require('../models/ValoracionFisioterapia');
const EvolucionSesion = require('../models/EvolucionSesion');


// Middleware de autenticación (Placeholder)
const authenticate = (req, res, next) => {
  next();
};

/**
 * GET /api/rda/patient/:id
 * Genera el Resumen Digital de Atención del Paciente (Historia Clínica Resumida)
 */
router.get('/patient/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const paciente = await Paciente.findById(id);

    if (!paciente) {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    }

    // Buscar la última valoración para obtener antecedentes actualizados
    const ultimaValoracion = await ValoracionFisioterapia.findOne({ paciente: id }).sort({ createdAt: -1 });

    // --- Construcción del Bundle FHIR ---
    const entries = [];

    // 1. Composition (Header)
    const composition = fhirMapper.createComposition(id, "practitioner-default", null, "patient-summary");

    // 2. Patient
    const patientResource = fhirMapper.createPatient(paciente);
    entries.push({ resource: patientResource });

    // 3. Practitioner & Organization (Context)
    const practitionerResource = fhirMapper.createPractitioner();
    const orgResource = fhirMapper.createOrganization();
    entries.push({ resource: practitionerResource });
    entries.push({ resource: orgResource });

    // 4. Clinical Data (From Valuation)
    if (ultimaValoracion) {
      // Alergias
      const alergiasText = ultimaValoracion.antecedentes?.alergias || "Ninguna";
      const allergyRes = fhirMapper.createAllergyIntolerance(alergiasText, id);
      if (allergyRes) {
        entries.push({ resource: allergyRes });
        addToSection(composition, "Alergias", allergyRes.id, "48765-2", "AllergyIntolerance");
      }

      // Medicamentos
      const medsText = ultimaValoracion.antecedentes?.farmacologicos || "Ninguno";
      const medRes = fhirMapper.createMedicationStatement(medsText, id);
      if (medRes) {
        entries.push({ resource: medRes });
        addToSection(composition, "Medicamentos", medRes.id, "10160-0", "MedicationStatement");
      }

      // Problemas / Antecedentes
      const patologicosText = ultimaValoracion.antecedentes?.patologicos || "Sin antecedentes";
      const condRes = fhirMapper.createCondition(patologicosText, id, 'problem-list-item');
      if (condRes) {
        entries.push({ resource: condRes });
        addToSection(composition, "Problemas Activos", condRes.id, "11450-4", "Condition");
      }

      // Antecedentes Familiares (Fallback a _datosLegacy si no está en esquema)
      const famText = ultimaValoracion.familiares || ultimaValoracion._datosLegacy?.familiares || "";
      if (famText) {
        const famRes = fhirMapper.createFamilyMemberHistory(famText, id);
        if (famRes) {
          entries.push({ resource: famRes });
          addToSection(composition, "Antecedentes Familiares", famRes.id, "10157-6", "FamilyMemberHistory");
        }
      }
    }

    entries.unshift({ resource: composition });

    const bundle = fhirMapper.createBundle("document", entries);
    res.json(bundle);

  } catch (error) {
    console.error('Error generando RDA Paciente:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/rda/encounter/:id
 * Genera el RDA de Consulta Externa (Encounter) basado en una valoración específica
 * ID param refers to the VALUATION ID, not patient ID.
 * Query param ?type=adulto or ?type=nino
 */
router.get('/encounter/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const valoracion = await ValoracionFisioterapia.findById(id).populate('paciente');

    if (!valoracion) {
      return res.status(404).json({ success: false, message: 'Valoración no encontrada' });
    }

    const paciente = valoracion.paciente;
    const patientId = paciente._id.toString();

    // --- Construcción del Bundle ---
    const entries = [];

    // 1. Encounter
    const encounterResource = fhirMapper.createEncounter(valoracion, patientId);
    entries.push({ resource: encounterResource });

    // 2. Composition
    const composition = fhirMapper.createComposition(patientId, "practitioner-default", encounterResource.id, "ambulatory-summary");

    // 3. Context Resources
    entries.push({ resource: fhirMapper.createPatient(paciente) }); // Inclusion of patient is mandatory in document Bundle
    entries.push({ resource: fhirMapper.createPractitioner() });
    entries.push({ resource: fhirMapper.createOrganization() });

    // 4. Diagnosis (Condition)
    const diagText = valoracion.diagnosticoFisioterapeutico || valoracion.diagnosticoFisio || "Evaluación Fisioterapéutica";
    const conditionRes = fhirMapper.createCondition(diagText, patientId, 'encounter-diagnosis');
    if (conditionRes) {
      entries.push({ resource: conditionRes });
      addToSection(composition, "Diagnóstico", conditionRes.id, "29548-5", "Condition");
    }

    // 5. Plan
    const planText = valoracion.planTratamiento || valoracion.planIntervencion;
    if (planText) {
      const carePlan = {
        resourceType: "CarePlan",
        id: `plan-${id}`,
        status: "active",
        intent: "plan",
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterResource.id}` },
        description: planText
      };
      entries.push({ resource: carePlan });
      addToSection(composition, "Plan de Tratamiento", carePlan.id, "18776-5", "CarePlan");
    }

    entries.unshift({ resource: composition });

    const bundle = fhirMapper.createBundle("document", entries);
    res.json(bundle);

  } catch (error) {
    console.error('Error generando RDA Encounter:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Helper to add section to Composition
 */
function addToSection(composition, title, resourceId, loincCode, resourceType) {
  composition.section.push({
    title: title,
    code: {
      coding: [{
        system: "http://loinc.org",
        code: loincCode
      }]
    },
    entry: [{ reference: `${resourceType}/${resourceId}` }]
  });
}

module.exports = router;
