import * as base from './canonicalServiceRegistry.js';

const {
  AMBIGUOUS_LEGACY_SERVICE_KEYS,
  CANONICAL_SERVICE_KEYS,
  CANONICAL_SERVICE_KEY_SET,
  CANONICAL_SERVICE_REGISTRY,
  CLAIM_PREP_SERVICE_GROUPS,
  LEGACY_PROVIDER_TYPE_LAYOUTS,
  LEGACY_SERVICE_ALIASES,
  PROFILE_TYPES,
  SERVICE_GROUP_LAYOUTS,
  SERVICE_GROUPS,
} = base;

const NEW_KEYS = {
  cas_reimbursed_services: {
    label: 'Servicii decontate prin CAS',
    group: 'business_attributes',
    kind: 'service',
    need: 'general',
    review: false,
    specialist: false,
    professionalTypes: [],
  },
  onsite_eye_testing_b2b: {
    label: 'Consultații/Testări la domiciliu sau sediul firmelor (B2B)',
    group: 'business_attributes',
    kind: 'service',
    need: 'specialized_medical',
    review: true,
    specialist: true,
    professionalTypes: ['optometrist', 'ophthalmologist'],
  },
  // Serviciile in afara locatiei, separate pe tipuri (2026-08-06). Cheia combinata de
  // mai sus ramane definita, ca sa nu se rupa cele ~20 de referinte existente
  // (taxonomie, cautare semantica, pachete, teste), dar e scoasa din interfata.
  // Motivul separarii: sunt piete complet diferite - ingrijire la domiciliu pentru
  // varstnici versus medicina muncii, obligatorie prin HG 1028/2006.
  home_visit_eye_care: {
    label: 'Consultații la domiciliul pacientului',
    group: 'business_attributes',
    kind: 'service',
    need: 'specialized_medical',
    review: true,
    specialist: true,
    professionalTypes: ['optometrist', 'ophthalmologist'],
  },
  workplace_vision_screening: {
    label: 'Screening de vedere la sediul companiei',
    group: 'business_attributes',
    kind: 'service',
    need: 'specialized_medical',
    review: true,
    specialist: true,
    professionalTypes: ['optometrist', 'ophthalmologist'],
  },
  // Nu e o deplasare, ci capacitatea de a emite documentele de care are nevoie
  // angajatorul. HG 1028/2006: angajatorul e obligat sa suporte costul ochelarilor
  // pentru lucrul la ecran cand oftalmologul ii recomanda expres.
  employer_glasses_reimbursement: {
    label: 'Documente pentru decontarea ochelarilor de către angajator (HG 1028)',
    group: 'business_attributes',
    kind: 'service',
    need: 'general',
    review: false,
    specialist: false,
    professionalTypes: [],
  },
  mobile_optical_unit: {
    label: 'Unitate optică mobilă (se deplasează la client)',
    group: 'business_attributes',
    kind: 'service',
    need: 'specialized_medical',
    review: true,
    specialist: true,
    professionalTypes: ['optometrist', 'ophthalmologist'],
  },
  school_vision_screening: {
    label: 'Screening de vedere în școli și grădinițe',
    group: 'business_attributes',
    kind: 'service',
    need: 'specialized_medical',
    review: true,
    specialist: true,
    professionalTypes: ['optometrist', 'ophthalmologist'],
  },
  computer_screen_glasses: {
    label: 'Ochelari pentru calculator / protecție ecrane',
    group: 'optical_retail',
    kind: 'product',
    need: 'general',
    review: false,
    specialist: false,
    professionalTypes: [],
  },
  myopia_control_spectacle_lenses: {
    label: 'Lentile speciale pentru controlul miopiei (Stellest / MiYOSMART)',
    group: 'children_and_prevention',
    kind: 'service',
    need: 'specialized_medical',
    review: true,
    specialist: true,
    professionalTypes: ['optometrist', 'ophthalmologist'],
    equipment: ['autorefractometer'],
  },
};

