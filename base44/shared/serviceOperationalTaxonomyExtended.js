import * as base from './serviceOperationalTaxonomy.js';
import {
  CANONICAL_SERVICE_KEYS,
  getCanonicalServiceDefinition,
  getServiceSearchKeywords,
} from './canonicalServiceRegistryExtended.js';

const {
  CURATED_SERVICE_SEARCH_SYNONYMS,
  PROVIDER_SERVICE_SECTIONS,
  PUBLIC_NEED_SECTIONS,
  SERVICE_OPERATIONAL_CONTEXT,
} = base;

const MOVED_MYOPIA_KEYS = new Set([
  'myopia_management',
  'orthokeratology',
  'myopia_control_contact_lenses',
  'myopia_control_children',
  'myopia_control_spectacle_lenses',
]);

function item(group, id) {
  return { group, id };
}

function addUniqueItem(section, group, id) {
  if (!section || section.items.some((entry) => entry.id === id)) return;
  section.items.push(item(group, id));
}

function removeItems(keys) {
  for (const section of PROVIDER_SERVICE_SECTIONS) {
    section.items = section.items.filter((entry) => !keys.has(entry.id));
  }
}

function addPublicNeed(key, label, index = PUBLIC_NEED_SECTIONS.length) {
  if (PUBLIC_NEED_SECTIONS.some((entry) => entry.key === key)) return;
  PUBLIC_NEED_SECTIONS.splice(index, 0, { key, label });
}

