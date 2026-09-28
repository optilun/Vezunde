// Ce tip de locatie recomandam intai: optica (optometrist) sau cabinet/clinica de oftalmologie.
//
// 2026-09-28, cerut explicit de owner ("pentru controale regulate fara alte afectiuni, reparatii
// sau cautarea unui model de ochelari ori brand de lentile sa fie recomandate inainte opticile...
// ia o decizie de expert"). Auditul, sursele si decizia: docs/audit-ai-cautare-recomandare-2026-09-24.md,
// sectiunea 18. Verificarile de aici blocheaza decizia:
//  - problema medicala, investigatie sau consult medical cerut -> doar cabinete;
//  - copil, nevoie neclara, lentile speciale -> intai cabinetele, opticile dupa;
//  - control de rutina, reteta, adaptarea lentilelor -> intai opticile, cabinetele ca alternativa;
//  - produse, branduri, reparatii -> opticile; cabinetele doar pe locurile ramase;
//  - o singura cheie medicala nu mai scoate toate opticile la o cerere de produs;
//  - anamneza si datele de contact nu intra in decizie.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCanonicalServiceDefinition } from '../shared/canonicalServiceRegistryExtended.js';
import {
  PROVIDER_TYPE_PREFERENCE_VERSION,
  providerCapability,
  providerTypePreferencePoints,
  providerTypeSecondaryNote,
  resolveProviderTypePreference,
  selectStructuralByPreference,
} from '../shared/providerTypePreference.js';
import {
  PATIENT_NEED_INTERPRETATION_EXAMPLES,
  PATIENT_NEED_INTERPRETATION_VERSION,
  buildPatientNeedPrompt,
} from '../shared/patientNeedInterpretation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
let checks = 0;
function check(name, fn) {
  try {
    fn();
    checks += 1;
  } catch (error) {
    error.message = `[${name}] ${error.message}`;
    throw error;
  }
}
const resolve = (intent, serviceKeys) => resolveProviderTypePreference({ intent, serviceKeys, getDefinition: getCanonicalServiceDefinition });

check('shared copies are identical', () => {
  assert.equal(source('shared/providerTypePreference.js'), source('base44/shared/providerTypePreference.js'));
  assert.equal(source('shared/patientNeedInterpretation.js'), source('base44/shared/patientNeedInterpretation.js'));
});

// Cheile sunt cele propuse de AI in testul live din 2026-09-28 (audit sectiunea 18).
check('decision matrix', () => {
  const cases = [
    ['control_vedere', ['optometry_consultation', 'refraction', 'visual_acuity_test'], 'optical_first', 'control de rutina'],
    ['control_vedere', ['ophthalmology_consultation', 'complete_eye_exam'], 'medical_only', 'medic cerut explicit'],
    ['simptome_oftalmologice', ['ophthalmology_consultation', 'diabetic_retinopathy', 'fundus_exam'], 'medical_only', 'diabet'],
    ['simptome_oftalmologice', ['ophthalmology_consultation'], 'medical_only', 'ochi rosu dureros'],
    ['investigatii', ['oct'], 'medical_only', 'trimitere OCT'],
    ['ochelari_lentile', ['eyeglasses', 'prescription_lenses'], 'optical_products', 'ochelari noi'],
    ['ochelari_lentile', ['frames', 'eyeglasses'], 'optical_products', 'rame Ray-Ban'],
    ['ochelari_lentile', ['progressive_lenses', 'prescription_lenses'], 'optical_products', 'lentile progresive'],
    ['ochelari_lentile', ['refraction', 'optometry_consultation', 'eyeglasses'], 'optical_first', 'reteta noua'],
    ['lentile_contact', ['contact_lenses'], 'optical_products', 'lentile purtate deja'],
    ['lentile_contact', ['contact_lenses', 'contact_lens_consultation', 'contact_lens_fitting'], 'optical_first', 'Acuvue cu adaptare propusa'],
    ['lentile_contact', ['contact_lens_consultation', 'contact_lens_fitting', 'contact_lens_trial'], 'optical_first', 'prima data'],
    ['lentile_contact', ['orthokeratology'], 'medical_first', 'ortokeratologie'],
    ['reparatii_ochelari', ['frame_repair', 'eyeglasses_repair'], 'optical_products', 'rama rupta'],
    ['control_copil', ['children_eye_exam', 'pediatric_refraction', 'visual_acuity_test'], 'medical_first', 'copil'],
    ['control_vedere', ['children_eye_exam', 'optometry_consultation'], 'medical_first', 'control pentru copil'],
    ['unknown', ['consult_oftalmologic', 'control_vedere_adulti'], 'medical_first', 'Nu sunt sigur'],
  ];
  for (const [intent, keys, mode, label] of cases) {
    const result = resolve(intent, keys);
    assert.equal(result.mode, mode, label);
    assert.equal(result.version, PROVIDER_TYPE_PREFERENCE_VERSION);
  }
  assert.deepEqual(resolve('simptome_oftalmologice', []).order, ['medical']);
  assert.deepEqual(resolve('unknown', []).order, ['medical', 'optical']);
  assert.deepEqual(resolve('control_vedere', []).order, ['optical', 'medical']);
  assert.equal(resolve('', []).mode, 'optical_products', 'cautarea libera fara chei ramane cu opticile primele');
});