const SPECIFIC_SEARCH_KEYWORDS = {
  cas_reimbursed_services: ['cas', 'cnas', 'decontat', 'decontare', 'bilet de trimitere', 'asigurare de sanatate'],
  onsite_eye_testing_b2b: ['testare la sediu', 'control vedere la birou', 'testare angajati', 'consultatie la domiciliu', 'control acasa', 'screening vedere firma'],
  computer_screen_glasses: ['ochelari calculator', 'ochelari pentru ecran', 'protectie ecrane', 'ochelari lumina albastra', 'ochelari birou'],
  myopia_control_spectacle_lenses: ['stellest', 'miyosmart', 'mi yosmart', 'lentile control miopie', 'lentile speciale miopie copii'],
  orthokeratology: ['ortokeratologie', 'lentile de noapte', 'lentile purtate noaptea', 'ortho k', 'fara ochelari ziua'],
  vision_therapy: ['ortoptica', 'exercitii vizuale', 'terapie vizuala', 'ambliopie exercitii', 'strabism exercitii', 'ochi lenes terapie'],
  specular_microscopy: ['microscopie speculara', 'microscopie endoteliala', 'endoteliu cornean', 'celule endoteliale'],
  dry_eye_management: ['ochi uscati', 'ma ustura ochii', 'roseata', 'nisip in ochi', 'lacrimare', 'arsura ochi'],
  dry_eye_screening: ['test ochi uscat', 'ma ustura ochii', 'nisip in ochi', 'ochi rosii'],
  pachymeter: ['pahimetrie', 'grosime cornee', 'masurare cornee', 'ochi uscati', 'roseata'],
  optometry_consultation: ['control vedere', 'control ochelari', 'consult optometrist', 'vad in ceata', 'mi au crescut dioptriile', 'verificare dioptrii'],
  refraction: ['determinare dioptrii', 'masurat dioptrii', 'mi au crescut dioptriile', 'schimbat ochelari'],
  photochromic_lenses: ['lentile fotocromatice', 'ochelari heliomati', 'lentile heliomate', 'lentile care se inchid la soare'],
  prescription_sunglasses: ['ochelari de soare cu dioptrii', 'lentile de soare cu dioptrii', 'ochelari soare vedere'],
  emergency_ophthalmology: ['urgenta oftalmologica', 'mi a intrat ceva in ochi', 'durere insuportabila', 'durere oculara brusca', 'pierdere brusca vedere', 'ochi rosu dureros'],
  ocular_trauma: ['traumatism ocular', 'lovitura in ochi', 'accident ochi'],
  foreign_body_removal: ['corp strain ochi', 'mi a intrat ceva in ochi', 'aschie in ochi'],
  children_eye_exam: ['control ochelari copii', 'control ochi copil', 'medici copii', 'consult pediatric'],
  pediatric_ophthalmology: ['oftalmolog copii', 'medic ochi copii', 'control ochi copil'],
  pediatric_refraction: ['dioptrii copii', 'ochelari copii', 'masurat vedere copil'],
  amblyopia_screening: ['ochi lenes', 'ambliopie', 'screening ochi lenes'],
  strabismus: ['strabism', 'ochi incrucisati', 'ochi fugit'],
  myopia_management: ['management miopie', 'control miopie', 'miopie progresiva', 'incetinire miopie'],
  myopia_control_children: ['control miopie copii', 'miopie progresiva copil', 'incetinire miopie'],
  myopia_control_contact_lenses: ['lentile contact control miopie', 'miopie copii lentile contact'],
  blue_light_lenses: ['filtru lumina albastra', 'protectie calculator', 'protectie ecrane', 'blue light'],
  office_lenses: ['lentile office', 'lentile birou', 'lentile intermediare', 'ochelari calculator birou'],
  ophthalmology_consultation: ['oftalmolog', 'doctor de ochi', 'medic de ochi', 'consult ochi'],
  oct: ['oct', 'tomografie ochi', 'oct retina', 'oct macula', 'oct nerv optic'],
  visual_field_analyzer: ['camp vizual', 'perimetrie', 'test camp vizual'],
  fundus_exam: ['fund de ochi', 'examinare retina', 'control retina'],
  tonometry: ['tonometrie', 'tensiune oculara', 'presiune intraoculara'],
  eyeglasses_repair: [
    'reparatii ochelari',
    'reparat ochelari',
    'ochelari rupti',
    'ochelarii rupti',
    'rupt ochelari',
    's-au rupt ochelarii',
    'ochelari stricati',
  ],
  eyeglasses_adjustment: ['reglaj ochelari', 'ajustare rame', 'ochelari largi'],
  lens_replacement: ['schimb lentile', 'inlocuire sticle'],
  metal_frame_soldering: ['sudura rame', 'lipire rama metalica'],
  oculoplastics_consultation: ['oculoplastica', 'pleoape', 'orbita', 'orbitei'],
};

