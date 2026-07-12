import { normalizeServiceKey } from './canonicalServiceRegistry.js';
import { getServiceOperationalContext } from './serviceOperationalTaxonomy.js';

// MVP policy: providers may publish reviewed services before creating individual
// specialist profiles. Keep the catalogue requirements intact so enforcement can
// be re-enabled without migrating service definitions.
export const SERVICE_PREREQUISITE_POLICY = Object.freeze({
  enforce_verified_specialist: false,
});

const PROFESSIONAL_ALIASES = {
  medic_oftalmolog: 'ophthalmologist',
  ophthalmologist: 'ophthalmologist',
  optometrist: 'optometrist',
  optician: 'optician',
};

const EQUIPMENT_ALIASES = {
  ocular_ultrasound: 'ophthalmic_ultrasound',
  ultrasound: 'ophthalmic_ultrasound',
  corneal_topography: 'corneal_topographer',
  visual_field: 'visual_field_analyzer',
  retinal_angiography: 'retinal_angiography_system',
};

const GROUP_EQUIPMENT_DEFAULTS = {
  optometry: { mode: 'any', types: ['visual_acuity_chart', 'phoropter', 'autorefractometer', 'slit_lamp'] },
  ophthalmology_consults: { mode: 'any', types: ['slit_lamp', 'visual_acuity_chart', 'tonometer'] },
  children_and_prevention: { mode: 'any', types: ['visual_acuity_chart', 'phoropter', 'autorefractometer', 'slit_lamp'] },
};

const EQUIPMENT_MODE_OVERRIDES = {
  complete_eye_exam: 'all',
  contact_lens_fitting: 'all',
  specialty_contact_lens_fitting: 'all',
  orthokeratology: 'all',
  cataract_surgery: 'all',
  vitreoretinal_surgery: 'all',
};

const PROFESSIONAL_OVERRIDES = {
  children_eye_exam: ['ophthalmologist'],
  pediatric_refraction: ['optometrist', 'ophthalmologist'],
  amblyopia_screening: ['ophthalmologist'],
  strabismus_screening: ['ophthalmologist'],
  school_screening: ['optometrist', 'ophthalmologist'],
  myopia_control_children: ['optometrist', 'ophthalmologist'],
  vision_therapy: ['optometrist', 'ophthalmologist'],
  low_vision_rehabilitation: ['optometrist', 'ophthalmologist'],
};

const INFRASTRUCTURE_ALIASES = {
  optical_workshop_infrastructure: ['laborator_optic_propriu', 'atelier_service_propriu', 'reparatii_pe_loc', 'montaj_lentile_in_locatie', 'optical_workshop'],
  optical_laboratory_infrastructure: ['laborator_optic_propriu', 'optical_laboratory'],
  clinical_procedure_infrastructure: ['clinical_procedure_room', 'sterile_procedure_room', 'day_procedure_unit', 'ophthalmology_procedure_room'],
  surgical_infrastructure: ['operating_room', 'day_surgery_unit', 'surgical_unit', 'ophthalmology_surgery_unit'],
};

function clean(value) {
  return String(value || '').trim();
}

function normalizeProfessionalType(value) {
  const raw = clean(value);
  return PROFESSIONAL_ALIASES[raw] || raw;
}

function normalizeEquipmentType(value) {
  const raw = clean(value);
  return EQUIPMENT_ALIASES[raw] || raw;
}

function activeRow(row) {
  return Boolean(row) && row.is_active !== false && row.active !== false && row.active_status !== 'inactiv';
}

function profileMap(profiles) {
  if (!profiles) return new Map();
  if (!Array.isArray(profiles)) return new Map(Object.entries(profiles));
  return new Map(profiles.filter(Boolean).map((profile) => [profile.id, profile]));
}

function rowUnitKeys(row) {
  const values = [
    ...(Array.isArray(row?.functional_unit_keys) ? row.functional_unit_keys : []),
    row?.functional_unit_key,
    row?.unit_key,
  ];
  return [...new Set(values.map(clean).filter(Boolean))];
}

function rowMatchesUnit(row, unitKey, enforceUnitScope) {
  if (!unitKey) return true;
  const keys = rowUnitKeys(row);
  if (keys.includes(unitKey)) return true;
  return !enforceUnitScope && keys.length === 0;
}