// 2026-09-28, testul live dupa publicare: cautarea in text adauga chei inrudite (la "lentile de
// contact" si ortokeratologie sau lentile sclerale, la copii supraspecialitati). Tipul se decide
// doar pe cheile confirmate de pacient; aici se vede de ce.
check('text-expanded keys would mislead, confirmed keys decide', () => {
  const expandedLenses = ['contact_lenses', 'contact_lens_followup', 'orthokeratology', 'scleral_lenses', 'myopia_control_contact_lenses'];
  assert.equal(resolve('lentile_contact', expandedLenses).mode, 'medical_first', 'cu cheile din text ar iesi gresit');
  assert.equal(resolve('lentile_contact', ['contact_lenses']).mode, 'optical_products', 'cu cheile confirmate iese corect');
  assert.equal(resolve('control_copil', ['children_eye_exam', 'strabismus_consultation', 'pediatric_ophthalmology']).mode, 'medical_first', 'copilul nu pierde opticile nici cu supraspecialitati');
  assert.equal(resolveProviderTypePreference({ intent: 'lentile_contact', serviceKeys: ['contact_lens_fitting'], text: 'am keratocon si vreau lentile', getDefinition: getCanonicalServiceDefinition }).mode, 'medical_first');
  assert.equal(resolveProviderTypePreference({ intent: 'lentile_contact', serviceKeys: ['contact_lens_fitting'], text: 'am cheratocon', getDefinition: getCanonicalServiceDefinition }).reason, 'keratoconus');
  for (const file of ['base44/functions/matchProvidersSemantic/entry.ts', 'base44/functions/matchProviders/entry.ts']) {
    const entry = source(file);
    assert.match(entry, /Array\.isArray\(payload\.need_service_keys\)/, file);
    assert.match(entry, /serviceKeys: needServiceKeys\.length > 0 \? needServiceKeys : /, file);
  }
  assert.match(source('base44/functions/matchProvidersSemantic/entry.ts'), /text: searchText,\n      getDefinition: getCanonicalServiceDefinition,/);
  const client = source('src/lib/providerSemanticSearch.js');
  assert.equal(client.match(/need_service_keys: explicitKeys,/g)?.length, 2, 'clientul trimite cheile confirmate la ambele functii');
});