const GROUP_SEARCH_HINTS = {
  business_attributes: ['optiuni locatie', 'acces servicii'],
  optical_retail: ['optica', 'ochelari', 'rame'],
  lenses_and_measurements: ['lentile ochelari', 'masuratori optice'],
  optometry: ['control vedere', 'dioptrii'],
  contact_lenses: ['lentile de contact'],
  ophthalmology_consults: ['consult ochi', 'oftalmolog'],
  investigations: ['investigatii ochi', 'aparatura oftalmologica'],
  specialties: ['specialist ochi', 'afectiuni oculare'],
  procedures_surgery: ['proceduri ochi', 'chirurgie ochi'],
  children_and_prevention: ['ochi copii', 'vedere copii'],
  technical_activities: ['atelier optic', 'reparatii ochelari'],
  b2b_capabilities: ['servicii b2b optica'],
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function aliasesForKey(key) {
  return Object.entries(LEGACY_SERVICE_ALIASES)
    .filter(([, canonical]) => canonical === key)
    .map(([legacy]) => legacy);
}

function profileRulesForGroup(group) {
  const applicable = [];
  const hidden = [];
  for (const profileType of PROFILE_TYPES) {
    const layout = SERVICE_GROUP_LAYOUTS[profileType];
    if ((layout?.hidden || []).includes(group)) hidden.push(profileType);
    else if ([...(layout?.primary || []), ...(layout?.secondary || [])].includes(group)) applicable.push(profileType);
  }
  return { applicable, hidden };
}

function keywordsForDefinition(definition) {
  const group = SERVICE_GROUPS[definition.group];
  const aliases = definition.aliases || aliasesForKey(definition.key);
  return [...new Set([
    definition.label,
    normalizeText(definition.label),
    group?.label,
    ...(GROUP_SEARCH_HINTS[definition.group] || []),
    ...aliases,
    ...aliases.map((value) => value.replaceAll('_', ' ')),
    ...(SPECIFIC_SEARCH_KEYWORDS[definition.key] || []),
  ].map((value) => String(value || '').trim()).filter(Boolean))];
}

function addGroupAndKeys() {
  SERVICE_GROUPS.business_attributes = {
    label: 'Opțiuni generale ale locației',
    helper: 'Atribute comerciale și de acces valabile la nivelul întregii locații.',
    ids: {
      cas_reimbursed_services: NEW_KEYS.cas_reimbursed_services.label,
      onsite_eye_testing_b2b: NEW_KEYS.onsite_eye_testing_b2b.label,
    },
  };
  SERVICE_GROUPS.optical_retail.ids.computer_screen_glasses = NEW_KEYS.computer_screen_glasses.label;
  SERVICE_GROUPS.children_and_prevention.ids.myopia_control_spectacle_lenses = NEW_KEYS.myopia_control_spectacle_lenses.label;
  SERVICE_GROUPS.contact_lenses.ids.orthokeratology = 'Lentile de noapte / Ortokeratologie';
  SERVICE_GROUPS.children_and_prevention.ids.vision_therapy = 'Ortoptică și exerciții vizuale (pentru ambliopie/strabism)';
  SERVICE_GROUPS.optometry.ids.optometry_consultation = 'Consult optometric complet';
  SERVICE_GROUPS.children_and_prevention.ids.children_eye_exam = 'Consult oftalmologic/optometric pediatric';

  for (const [profileType, layout] of Object.entries(SERVICE_GROUP_LAYOUTS)) {
    if (['optical_laboratory_b2b', 'future_b2b_distributor'].includes(profileType)) {
      if (!layout.hidden.includes('business_attributes')) layout.hidden.push('business_attributes');
      continue;
    }
    if (!layout.primary.includes('business_attributes') && !layout.secondary.includes('business_attributes')) {
      layout.secondary.unshift('business_attributes');
    }
  }
  for (const layout of Object.values(LEGACY_PROVIDER_TYPE_LAYOUTS)) {
    if (!layout.primary.includes('business_attributes') && !layout.secondary.includes('business_attributes') && !layout.hidden.includes('business_attributes')) {
      layout.secondary.unshift('business_attributes');
    }
  }
  if (!CLAIM_PREP_SERVICE_GROUPS.includes('business_attributes')) CLAIM_PREP_SERVICE_GROUPS.unshift('business_attributes');

  Object.assign(LEGACY_SERVICE_ALIASES, {
    microscopie_endoteliala: 'specular_microscopy',
    servicii_cas: 'cas_reimbursed_services',
    testare_la_sediu: 'onsite_eye_testing_b2b',
    ochelari_calculator: 'computer_screen_glasses',
    lentile_noapte: 'orthokeratology',
    stellest_miyosmart: 'myopia_control_spectacle_lenses',
    ortoptica: 'vision_therapy',
  });

  for (const [key, config] of Object.entries(NEW_KEYS)) {
    if (CANONICAL_SERVICE_KEY_SET.has(key)) continue;
    const rules = profileRulesForGroup(config.group);
    const aliases = aliasesForKey(key);
    const publicImmediately = true;
    CANONICAL_SERVICE_REGISTRY[key] = {
      key,
      label: config.label,
      group: config.group,
      kind: config.kind,
      patient_facing: true,
      b2b_only: false,
      service_need_level: config.need,
      default_confirmation_level: 'provider_confirmed',
      requires_review: Boolean(config.review),
      requires_verified_specialist: Boolean(config.specialist),
      required_professional_types: [...(config.professionalTypes || [])],
      requires_equipment: Boolean(config.equipment?.length),
      required_equipment_types: [...(config.equipment || [])],
      requires_infrastructure: false,
      required_infrastructure_types: [],
      public_immediately: publicImmediately,
      matching_allowed_when_provider_confirmed: publicImmediately,
      applicable_profile_types: [...rules.applicable],
      hidden_for_profile_types: [...rules.hidden],
      aliases,
      legacy_keys: [...aliases],
      search_keywords: [],
    };
    CANONICAL_SERVICE_KEYS.push(key);
    CANONICAL_SERVICE_KEY_SET.add(key);
  }
}

addGroupAndKeys();

for (const definition of Object.values(CANONICAL_SERVICE_REGISTRY)) {
  definition.label = SERVICE_GROUPS[definition.group]?.ids?.[definition.key] || definition.label;
  definition.aliases = [...new Set([...(definition.aliases || []), ...aliasesForKey(definition.key)])];
  definition.legacy_keys = [...definition.aliases];
  definition.search_keywords = keywordsForDefinition(definition);
}

export function getCanonicalServiceDefinition(rawKey) {
  const definition = base.getCanonicalServiceDefinition(rawKey);
  return definition ? {
    ...definition,
    search_keywords: [...(CANONICAL_SERVICE_REGISTRY[definition.key]?.search_keywords || [])],
  } : null;
}

export function getServiceSearchKeywords(rawKey) {
  return getCanonicalServiceDefinition(rawKey)?.search_keywords || [];
}

export {
  AMBIGUOUS_LEGACY_SERVICE_KEYS,
  CANONICAL_SERVICE_KEYS,
  CANONICAL_SERVICE_KEY_SET,
  CANONICAL_SERVICE_REGISTRY,
  CLAIM_PREP_SERVICE_GROUPS,
  LEGACY_PROVIDER_TYPE_LAYOUTS,
  LEGACY_SERVICE_ALIASES,
  PROFILE_TYPES,
  SERVICE_GROUP_LAYOUTS,
  SERVICE_GROUPS,
};

export const classifyServiceNeedLevel = base.classifyServiceNeedLevel;
export const getCanonicalServiceGroupIds = base.getCanonicalServiceGroupIds;
export const getServiceGroupLayout = base.getServiceGroupLayout;
export const isServiceMatchingEligible = base.isServiceMatchingEligible;
export const isServicePubliclyEligible = base.isServicePubliclyEligible;
export const normalizeServiceKey = base.normalizeServiceKey;