function applyTaxonomyExtensions() {
  removeItems(MOVED_MYOPIA_KEYS);

  const opticalProducts = PROVIDER_SERVICE_SECTIONS.find((section) => section.key === 'optical_products');
  addUniqueItem(opticalProducts, 'optical_retail', 'computer_screen_glasses');
  opticalProducts.searchTerms = [...new Set([
    ...(opticalProducts.searchTerms || []),
    'ochelari calculator',
    'protectie ecrane',
    'ochelari lumina albastra',
  ])];

  const investigations = PROVIDER_SERVICE_SECTIONS.find((section) => section.key === 'ophthalmology_investigations');
  investigations.searchTerms = [...new Set([
    ...(investigations.searchTerms || []),
    'microscopie endoteliala',
    'endoteliu cornean',
  ])];

  const oculoplastics = PROVIDER_SERVICE_SECTIONS.find((section) => section.key === 'oculoplastics_lacrimal');
  if (oculoplastics) {
    oculoplastics.description = 'Evaluarea afecțiunilor pleoapelor, orbitei și sistemului lacrimal.';
    oculoplastics.searchTerms = (oculoplastics.searchTerms || [])
      .filter((term) => term !== 'orbij' && term !== 'orbiței')
      .concat(['orbita', 'orbitei']);
  }

  const emergency = PROVIDER_SERVICE_SECTIONS.find((section) => section.key === 'emergency_trauma');
  if (emergency) {
    emergency.unitKey = 'ophthalmology_office';
    emergency.searchTerms = [...new Set([
      ...(emergency.searchTerms || []),
      'mi a intrat ceva in ochi',
      'durere insuportabila',
      'pierdere brusca vedere',
    ])];
  }

  const businessSection = {
    key: 'business_attributes',
    unitKey: 'optical_store',
    fallbackUnitKeys: [
      'optical_cabinet',
      'optometry_cabinet',
      'ophthalmology_office',
      'ophthalmology_diagnostics',
      'optical_laboratory',
      'b2b_distribution_center',
    ],
    capabilityKey: null,
    scope: 'location',
    area: 'business_attributes',
    kind: 'service',
    title: 'Decontare și servicii în afara locației',
    publicNeedKey: 'business_options',
    publicLabel: 'Decontare CAS și servicii la sediu/domiciliu',
    description: 'Opțiuni valabile la nivelul întregii locații, indiferent de cabinetul sau spațiul în care se desfășoară activitatea.',
    searchTerms: [
      'cas',
      'cnas',
      'decontare',
      'bilet de trimitere',
      'testare la domiciliu',
      'control vedere la sediu',
      'testare angajati',
      'screening firma',
    ],
    items: [
      item('business_attributes', 'cas_reimbursed_services'),
      item('business_attributes', 'onsite_eye_testing_b2b'),
    ],
  };

  const myopiaSection = {
    key: 'myopia_management',
    unitKey: 'optometry_cabinet',
    fallbackUnitKeys: ['ophthalmology_office'],
    capabilityKey: null,
    area: 'medical_specialties',
    kind: 'myopia_management',
    title: 'Managementul miopiei',
    publicNeedKey: 'myopia_management',
    publicLabel: 'Managementul miopiei',
    description: 'Evaluare, monitorizare și soluții pentru încetinirea progresiei miopiei, inclusiv lentile speciale pentru ochelari.',
    searchTerms: [
      'management miopie',
      'control miopie',
      'miopie progresiva',
      'incetinire miopie',
      'stellest',
      'miyosmart',
      'lentile control miopie',
    ],
    items: [
      item('specialties', 'myopia_management'),
      item('children_and_prevention', 'myopia_control_children'),
      item('children_and_prevention', 'myopia_control_spectacle_lenses'),
    ],
  };

  const myopiaContactSection = {
    key: 'myopia_contact_lenses',
    unitKey: 'optometry_cabinet',
    fallbackUnitKeys: ['ophthalmology_office'],
    capabilityKey: 'contact_lens_professional_services',
    area: 'medical_specialties',
    kind: 'myopia_management',
    title: 'Lentile de noapte și lentile de contact pentru controlul miopiei',
    publicNeedKey: 'myopia_management',
    publicLabel: 'Managementul miopiei',
    description: 'Ortokeratologie și lentile de contact speciale, declarate ca fiind disponibile în această locație.',
    searchTerms: [
      'lentile de noapte',
      'ortokeratologie',
      'ortho k',
      'lentile contact control miopie',
      'fara ochelari ziua',
    ],
    items: [
      item('contact_lenses', 'orthokeratology'),
      item('contact_lenses', 'myopia_control_contact_lenses'),
    ],
  };

  const existingBusiness = PROVIDER_SERVICE_SECTIONS.findIndex((section) => section.key === businessSection.key);
  if (existingBusiness >= 0) PROVIDER_SERVICE_SECTIONS.splice(existingBusiness, 1);
  PROVIDER_SERVICE_SECTIONS.unshift(businessSection);

  const corneaIndex = PROVIDER_SERVICE_SECTIONS.findIndex((section) => section.key === 'cornea_surface');
  const insertionIndex = corneaIndex >= 0 ? corneaIndex + 1 : PROVIDER_SERVICE_SECTIONS.length;
  PROVIDER_SERVICE_SECTIONS.splice(insertionIndex, 0, myopiaSection, myopiaContactSection);

  addPublicNeed('business_options', 'Decontare CAS și servicii la sediu/domiciliu', 0);
  const corneaNeedIndex = PUBLIC_NEED_SECTIONS.findIndex((entry) => entry.key === 'cornea_dry_eye');
  addPublicNeed('myopia_management', 'Managementul miopiei', corneaNeedIndex >= 0 ? corneaNeedIndex + 1 : PUBLIC_NEED_SECTIONS.length);

  Object.assign(CURATED_SERVICE_SEARCH_SYNONYMS, {
    cas_reimbursed_services: ['servicii decontate cas', 'decontare cas', 'cnas', 'bilet de trimitere'],
    onsite_eye_testing_b2b: ['testare ochelari la birou', 'testare angajati', 'control vedere la sediu', 'testare la domiciliu'],
    computer_screen_glasses: ['ochelari calculator', 'protectie ecrane', 'ochelari lumina albastra'],
    orthokeratology: ['lentile de noapte', 'ortokeratologie', 'ortho k'],
    myopia_control_spectacle_lenses: ['stellest', 'miyosmart', 'mi yosmart', 'lentile control miopie'],
    vision_therapy: ['ortoptica', 'exercitii vizuale', 'terapie ambliopie', 'exercitii strabism'],
    specular_microscopy: ['microscopie endoteliala', 'endoteliu cornean'],
    dry_eye_management: ['ma ustura ochii', 'ochi uscati', 'roseata', 'nisip in ochi'],
    pachymeter: ['pahimetrie', 'grosime cornee', 'ochi uscati', 'roseata'],
    optometry_consultation: ['vad in ceata', 'control ochelari', 'mi au crescut dioptriile'],
    photochromic_lenses: ['ochelari heliomati', 'lentile heliomate'],
    prescription_sunglasses: ['lentile de soare cu dioptrii', 'ochelari de soare cu dioptrii'],
    emergency_ophthalmology: ['mi a intrat ceva in ochi', 'durere insuportabila', 'durere oculara brusca'],
    children_eye_exam: ['control ochelari copii', 'medici copii'],
    pediatric_ophthalmology: ['oftalmolog copii', 'medic ochi copii'],
  });

  for (const serviceKey of CANONICAL_SERVICE_KEYS) {
    CURATED_SERVICE_SEARCH_SYNONYMS[serviceKey] = [...new Set([
      ...(CURATED_SERVICE_SEARCH_SYNONYMS[serviceKey] || []),
      ...getServiceSearchKeywords(serviceKey),
    ])];
  }

  for (const key of Object.keys(SERVICE_OPERATIONAL_CONTEXT)) delete SERVICE_OPERATIONAL_CONTEXT[key];
  Object.assign(SERVICE_OPERATIONAL_CONTEXT, Object.fromEntries(
    PROVIDER_SERVICE_SECTIONS.flatMap((section) => section.items.map((entry) => [entry.id, {
      serviceKey: entry.id,
      group: entry.group,
      sectionKey: section.key,
      unitKey: section.unitKey,
      fallbackUnitKeys: [...(section.fallbackUnitKeys || [])],
      capabilityKey: section.capabilityKey || null,
      publicNeedKey: section.publicNeedKey || null,
      kind: section.kind,
      scope: section.key === 'business_attributes' ? 'location' : 'unit',
    }])),
  ));
}

