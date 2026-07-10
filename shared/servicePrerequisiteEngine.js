import {
  getCanonicalServiceDefinition,
  normalizeServiceKey,
} from './canonicalServiceRegistry.js';

const PROFESSIONAL_TYPE_ALIASES = {
  medic_oftalmolog: 'ophthalmologist',
  ophthalmologist: 'ophthalmologist',
  optometrist: 'optometrist',
  optician: 'optician',
};

const EQUIPMENT_TYPE_ALIASES = {
  ocular_ultrasound: 'ophthalmic_ultrasound',
  ultrasound: 'ophthalmic_ultrasound',
  corneal_topography: 'corneal_topographer',
  visual_field: 'visual_field_analyzer',
};

const GROUP_EQUIPMENT_DEFAULTS = {
  optometry: {
    mode: 'any',
    types: ['visual_acuity_chart', 'phoropter', 'autorefractometer', 'slit_lamp'],
  },
  ophthalmology_consults: {
    mode: 'any',
    types: ['slit_lamp', 'visual_acuity_chart', 'tonometer'],
  },
  children_and_prevention: {
    mode: 'any',
    types: ['visual_acuity_chart', 'phoropter', 'autorefractometer', 'slit_lamp'],
  },
  technical_activities: {
    mode: 'any',
    types: ['tracer', 'blocker', 'edger', 'groover', 'drill', 'polisher', 'ultrasonic_cleaner'],
  },
};