check('provider capability and score points', () => {
  assert.equal(providerCapability({ provider_type: 'optica_medicala' }), 'optical');
  assert.equal(providerCapability({ provider_type: 'clinica_oftalmologica' }), 'medical');
  assert.equal(providerCapability({ provider_profile_type: 'optical_chain' }), 'optical');
  assert.equal(providerCapability({ provider_type: 'altceva' }), null);
  const routine = resolve('control_vedere', ['optometry_consultation']);
  assert.equal(providerTypePreferencePoints(routine, { provider_type: 'optica_medicala' }, 15), 15);
  assert.equal(providerTypePreferencePoints(routine, { provider_type: 'cabinet_oftalmologic' }, 15), 0);
  const child = resolve('control_copil', ['children_eye_exam']);
  assert.equal(providerTypePreferencePoints(child, { provider_type: 'cabinet_oftalmologic' }, 15), 15);
  assert.equal(providerTypePreferencePoints(child, { provider_type: 'optica_medicala' }, 15), 0, 'optica ramane, fara puncte');
  assert.equal(providerTypePreferencePoints(routine, { provider_type: 'altceva' }, 15), 0);
});

const optics = Array.from({ length: 20 }, (_, index) => ({ id: `o${index}`, structural_capability: 'optical' }));
const medical = Array.from({ length: 10 }, (_, index) => ({ id: `m${index}`, structural_capability: 'medical' }));
const mixed = [medical[0], optics[0], optics[1], medical[1], ...optics.slice(2), ...medical.slice(2)];
const count = (list, capability) => list.filter((entry) => entry.structural_capability === capability).length;

check('structural allocation keeps the other type visible when it is an alternative', () => {
  const medicalOnly = selectStructuralByPreference(mixed, resolve('simptome_oftalmologice', []), { maxResults: 12 });
  assert.equal(medicalOnly.length, 10);
  assert.equal(count(medicalOnly, 'optical'), 0, 'la o problema medicala opticile nu intra');
  const medicalFirst = selectStructuralByPreference(mixed, resolve('control_copil', []), { maxResults: 12 });
  assert.deepEqual([count(medicalFirst, 'medical'), count(medicalFirst, 'optical')], [8, 4]);
  assert.equal(medicalFirst[0].structural_capability, 'medical');
  const opticalFirst = selectStructuralByPreference(mixed, resolve('control_vedere', ['optometry_consultation']), { maxResults: 12 });
  assert.deepEqual([count(opticalFirst, 'optical'), count(opticalFirst, 'medical')], [8, 4], 'la control, cabinetele raman ca alternativa');
  assert.deepEqual(opticalFirst.slice(0, 3).map((entry) => entry.id), ['o0', 'o1', 'o2'], 'ordinea primita se pastreaza');
  const products = selectStructuralByPreference(mixed, resolve('reparatii_ochelari', ['frame_repair']), { maxResults: 12 });
  assert.deepEqual([count(products, 'optical'), count(products, 'medical')], [12, 0], 'la reparatii, doar optici cand sunt destule');
});

check('structural allocation fills free places and works for the small fallback', () => {
  const fewOptics = [optics[0], optics[1], optics[2], ...medical];
  const opticalFirst = selectStructuralByPreference(fewOptics, resolve('control_vedere', ['optometry_consultation']), { maxResults: 12 });
  assert.deepEqual([count(opticalFirst, 'optical'), count(opticalFirst, 'medical')], [3, 9]);
  const products = selectStructuralByPreference(fewOptics, resolve('ochelari_lentile', ['eyeglasses']), { maxResults: 12 });
  assert.deepEqual([count(products, 'optical'), count(products, 'medical')], [3, 9], 'fara optici destule, cabinetele completeaza lista');
  const small = selectStructuralByPreference(
    mixed.map((entry) => ({ capability: entry.structural_capability, id: entry.id })),
    resolve('control_vedere', ['optometry_consultation']),
    { maxResults: 3, capabilityOf: (entry) => entry.capability },
  );
  assert.deepEqual(small.map((entry) => entry.capability), ['optical', 'optical', 'medical']);
  assert.deepEqual(selectStructuralByPreference([], resolve('control_vedere', []), { maxResults: 12 }), []);
});

check('secondary group notes', () => {
  assert.match(providerTypeSecondaryNote(resolve('control_vedere', ['optometry_consultation'])), /consult medical complet/);
  assert.match(providerTypeSecondaryNote(resolve('control_copil', [])), /ochelari sau lentile/);
  assert.equal(providerTypeSecondaryNote(resolve('reparatii_ochelari', ['frame_repair'])), '');
  assert.equal(providerTypeSecondaryNote(resolve('simptome_oftalmologice', [])), '');
});