applyTaxonomyExtensions();

export function getServiceOperationalContext(serviceKey) {
  const context = SERVICE_OPERATIONAL_CONTEXT[String(serviceKey || '').trim()];
  return context ? {
    ...context,
    fallbackUnitKeys: [...(context.fallbackUnitKeys || [])],
  } : null;
}

export function getProviderServiceSections() {
  return PROVIDER_SERVICE_SECTIONS.map((section) => ({
    ...section,
    searchTerms: [...(section.searchTerms || [])],
    fallbackUnitKeys: [...(section.fallbackUnitKeys || [])],
    items: section.items.map((entry) => ({ ...entry })),
  }));
}

export function getPublicNeedSections() {
  return PUBLIC_NEED_SECTIONS.map((section) => ({ ...section }));
}

export function getServiceSearchTerms(serviceKey) {
  const definition = getCanonicalServiceDefinition(serviceKey);
  const context = getServiceOperationalContext(serviceKey);
  const section = PROVIDER_SERVICE_SECTIONS.find((entry) => entry.key === context?.sectionKey);
  return [...new Set([
    definition?.label,
    ...(definition?.aliases || []),
    ...(definition?.search_keywords || []),
    ...(section?.searchTerms || []),
    ...(CURATED_SERVICE_SEARCH_SYNONYMS[serviceKey] || []),
  ].filter(Boolean))];
}

export function validateOperationalTaxonomy() {
  const flattened = PROVIDER_SERVICE_SECTIONS.flatMap((section) => section.items.map((entry) => entry.id));
  const duplicates = flattened.filter((key, index) => flattened.indexOf(key) !== index);
  const canonical = new Set(CANONICAL_SERVICE_KEYS);
  const unknown = flattened.filter((key) => !canonical.has(key));
  const missing = CANONICAL_SERVICE_KEYS.filter((key) => !flattened.includes(key));
  return {
    valid: duplicates.length === 0 && unknown.length === 0 && missing.length === 0,
    duplicates: [...new Set(duplicates)],
    unknown: [...new Set(unknown)],
    missing,
    total: flattened.length,
  };
}

export {
  CURATED_SERVICE_SEARCH_SYNONYMS,
  PROVIDER_SERVICE_SECTIONS,
  PUBLIC_NEED_SECTIONS,
  SERVICE_OPERATIONAL_CONTEXT,
};
