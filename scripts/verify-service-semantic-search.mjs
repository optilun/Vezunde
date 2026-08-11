import assert from 'node:assert/strict';
import {
  CANONICAL_SERVICE_KEYS,
  getCanonicalServiceDefinition,
  getServiceSearchKeywords,
  isServiceMatchingEligible,
} from '../shared/canonicalServiceRegistryExtended.js';
import {
  getProviderServiceSections,
  getServiceOperationalContext,
  getServiceSearchTerms,
  validateOperationalTaxonomy,
} from '../shared/serviceOperationalTaxonomyExtended.js';
import { validateServiceConfigurationPayload } from '../shared/serviceConfigurationPayloadExtended.js';
import {
  getServiceSearchSuggestions,
  normalizeSemanticText,
  resolveServiceSearchQuery,
} from '../shared/serviceSemanticSearch.js';

function keys(query) {
  return resolveServiceSearchQuery(query, { limit: 12 }).service_keys;
}

for (const serviceKey of CANONICAL_SERVICE_KEYS) {
  const definition = getCanonicalServiceDefinition(serviceKey);
  assert.ok(definition, `Definiție lipsă pentru ${serviceKey}`);
  assert.ok(Array.isArray(definition.search_keywords), `search_keywords lipsește pentru ${serviceKey}`);
  assert.ok(definition.search_keywords.length >= 2, `search_keywords insuficiente pentru ${serviceKey}`);
  assert.deepEqual(definition.search_keywords, getServiceSearchKeywords(serviceKey));
}

for (const requiredKey of [
  'home_visit_eye_care',
  'workplace_vision_screening',
  'computer_screen_glasses',
  'orthokeratology',
  'myopia_control_spectacle_lenses',
  'vision_therapy',
  'emergency_ophthalmology',
]) {
  assert.ok(getCanonicalServiceDefinition(requiredKey), `Macro-serviciu lipsă: ${requiredKey}`);
}

assert.equal(
  getCanonicalServiceDefinition('orthokeratology').label,
  'Lentile de noapte / Ortokeratologie',
);
assert.match(
  getCanonicalServiceDefinition('myopia_control_spectacle_lenses').label,
  /Stellest.*MiYOSMART/i,
);
assert.match(getCanonicalServiceDefinition('vision_therapy').label, /Ortoptică/i);
assert.ok(
  getServiceSearchKeywords('specular_microscopy')
    .map(normalizeSemanticText)
    .includes('microscopie endoteliala'),
  'Microscopie endotelială trebuie să fie sinonim direct',
);

const taxonomy = validateOperationalTaxonomy();
assert.equal(taxonomy.valid, true, JSON.stringify(taxonomy));
assert.equal(getServiceOperationalContext('emergency_ophthalmology').unitKey, 'ophthalmology_office');
assert.equal(getServiceOperationalContext('home_visit_eye_care').scope, 'location');
assert.equal(getServiceOperationalContext('workplace_vision_screening').scope, 'location');

const extendedPayload = validateServiceConfigurationPayload({
  selected_ids: {
    business_attributes: ['home_visit_eye_care', 'workplace_vision_screening'],
    optical_retail: ['computer_screen_glasses'],
    children_and_prevention: ['myopia_control_spectacle_lenses', 'vision_therapy'],
    contact_lenses: ['orthokeratology'],
  },
  removal_ids: {},
  raw_removal_keys: [],
  suggestions: [],
  functional_units: [
    { unit_key: 'optical_store', care_setting: 'retail_only' },
    { unit_key: 'optometry_cabinet', care_setting: 'outpatient' },
  ],
  capabilities: [
    { capability_key: 'contact_lens_professional_services', parent_unit_key: 'optometry_cabinet' },
    { capability_key: 'pediatric_eye_care', parent_unit_key: 'optometry_cabinet' },
  ],
  service_unit_map: {
    computer_screen_glasses: 'optical_store',
    myopia_control_spectacle_lenses: 'optometry_cabinet',
    vision_therapy: 'optometry_cabinet',
    orthokeratology: 'optometry_cabinet',
  },
  resource_links: { professionals: [], equipment: [], facilities: [] },
  care_setting: 'mixed',
});
assert.equal(extendedPayload.valid, true, extendedPayload.error || JSON.stringify(extendedPayload.fields));
assert.equal(Object.hasOwn(extendedPayload.clean.service_unit_map, 'home_visit_eye_care'), false, 'Atributul CAS are scope=location, nu unitate fizică');
assert.equal(Object.hasOwn(extendedPayload.clean.service_unit_map, 'workplace_vision_screening'), false, 'Testarea externă are scope=location, nu unitate fizică');