const SERVICE_POLICY_OVERRIDES = {
  pd_measurement: {
    equipment_mode: 'any',
    equipment_types: ['pupillometer', 'digital_centering_system'],
  },
  digital_centering: {
    equipment_mode: 'any',
    equipment_types: ['digital_centering_system'],
  },
  visual_acuity_test: { equipment_mode: 'any', equipment_types: ['visual_acuity_chart'] },
  refraction: { equipment_mode: 'any', equipment_types: ['phoropter', 'autorefractometer'] },
  autorefractometry: { equipment_mode: 'any', equipment_types: ['autorefractometer'] },
  binocular_vision: { equipment_mode: 'any', equipment_types: ['visual_acuity_chart', 'phoropter'] },
  dry_eye_screening: { equipment_mode: 'any', equipment_types: ['slit_lamp'] },
  color_vision_test: { requires_equipment: false, equipment_types: [] },
  occupational_vision: { equipment_mode: 'any', equipment_types: ['visual_acuity_chart'] },

  contact_lens_consultation: {
    equipment_mode: 'any',
    equipment_types: ['slit_lamp', 'contact_lens_trial_set'],
  },
  contact_lens_fitting: {
    equipment_mode: 'all',
    equipment_types: ['slit_lamp', 'contact_lens_trial_set'],
  },
  contact_lens_trial: {
    equipment_mode: 'any',
    equipment_types: ['slit_lamp', 'contact_lens_trial_set'],
  },
  contact_lens_followup: { equipment_mode: 'any', equipment_types: ['slit_lamp'] },

  ophthalmology_consultation: {
    equipment_mode: 'any',
    equipment_types: ['slit_lamp', 'visual_acuity_chart'],
  },
  complete_eye_exam: {
    equipment_mode: 'all',
    equipment_types: ['slit_lamp', 'visual_acuity_chart'],
  },
  prescription_check: {
    equipment_mode: 'any',
    equipment_types: ['visual_acuity_chart', 'phoropter', 'autorefractometer'],
  },
  eye_pressure_check: { equipment_mode: 'any', equipment_types: ['tonometer'] },
  fundus_exam: { equipment_mode: 'any', equipment_types: ['slit_lamp', 'fundus_camera'] },
  anterior_segment_exam: { equipment_mode: 'any', equipment_types: ['slit_lamp'] },
  followup_consultation: {
    equipment_mode: 'any',
    equipment_types: ['slit_lamp', 'visual_acuity_chart'],
  },
  second_opinion: {
    equipment_mode: 'any',
    equipment_types: ['slit_lamp', 'visual_acuity_chart'],
  },

  oct: { equipment_mode: 'any', equipment_types: ['oct'] },
  visual_field_analyzer: { equipment_mode: 'any', equipment_types: ['visual_field_analyzer'] },
  fundus_camera: { equipment_mode: 'any', equipment_types: ['fundus_camera'] },
  pachymeter: { equipment_mode: 'any', equipment_types: ['pachymeter'] },
  biometer: { equipment_mode: 'any', equipment_types: ['biometer'] },
  corneal_topography: { equipment_mode: 'any', equipment_types: ['corneal_topographer'] },
  keratometry: { equipment_mode: 'any', equipment_types: ['keratometer'] },
  tonometry: { equipment_mode: 'any', equipment_types: ['tonometer'] },
  gonioscopy: { equipment_mode: 'any', equipment_types: ['gonioscope'] },
  ultrasound: { equipment_mode: 'any', equipment_types: ['ophthalmic_ultrasound'] },
  specular_microscopy: { equipment_mode: 'any', equipment_types: ['specular_microscope'] },
  angiography: { equipment_mode: 'any', equipment_types: ['retinal_angiography_system'] },

  children_eye_exam: {
    professional_types: ['ophthalmologist'],
    equipment_mode: 'any',
    equipment_types: ['slit_lamp', 'visual_acuity_chart'],
  },
  pediatric_refraction: {
    professional_types: ['optometrist', 'ophthalmologist'],
    equipment_mode: 'any',
    equipment_types: ['visual_acuity_chart', 'phoropter', 'autorefractometer'],
  },
  amblyopia_screening: {
    professional_types: ['ophthalmologist'],
    equipment_mode: 'any',
    equipment_types: ['visual_acuity_chart'],
  },
  strabismus_screening: {
    professional_types: ['ophthalmologist'],
    equipment_mode: 'any',
    equipment_types: ['visual_acuity_chart'],
  },
  school_screening: {
    professional_types: ['optometrist', 'ophthalmologist'],
    equipment_mode: 'any',
    equipment_types: ['visual_acuity_chart'],
  },
  myopia_control_children: {
    professional_types: ['optometrist', 'ophthalmologist'],
    equipment_mode: 'any',
    equipment_types: ['visual_acuity_chart', 'phoropter', 'autorefractometer'],
  },
  vision_therapy: {
    professional_types: ['optometrist', 'ophthalmologist'],
    requires_equipment: false,
    equipment_types: [],
  },

  cataract_surgery: {
    equipment_mode: 'all',
    equipment_types: ['operating_microscope', 'phacoemulsification_system'],
    infrastructure_types: ['surgical_infrastructure'],
  },
  refractive_surgery: {
    equipment_mode: 'any',
    equipment_types: ['excimer_laser', 'femtosecond_laser'],
    infrastructure_types: ['surgical_infrastructure'],
  },
  laser_procedures: {
    equipment_mode: 'any',
    equipment_types: ['yag_laser', 'retinal_laser', 'excimer_laser', 'femtosecond_laser'],
    infrastructure_types: ['clinical_procedure_infrastructure'],
  },
  yag_laser: {
    equipment_mode: 'any',
    equipment_types: ['yag_laser'],
    infrastructure_types: ['clinical_procedure_infrastructure'],
  },
  retinal_laser: {
    equipment_mode: 'any',
    equipment_types: ['retinal_laser'],
    infrastructure_types: ['clinical_procedure_infrastructure'],
  },
  intravitreal_injections: {
    equipment_mode: 'any',
    equipment_types: ['intravitreal_injection_setup'],
    infrastructure_types: ['clinical_procedure_infrastructure'],
  },
  eyelid_surgery: {
    equipment_mode: 'any',
    equipment_types: ['operating_microscope', 'minor_procedure_set'],
    infrastructure_types: ['surgical_infrastructure'],
  },
  chalazion_treatment: {
    equipment_mode: 'any',
    equipment_types: ['minor_procedure_set'],
    infrastructure_types: ['clinical_procedure_infrastructure'],
  },
  minor_eye_procedures: {
    equipment_mode: 'any',
    equipment_types: ['minor_procedure_set'],
    infrastructure_types: ['clinical_procedure_infrastructure'],
  },

  eyeglasses_adjustment: { requires_equipment: false, equipment_types: [] },
  eyeglasses_repair: {
    equipment_mode: 'any',
    equipment_types: ['drill', 'groover', 'polisher'],
    infrastructure_types: ['optical_workshop_infrastructure'],
  },
  lens_fitting: {
    equipment_mode: 'any',
    equipment_types: ['tracer', 'blocker', 'edger'],
    infrastructure_types: ['optical_workshop_infrastructure'],
  },
  frame_repair: {
    equipment_mode: 'any',
    equipment_types: ['drill', 'groover', 'polisher'],
    infrastructure_types: ['optical_workshop_infrastructure'],
  },
  screw_replacement: { requires_equipment: false, equipment_types: [] },
  lens_replacement: {
    equipment_mode: 'any',
    equipment_types: ['tracer', 'blocker', 'edger'],
    infrastructure_types: ['optical_workshop_infrastructure'],
  },
  frame_cleaning: { equipment_mode: 'any', equipment_types: ['ultrasonic_cleaner'] },
  workshop_orders: { requires_equipment: false, equipment_types: [] },
};

