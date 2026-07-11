import assert from 'node:assert/strict';
import {
  CANONICAL_SERVICE_KEYS,
  getCanonicalServiceDefinition,
  getServiceSearchKeywords,
} from '../shared/canonicalServiceRegistryExtended.js';
import {
  getServiceOperationalContext,
  validateOperationalTaxonomy,
} from '../shared/serviceOperationalTaxonomyExtended.js';
import {
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
  'cas_reimbursed_services',
  'onsite_eye_testing_b2b',
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
assert.equal(getServiceOperationalContext('cas_reimbursed_services').scope, 'location');
assert.equal(getServiceOperationalContext('onsite_eye_testing_b2b').scope, 'location');

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
assert.ok(onsite.includes('onsite_eye_testing_b2b'));

const computer = keys('ochelari pentru calculator și protecție ecrane');
assert.ok(computer.includes('computer_screen_glasses'));
assert.ok(computer.includes('blue_light_lenses'));

const myopia = keys('lentile de noapte Stellest Miyosmart pentru controlul miopiei');
assert.ok(myopia.includes('orthokeratology'));
assert.ok(myopia.includes('myopia_control_spectacle_lenses'));

const endothelial = keys('microscopie endotelială');
assert.equal(endothelial[0], 'specular_microscopy');

const unknown = resolveServiceSearchQuery('serviciu complet inventat zzzzz');
assert.equal(unknown.matches.length, 0);

console.log(`Semantic catalog keys: ${CANONICAL_SERVICE_KEYS.length}`);
console.log('Service semantic search mapping: PASS');
