const { v4: uuidv4 } = require('uuid');
const ripsConfig = require('../ripsConfig');

class FHIRMapper {
  constructor() {
    this.provider = ripsConfig.prestador;
  }

  /**
   * Generates a FHIR Bundle (Document) structure
   */
  createBundle(type, entries) {
    return {
      resourceType: "Bundle",
      id: uuidv4(),
      meta: {
        lastUpdated: new Date().toISOString()
      },
      identifier: {
        system: "http://minsalud.gov.co/fhir/RDA/bundle-identifier",
        value: uuidv4()
      },
      type: "document",
      timestamp: new Date().toISOString(),
      entry: entries
    };
  }

  /**
   * Creates a Composition resource (The Header of the RDA)
   */
  createComposition(patientId, practitionerId, encounterId, type = "patient-summary") {
    const title = type === "patient-summary" ? "Resumen Digital de Atención - Paciente" : "Resumen Digital de Atención - Consulta Externa";
    // Code system for Loinc (Example)
    const typeCode = type === "patient-summary" ? "60591-5" : "34133-9"; 
    
    return {
      resourceType: "Composition",
      id: uuidv4(),
      status: "final",
      type: {
        coding: [{
          system: "http://loinc.org",
          code: typeCode,
          display: title
        }]
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      date: new Date().toISOString(),
      author: [{
        reference: `Practitioner/${practitionerId}`
      }],
      title: title,
      encounter: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
      section: [] // Will be populated by the route logic
    };
  }

  /**
   * Creates a FHIR Patient resource
   */
  createPatient(pacienteData) {
    const p = pacienteData;
    const documentType = p.tipoDocumento || (p.cedula ? 'CC' : 'TI'); // Fallback logic
    const names = p.nombres ? p.nombres.split(' ') : ['Sin', 'Nombre'];
    
    return {
      resourceType: "Patient",
      id: p._id.toString(),
      identifier: [{
        use: "official",
        type: {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: documentType,
          }]
        },
        system: "http://minsalud.gov.co/fhir/identificacion", // Example system
        value: p.numeroDocumento || p.registroCivil || p.cedula
      }],
      name: [{
        use: "official",
        family: names.length > 1 ? names.slice(1).join(' ') : names[0],
        given: [names[0]]
      }],
      telecom: [
        {
          system: "phone",
          value: p.celular || p.telefono,
          use: "mobile"
        }
      ],
      gender: this.mapGender(p.genero),
      birthDate: p.fechaNacimiento ? p.fechaNacimiento.split('T')[0] : undefined,
      address: [{
        line: [p.direccion],
        city: p.codMunicipioResidencia || "Montería", // Fallback to name if code logic is complex
        district: p.codZonaTerritorialResidencia === '01' ? 'Urbana' : 'Rural',
        country: "CO"
      }]
    };
  }

  /**
   * Creates a Practitioner resource from Config
   */
  createPractitioner() {
    return {
      resourceType: "Practitioner",
      id: "practitioner-default",
      identifier: [{
        system: "http://minsalud.gov.co/reps",
        value: this.provider.nit // Typically CC for independent
      }],
      name: [{
        text: this.provider.nombre
      }]
    };
  }

  /**
   * Creates an Organization resource from Config
   */
  createOrganization() {
    return {
      resourceType: "Organization",
      id: "organization-default",
      identifier: [{
        system: "http://minsalud.gov.co/reps",
        value: this.provider.codPrestador
      }],
      name: this.provider.nombre,
      type: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/organization-type",
          code: "prov",
          display: "Healthcare Provider"
        }]
      }]
    };
  }

  /**
   * Creates an Encounter resource from a Valuation
   */
  createEncounter(valoracion, patientId) {
    const fecha = valoracion.fecha ? new Date(valoracion.fecha).toISOString() : new Date().toISOString();
    const motivo = valoracion.motivoConsulta || valoracion.motivoDeConsulta || "Consulta de Fisioterapia";

    return {
      resourceType: "Encounter",
      id: valoracion._id.toString(),
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
        display: "ambulatory"
      },
      subject: { reference: `Patient/${patientId}` },
      period: {
        start: fecha,
        end: fecha // Assuming same day for verification
      },
      reasonCode: [{
        text: motivo
      }],
      serviceProvider: { reference: "Organization/organization-default" }
    };
  }

  /**
   * Maps Conditions (Antecedentes/Diagnósticos)
   * category: 'problem-list-item' or 'encounter-diagnosis'
   */
  createCondition(text, patientId, category = 'problem-list-item') {
    if (!text || text === 'No' || text === 'Niega') return null;

    return {
      resourceType: "Condition",
      id: uuidv4(),
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active"
        }]
      },
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-category",
          code: category
        }]
      }],
      code: {
        text: text
      },
      subject: { reference: `Patient/${patientId}` }
    };
  }

  /**
   * Maps Allergies (Alergias/Toxicos)
   */
  createAllergyIntolerance(text, patientId) {
    if (!text || text === 'No' || text === 'Niega') return null;

    return {
      resourceType: "AllergyIntolerance",
      id: uuidv4(),
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: "active"
        }]
      },
      code: {
        text: text
      },
      patient: { reference: `Patient/${patientId}` }
    };
  }

  /**
   * Maps MedicationStatement (Medicamentos)
   */
  createMedicationStatement(text, patientId) {
    if (!text || text === 'No' || text === 'Niega') return null;

    return {
      resourceType: "MedicationStatement",
      id: uuidv4(),
      status: "active",
      medicationCodeableConcept: {
        text: text
      },
      subject: { reference: `Patient/${patientId}` }
    };
  }

  /**
   * Maps FamilyMemberHistory (Antecedentes Familiares)
   */
  createFamilyMemberHistory(text, patientId) {
    if (!text || text === 'No' || text === 'Niega') return null;

    return {
      resourceType: "FamilyMemberHistory",
      id: uuidv4(),
      status: "completed",
      patient: { reference: `Patient/${patientId}` },
      relationship: {
        text: "Family Member" 
      },
      note: [{ text: text }]
    };
  }

  // --- Helpers ---
  mapGender(gender) {
    const lower = (gender || '').toLowerCase();
    if (lower.includes('masculino') || lower === 'm') return 'male';
    if (lower.includes('femenino') || lower === 'f') return 'female';
    return 'unknown';
  }
}

module.exports = new FHIRMapper();