const INFRASTRUCTURE_ALIASES = {
  optical_workshop_infrastructure: [
    'laborator_optic_propriu',
    'atelier_service_propriu',
    'reparatii_pe_loc',
    'montaj_lentile_in_locatie',
  ],
  clinical_procedure_infrastructure: [
    'clinical_procedure_room',
    'sterile_procedure_room',
    'day_procedure_unit',
  ],
  surgical_infrastructure: [
    'operating_room',
    'day_surgery_unit',
    'surgical_unit',
  ],
};

function clean(value) {
  return String(value || '').trim();
}

function normalizeProfessionalType(value) {
  const raw = clean(value);
  return PROFESSIONAL_TYPE_ALIASES[raw] || raw;
}

function normalizeEquipmentType(value) {
  const raw = clean(value);
  return EQUIPMENT_TYPE_ALIASES[raw] || raw;
}

function activeRow(row) {
  return row && row.is_active !== false && row.active !== false && row.active_status !== 'inactiv';
}

function profileMap(profiles) {
  if (!profiles) return new Map();
  if (!Array.isArray(profiles)) return new Map(Object.entries(profiles));
  return new Map(profiles.filter(Boolean).map((profile) => [profile.id, profile]));
}

function verifiedProfessionalTypes(assignments, profiles) {
  const byId = profileMap(profiles);
  const result = new Set();
  for (const assignment of assignments || []) {
    if (!activeRow(assignment)) continue;
    const profile = byId.get(assignment.professional_id) || assignment.professional_profile || null;
    const verified = assignment.affiliation_status === 'vezunde_verified'
      || assignment.confirmation_level === 'vezunde_verified'
      || profile?.verification_status === 'verified'
      || profile?.confirmation_level === 'vezunde_verified'
      || profile?.verified === true;
    if (!verified) continue;
    const professionalType = normalizeProfessionalType(
      assignment.professional_type || profile?.professional_type || profile?.role,
    );
    if (professionalType) result.add(professionalType);
  }
  return result;
}

function verifiedEquipmentTypes(equipment, medical) {
  const result = new Set();
  for (const item of equipment || []) {
    if (!activeRow(item)) continue;
    const evidenceApproved = item.evidence_status === 'approved'
      || item.verification_status === 'verified'
      || item.verified === true;
    const confirmation = clean(item.confirmation_level);
    const confirmationAccepted = medical
      ? confirmation === 'vezunde_verified'
      : ['provider_confirmed', 'vezunde_verified'].includes(confirmation);
    if (!evidenceApproved || !confirmationAccepted) continue;
    const equipmentType = normalizeEquipmentType(
      item.equipment_category_key || item.equipment_key || item.key,
    );
    if (equipmentType) result.add(equipmentType);
  }
  return result;
}

function activeFacilityTypes(facilities) {
  const result = new Set();
  for (const facility of facilities || []) {
    if (!activeRow(facility)) continue;
    const facilityType = clean(facility.facility_key || facility.key);
    if (facilityType) result.add(facilityType);
  }
  return result;
}

function infrastructureSatisfied(requirement, facilities, location) {
  if (requirement === 'optical_workshop_infrastructure') {
    return INFRASTRUCTURE_ALIASES[requirement].some((key) => facilities.has(key));
  }
  if (requirement === 'clinical_procedure_infrastructure') {
    if (location?.clinical_infrastructure_verified === true || location?.has_procedure_room === true) return true;
    return INFRASTRUCTURE_ALIASES[requirement].some((key) => facilities.has(key));
  }
  if (requirement === 'surgical_infrastructure') {
    if (location?.surgical_infrastructure_verified === true || location?.has_operating_room === true) return true;
    return INFRASTRUCTURE_ALIASES[requirement].some((key) => facilities.has(key));
  }
  return facilities.has(requirement);
}

export function getServicePrerequisiteDefinition(rawKey) {
  const normalized = normalizeServiceKey(rawKey);
  if (!normalized.canonicalKey || !normalized.definition) return null;
  const base = normalized.definition;
  const override = SERVICE_POLICY_OVERRIDES[normalized.canonicalKey] || {};
  const groupEquipment = GROUP_EQUIPMENT_DEFAULTS[base.group] || null;
  const requiredEquipmentTypes = override.equipment_types
    || base.required_equipment_types
    || groupEquipment?.types
    || [];
  const equipmentMode = override.equipment_mode || groupEquipment?.mode || 'all';
  const requiredInfrastructureTypes = override.infrastructure_types
    || (base.requires_infrastructure ? ['clinical_procedure_infrastructure'] : []);
  return {
    ...base,
    required_professional_types: [
      ...(override.professional_types || base.required_professional_types || []),
    ],
    requires_equipment: override.requires_equipment === undefined
      ? base.requires_equipment
      : override.requires_equipment,
    required_equipment_types: [...requiredEquipmentTypes],
    equipment_requirement_mode: equipmentMode,
    requires_infrastructure: requiredInfrastructureTypes.length > 0 || base.requires_infrastructure,
    required_infrastructure_types: [...requiredInfrastructureTypes],
  };
}