function activeContextKeys(rows, keyField) {
  return new Set((rows || [])
    .filter(activeRow)
    .map((row) => clean(row?.[keyField] || row?.key))
    .filter(Boolean));
}

function verifiedProfessionalTypes(assignments, profiles, unitKey, enforceUnitScope) {
  const byId = profileMap(profiles);
  const result = new Set();
  const scopedAssignments = [];
  for (const assignment of assignments || []) {
    if (!activeRow(assignment) || !rowMatchesUnit(assignment, unitKey, enforceUnitScope)) continue;
    const profile = byId.get(assignment.professional_id) || assignment.professional_profile || null;
    const verified = assignment.affiliation_status === 'vezunde_verified'
      || assignment.confirmation_level === 'vezunde_verified'
      || profile?.verification_status === 'verified'
      || profile?.confirmation_level === 'vezunde_verified'
      || profile?.verified === true;
    if (!verified) continue;
    const type = normalizeProfessionalType(assignment.professional_type || profile?.professional_type || profile?.role);
    if (type) result.add(type);
    scopedAssignments.push(assignment.id || assignment.professional_id);
  }
  return { types: result, scopedAssignments };
}

function verifiedEquipmentTypes(equipment, medical, unitKey, enforceUnitScope) {
  const result = new Set();
  const scopedEquipment = [];
  for (const item of equipment || []) {
    if (!activeRow(item) || !rowMatchesUnit(item, unitKey, enforceUnitScope)) continue;
    const evidenceApproved = item.evidence_status === 'approved'
      || item.verification_status === 'verified'
      || item.verified === true;
    const confirmation = clean(item.confirmation_level);
    const confirmationAccepted = medical
      ? confirmation === 'vezunde_verified'
      : ['provider_confirmed', 'vezunde_verified'].includes(confirmation);
    if (!evidenceApproved || !confirmationAccepted) continue;
    const type = normalizeEquipmentType(item.equipment_category_key || item.equipment_key || item.key);
    if (type) result.add(type);
    scopedEquipment.push(item.id || type);
  }
  return { types: result, scopedEquipment };
}

function activeFacilityTypes(facilities, unitKey, enforceUnitScope) {
  const result = new Set();
  const scopedFacilities = [];
  for (const facility of facilities || []) {
    if (!activeRow(facility) || !rowMatchesUnit(facility, unitKey, enforceUnitScope)) continue;
    const type = clean(facility.facility_key || facility.key);
    if (type) result.add(type);
    scopedFacilities.push(facility.id || type);
  }
  return { types: result, scopedFacilities };
}

function infrastructureSatisfied(requirement, facilities, location, unitKeys) {
  if (unitKeys.has(requirement)) return true;
  if (requirement === 'clinical_procedure_infrastructure') {
    if (location?.clinical_infrastructure_verified === true || location?.has_procedure_room === true) return true;
  }
  if (requirement === 'surgical_infrastructure') {
    if (location?.surgical_infrastructure_verified === true || location?.has_operating_room === true) return true;
  }
  const aliases = INFRASTRUCTURE_ALIASES[requirement] || [];
  return aliases.some((key) => facilities.has(key) || unitKeys.has(key));
}

function resolveUnitKey(serviceKey, context) {
  const explicit = clean(context.serviceUnitKey || context.service_unit_key || context.service_unit_map?.[serviceKey]);
  if (explicit) return explicit;
  return getServiceOperationalContext(serviceKey)?.unitKey || '';
}

function resolveCapabilityKey(serviceKey, context) {
  const explicit = clean(context.capabilityKey || context.capability_key || context.service_capability_map?.[serviceKey]);
  if (explicit) return explicit;
  return getServiceOperationalContext(serviceKey)?.capabilityKey || '';
}