assert.deepEqual(
  extendedPayload.clean.selected_ids.business_attributes,
  ['home_visit_eye_care', 'workplace_vision_screening'],
);

const dryEye = keys('mă ustură ochii și am roșeață');
assert.ok(dryEye.includes('dry_eye_management'));
assert.ok(dryEye.includes('pachymeter'));

const blurry = keys('văd în ceață și mi-au crescut dioptriile');
assert.ok(blurry.includes('optometry_consultation'));
assert.ok(blurry.includes('refraction'));

const sun = keys('vreau ochelari heliomați sau lentile de soare cu dioptrii');
assert.ok(sun.includes('photochromic_lenses'));
assert.ok(sun.includes('prescription_sunglasses'));

const emergency = keys('mi-a intrat ceva în ochi și am o durere insuportabilă');
assert.ok(emergency.includes('emergency_ophthalmology'));

const children = keys('control ochelari copii, ochi leneș, medici copii');
assert.ok(children.includes('children_eye_exam'));
assert.ok(children.includes('pediatric_ophthalmology'));
assert.ok(children.includes('vision_therapy'));

const onsite = keys('testare ochelari la birou pentru angajați');
assert.ok(onsite.includes('workplace_vision_screening'));

const computer = keys('ochelari pentru calculator și protecție ecrane');
assert.ok(computer.includes('computer_screen_glasses'));
assert.ok(computer.includes('blue_light_lenses'));

const myopia = keys('lentile de noapte Stellest Miyosmart pentru controlul miopiei');
assert.ok(myopia.includes('orthokeratology'));
assert.ok(myopia.includes('myopia_control_spectacle_lenses'));

const endothelial = keys('microscopie endotelială');
assert.equal(endothelial[0], 'specular_microscopy');

const dryEyeMatches = resolveServiceSearchQuery('mă ustură ochii, am ochi uscați și roșeață').matches;
assert.ok(dryEyeMatches.find((match) => match.service_key === 'dry_eye_management')?.score > dryEyeMatches.find((match) => match.service_key === 'pachymeter')?.score, 'Pahimetria trebuie să rămână o sugestie secundară pentru ochi uscat');

const suggestions = getServiceSearchSuggestions('lentile', { limit: 6 });
assert.ok(suggestions.length > 0);
assert.ok(suggestions.every((suggestion) => suggestion.label && suggestion.service_key && suggestion.category && Number.isFinite(suggestion.score)));
assert.ok(suggestions.some((suggestion) => suggestion.service_key === 'orthokeratology'));

const allOperationalText = JSON.stringify(getProviderServiceSections());
assert.ok(allOperationalText.includes('orbitei'));
assert.ok(!allOperationalText.includes('orbiței'));
assert.ok(!allOperationalText.includes('orbij'));
assert.ok(getServiceSearchTerms('specular_microscopy').map(normalizeSemanticText).includes('microscopie endoteliala'));

const b2bOnly = keys('distributie rame pentru parteneri b2b');
assert.ok(!b2bOnly.includes('wholesale_frames'), 'Capabilitățile B2B-only nu trebuie rezolvate pentru căutarea pacienților');

assert.equal(
  isServiceMatchingEligible(
    { service_key: 'emergency_ophthalmology', confirmation_level: 'provider_confirmed', matching_allowed: true },
    { active_status: 'activa', profile_control_status: 'claimed' },
  ),
  true,
  'Un serviciu medical declarat de furnizor este eligibil pentru matching fără verificare separată',
);
const unknown = resolveServiceSearchQuery('serviciu complet inventat zzzzz');
assert.equal(unknown.matches.length, 0);

console.log(`Semantic catalog keys: ${CANONICAL_SERVICE_KEYS.length}`);
console.log('Service semantic search mapping: PASS');