check('the policy never reads anamnesis or contact data', () => {
  const policy = source('shared/providerTypePreference.js');
  const code = policy.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /anamnez|contact_email|contact_phone|age_years|answers/);
});

check('both matching functions use the policy instead of the need level', () => {
  for (const file of ['base44/functions/matchProvidersSemantic/entry.ts', 'base44/functions/matchProviders/entry.ts']) {
    const entry = source(file);
    assert.match(entry, /from '\.\.\/\.\.\/shared\/providerTypePreference\.js'/, file);
    assert.match(entry, /resolveProviderTypePreference\(\{/, file);
    assert.match(entry, /selectStructuralByPreference\(orderedCandidates, typePreference/, file);
    assert.match(entry, /providerTypePreferencePoints\(typePreference, (location|loc), PROVIDER_TYPE_PREFERENCE_POINTS\)/, file);
    assert.match(entry, /provider_type_preference: \{/, file);
    assert.match(entry, /structural_group_note/, file);
    assert.doesNotMatch(entry, /const preferredCapabilities = needLevel === 'specialized_medical'/, `${file}: regula veche, pe nivelul nevoii, nu mai exista`);
  }
  const semantic = source('base44/functions/matchProvidersSemantic/entry.ts');
  assert.match(semantic, /const PROVIDER_TYPE_PREFERENCE_POINTS = 15;/);
  assert.match(semantic, /recommendation_score_components: \{ \.\.\.score\.components, provider_type_fit: providerTypePoints \}/);
  assert.match(semantic, /serviceKeys: requestedKeys,/);
  assert.match(source('base44/functions/matchProviders/entry.ts'), /const PROVIDER_TYPE_PREFERENCE_POINTS = 3;/);
});

check('results page shows each type as its own group, in the order received', () => {
  const results = source('src/components/intake2/MatchResults.jsx');
  assert.match(results, /const structuralGroups = structural\.reduce/);
  assert.match(results, /structuralGroups\.map\(\(group, groupIndex\)/);
  assert.match(results, /group\.note &&/);
  assert.match(results, /provider_type_mode: activeMeta\?\.provider_type_preference\?\.mode/);
  assert.match(results, /Sunteți reprezentantul uneia dintre acestea\?/);
  assert.match(source('src/components/intake2/ConversationalCard.jsx'), /provider_type_preference: res\.data\.provider_type_preference \|\| null/);
});

check('the AI prompt separates products, routine optometry and medical care', () => {
  assert.equal(PATIENT_NEED_INTERPRETATION_VERSION, 'patient-need-ai-v2.2');
  const prompt = JSON.stringify(buildPatientNeedPrompt({ search_text: 'vreau lentile de contact Acuvue' }));
  assert.match(prompt, /already wears contact lenses and wants to buy or replace them/);
  assert.match(prompt, /new prescription, new diopters or an eye test for glasses/);
  assert.match(prompt, /A brand or model of frames, glasses or sunglasses/);
  const acuvue = PATIENT_NEED_INTERPRETATION_EXAMPLES.find((example) => /Acuvue/.test(example.text));
  assert.deepEqual(acuvue.output.service_keys, ['contact_lenses']);
  assert.equal(resolve(acuvue.output.intent, acuvue.output.service_keys).mode, 'optical_products');
  const prescription = PATIENT_NEED_INTERPRETATION_EXAMPLES.find((example) => /reteta noua/.test(example.text));
  assert.equal(resolve(prescription.output.intent, prescription.output.service_keys).mode, 'optical_first');
  for (const example of PATIENT_NEED_INTERPRETATION_EXAMPLES) {
    for (const key of example.output.service_keys) assert.ok(getCanonicalServiceDefinition(key), `${example.text}: ${key}`);
  }
});

console.log(`Provider type preference checks passed: ${checks}.`);