export function getServicePrerequisiteDefinition(rawKey) {
  const normalized = normalizeServiceKey(rawKey);
  if (!normalized.canonicalKey || !normalized.definition) return null;

  const base = normalized.definition;
  const groupEquipment = GROUP_EQUIPMENT_DEFAULTS[base.group] || null;
  const requiredEquipmentTypes = Array.isArray(base.required_equipment_types) && base.required_equipment_types.length > 0
    ? base.required_equipment_types
    : (groupEquipment?.types || []);
  const requiredInfrastructureTypes = Array.isArray(base.required_infrastructure_types)
    ? base.required_infrastructure_types
    : [];

  return {
    ...base,
    required_professional_types: [...(PROFESSIONAL_OVERRIDES[normalized.canonicalKey] || base.required_professional_types || [])],
    required_equipment_types: [...requiredEquipmentTypes],
    equipment_requirement_mode: EQUIPMENT_MODE_OVERRIDES[normalized.canonicalKey] || groupEquipment?.mode || 'all',
    required_infrastructure_types: [...requiredInfrastructureTypes],
  };
}

export function evaluateServicePrerequisites(rawKey, context = {}) {
  const definition = getServicePrerequisiteDefinition(rawKey);
  if (!definition) {
    return {
      service_key: clean(rawKey), canonical_key: null, eligible: false, status: 'unknown_service',
      blockers: [{ code: 'unknown_service', message: 'Serviciul nu există în registrul canonic.' }],
      definition: null,
      evidence: { verified_professional_types: [], verified_equipment_types: [], active_facility_types: [], service_unit_key: '', capability_key: '' },
    };
  }

  const location = context.location || {};
  const assignments = context.assignments || [];
  const professionals = context.professionals || [];
  const equipment = context.equipment || [];
  const facilities = context.facilities || [];
  const functionalUnits = context.functionalUnits || context.functional_units || [];
  const capabilities = context.capabilities || [];
  const blockers = [];

  const serviceKey = definition.key;
  const serviceContext = getServiceOperationalContext(serviceKey);
  const serviceUnitKey = resolveUnitKey(serviceKey, context);
  const prerequisiteUnitKey = serviceContext?.scope === 'location' ? '' : serviceUnitKey;
  const capabilityKey = resolveCapabilityKey(serviceKey, context);
  const hasPersistedUnits = functionalUnits.length > 0;
  const enforceUnitScope = context.enforceUnitScope === true || hasPersistedUnits;
  const activeUnitKeys = activeContextKeys(functionalUnits, 'unit_key');
  const activeCapabilityKeys = activeContextKeys(capabilities, 'capability_key');

  const profileType = clean(location.provider_profile_type);
  if (profileType && definition.hidden_for_profile_types.includes(profileType)) {
    blockers.push({
      code: 'incompatible_profile_type',
      message: 'Serviciul nu este compatibil cu tipul acestei locații.',
      required: definition.applicable_profile_types,
      actual: profileType,
    });
  }

  if (enforceUnitScope && prerequisiteUnitKey && !activeUnitKeys.has(prerequisiteUnitKey)) {
    const fallbackUnits = serviceContext?.fallbackUnitKeys || [];
    const fallbackMatched = fallbackUnits.some((unitKey) => activeUnitKeys.has(unitKey));
    if (!fallbackMatched) {
      blockers.push({
        code: 'functional_unit_missing',
        message: 'Lipsește spațiul sau unitatea funcțională în care poate fi realizată această activitate.',
        required: [serviceUnitKey, ...fallbackUnits],
        actual: [...activeUnitKeys],
      });
    }
  }

  if (enforceUnitScope && capabilityKey && !activeCapabilityKeys.has(capabilityKey)) {
    blockers.push({
      code: 'capability_missing',
      message: 'Capabilitatea necesară nu este declarată pentru această locație.',
      required: [capabilityKey],
      actual: [...activeCapabilityKeys],
    });
  }

  const professionalResult = verifiedProfessionalTypes(assignments, professionals, prerequisiteUnitKey, enforceUnitScope);
  if (definition.requires_verified_specialist && SERVICE_PREREQUISITE_POLICY.enforce_verified_specialist) {
    const required = definition.required_professional_types || [];
    const matched = required.some((type) => professionalResult.types.has(normalizeProfessionalType(type)));
    if (!matched) {
      blockers.push({
        code: 'verified_specialist_missing',
        message: enforceUnitScope
          ? 'Este necesar un specialist verificat și asociat acestei unități.'
          : 'Este necesar un specialist verificat și asociat activ locației.',
        required,
        actual: [...professionalResult.types],
      });
    }
  }

  const medical = definition.requires_review || definition.service_need_level === 'specialized_medical';
  const equipmentResult = verifiedEquipmentTypes(equipment, medical, prerequisiteUnitKey, enforceUnitScope);
  if (definition.requires_equipment) {
    const required = definition.required_equipment_types || [];
    if (required.length === 0) {
      blockers.push({
        code: 'equipment_requirement_not_configured',
        message: 'Cerințele de echipament pentru acest serviciu trebuie configurate în registru.',
        required: [],
        actual: [...equipmentResult.types],
      });
    } else {
      const checks = required.map((type) => equipmentResult.types.has(normalizeEquipmentType(type)));
      const matched = definition.equipment_requirement_mode === 'any' ? checks.some(Boolean) : checks.every(Boolean);
      if (!matched) {
        blockers.push({
          code: 'verified_equipment_missing',
          message: enforceUnitScope
            ? 'Lipsește echipamentul verificat și asociat unității în care este realizat serviciul.'
            : 'Lipsește echipamentul verificat necesar acestui serviciu.',
          mode: definition.equipment_requirement_mode,
          required,
          actual: [...equipmentResult.types],
        });
      }
    }
  }

  const facilityResult = activeFacilityTypes(facilities, prerequisiteUnitKey, enforceUnitScope);
  if (definition.requires_infrastructure) {
    const required = definition.required_infrastructure_types || [];
    const matched = required.length > 0
      && required.every((requirement) => infrastructureSatisfied(requirement, facilityResult.types, location, activeUnitKeys));
    if (!matched) {
      blockers.push({
        code: 'verified_infrastructure_missing',
        message: 'Lipsește dovada infrastructurii necesare acestui serviciu.',
        required,
        actual: [...facilityResult.types],
      });
    }
  }

  let status = 'available';
  if (blockers.some((blocker) => blocker.code === 'incompatible_profile_type')) status = 'incompatible_profile';
  else if (blockers.some((blocker) => blocker.code === 'functional_unit_missing')) status = 'requires_functional_unit';
  else if (blockers.some((blocker) => blocker.code === 'capability_missing')) status = 'requires_capability';
  else if (blockers.some((blocker) => blocker.code === 'verified_specialist_missing')) status = 'requires_verified_specialist';
  else if (blockers.some((blocker) => blocker.code.includes('equipment'))) status = 'requires_equipment';
  else if (blockers.some((blocker) => blocker.code.includes('infrastructure'))) status = 'requires_infrastructure';
  else if (definition.requires_review) status = 'ready_for_review';

  return {
    service_key: definition.key,
    canonical_key: definition.key,
    eligible: blockers.length === 0,
    status,
    blockers,
    definition,
    evidence: {
      verified_professional_types: [...professionalResult.types],
      verified_specialist_enforced: SERVICE_PREREQUISITE_POLICY.enforce_verified_specialist,
      verified_equipment_types: [...equipmentResult.types],
      active_facility_types: [...facilityResult.types],
      active_functional_unit_keys: [...activeUnitKeys],
      active_capability_keys: [...activeCapabilityKeys],
      service_unit_key: serviceUnitKey,
      prerequisite_unit_key: prerequisiteUnitKey,
      validation_scope: serviceContext?.scope || 'unit',
      capability_key: capabilityKey,
      unit_scope_enforced: enforceUnitScope,
      scoped_assignment_ids: professionalResult.scopedAssignments,
      scoped_equipment_ids: equipmentResult.scopedEquipment,
      scoped_facility_ids: facilityResult.scopedFacilities,
    },
  };
}

export function areServicePrerequisitesSatisfied(rawKey, context = {}) {
  return evaluateServicePrerequisites(rawKey, context).eligible;
}

export function servicePrerequisiteStatusLabel(status) {
  const labels = {
    available: 'Disponibil',
    ready_for_review: 'Pregătit pentru verificare',
    requires_verified_location: 'Necesită locație verificată',
    requires_functional_unit: 'Necesită spațiu compatibil',
    requires_capability: 'Necesită capabilitate declarată',
    requires_verified_specialist: 'Necesită specialist verificat',
    requires_equipment: 'Necesită echipament verificat',
    requires_infrastructure: 'Necesită infrastructură verificată',
    incompatible_profile: 'Incompatibil cu tipul locației',
    unknown_service: 'Serviciu necunoscut',
  };
  return labels[status] || labels.unknown_service;
}