export function evaluateServicePrerequisites(rawKey, context = {}) {
  const definition = getServicePrerequisiteDefinition(rawKey);
  if (!definition) {
    return {
      service_key: clean(rawKey),
      canonical_key: null,
      eligible: false,
      status: 'unknown_service',
      blockers: [{ code: 'unknown_service', message: 'Serviciul nu exista in registrul canonic.' }],
      definition: null,
      evidence: {
        verified_professional_types: [],
        verified_equipment_types: [],
        active_facility_types: [],
      },
    };
  }

  const location = context.location || {};
  const assignments = context.assignments || [];
  const professionals = context.professionals || [];
  const equipment = context.equipment || [];
  const facilities = context.facilities || [];
  const blockers = [];

  const profileType = clean(location.provider_profile_type);
  if (profileType && definition.hidden_for_profile_types.includes(profileType)) {
    blockers.push({
      code: 'incompatible_profile_type',
      message: 'Serviciul nu este compatibil cu tipul acestei locatii.',
      required: definition.applicable_profile_types,
      actual: profileType,
    });
  }

  const professionalTypes = verifiedProfessionalTypes(assignments, professionals);
  if (definition.requires_verified_specialist) {
    const required = definition.required_professional_types || [];
    const matched = required.some((type) => professionalTypes.has(normalizeProfessionalType(type)));
    if (!matched) {
      blockers.push({
        code: 'verified_specialist_missing',
        message: 'Este necesar un specialist verificat si asociat activ locatiei.',
        required,
        actual: [...professionalTypes],
      });
    }
  }

  const medical = definition.requires_review || definition.service_need_level === 'specialized_medical';
  const equipmentTypes = verifiedEquipmentTypes(equipment, medical);
  if (definition.requires_equipment) {
    const required = definition.required_equipment_types || [];
    if (required.length === 0) {
      blockers.push({
        code: 'equipment_requirement_not_configured',
        message: 'Cerintele de echipament pentru acest serviciu trebuie configurate in registru.',
        required: [],
        actual: [...equipmentTypes],
      });
    } else {
      const checks = required.map((type) => equipmentTypes.has(normalizeEquipmentType(type)));
      const matched = definition.equipment_requirement_mode === 'any'
        ? checks.some(Boolean)
        : checks.every(Boolean);
      if (!matched) {
        blockers.push({
          code: 'verified_equipment_missing',
          message: 'Lipseste echipamentul verificat necesar acestui serviciu.',
          mode: definition.equipment_requirement_mode,
          required,
          actual: [...equipmentTypes],
        });
      }
    }
  }

  const facilityTypes = activeFacilityTypes(facilities);
  if (definition.requires_infrastructure) {
    const required = definition.required_infrastructure_types || [];
    const matched = required.length > 0
      && required.every((requirement) => infrastructureSatisfied(requirement, facilityTypes, location));
    if (!matched) {
      blockers.push({
        code: 'verified_infrastructure_missing',
        message: 'Lipseste dovada infrastructurii necesare acestui serviciu.',
        required,
        actual: [...facilityTypes],
      });
    }
  }

  let status = 'available';
  if (blockers.some((blocker) => blocker.code === 'incompatible_profile_type')) status = 'incompatible_profile';
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
      verified_professional_types: [...professionalTypes],
      verified_equipment_types: [...equipmentTypes],
      active_facility_types: [...facilityTypes],
    },
  };
}

export function areServicePrerequisitesSatisfied(rawKey, context = {}) {
  return evaluateServicePrerequisites(rawKey, context).eligible;
}

export function servicePrerequisiteStatusLabel(status) {
  const labels = {
    available: 'Disponibil',
    ready_for_review: 'Pregatit pentru verificare',
    requires_verified_specialist: 'Necesita specialist verificat',
    requires_equipment: 'Necesita echipament verificat',
    requires_infrastructure: 'Necesita infrastructura verificata',
    incompatible_profile: 'Incompatibil cu tipul locatiei',
    unknown_service: 'Serviciu necunoscut',
  };
  return labels[status] || labels.unknown_service;
}
