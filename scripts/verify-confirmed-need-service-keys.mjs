// Cheile de serviciu gasite in textul pacientului, cand nevoia lui e confirmata.
//
// 2026-09-25, decizia owner-ului (docs/audit-ai-cautare-recomandare-2026-09-24.md, 11.2).
// Verificarile de aici blocheaza regula din shared/confirmedNeedServiceKeys.js:
//  1. fara nevoie confirmata (cautarea libera din /cauta), cheile raman reuniunea de pana acum;
//  2. cu nevoie confirmata, o cheie gasita in text ramane doar daca e din familia nevoii, iar
//     la reparatii, ochelari si lentile de contact nu poate ridica cererea la
//     `specialized_medical`; cheile explicite raman toate;
//  3. browserul si serverul aplica aceeasi regula, cu registrul pe care il folosesc deja, iar
//     copiile din shared/ si base44/shared/ sunt identice;
//  4. 2026-09-26, keratocon: cand textul il pomeneste, lentilele de contact si nevoile medicale
//     pastreaza adaptarea speciala si consulturile medicale, iar pacientul e trimis la specialist.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { INTENTS, detectSubIntentPrefill } from '../src/lib/intentRegistry.js';
import { resolveServiceSearchQuery } from '../shared/serviceSemanticSearch.js';
import { buildPatientVisitGuidance } from '../src/lib/patientVisitGuidance.js';
import {
  SERVICE_GROUPS,
  getCanonicalServiceDefinition,
} from '../shared/canonicalServiceRegistryExtended.js';
import {
  CONFIRMED_NEED_SERVICE_GROUPS,
  filterTextServiceKeysForConfirmedNeed,
} from '../shared/confirmedNeedServiceKeys.js';

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

const NEED_ORDER = { general: 0, technical: 1, specialized_medical: 2, unknown: 3 };

function needLevel(keys, getDefinition = getCanonicalServiceDefinition) {
  let result = 'general';
  for (const key of keys) {
    const level = getDefinition(key)?.service_need_level || 'unknown';
    if (NEED_ORDER[level] > NEED_ORDER[result]) result = level;
  }
  return result;
}

// Aceleasi chei explicite ca in ConversationalCard (initState): lista categoriei, plus
// varianta precompletata din mesaj, cand exista.
function explicitKeysFor(intent, text) {
  let keys = [...INTENTS[intent].service_keys];
  const prefill = detectSubIntentPrefill(intent, text);
  if (prefill) {
    const question = INTENTS[intent].questions.find((item) => item.key === prefill.question_key);
    const option = question?.options?.find((item) => item.key === prefill.option_key);
    if (option?.service_keys) {
      keys = option.replace_service_keys === true
        ? [...option.service_keys]
        : [...new Set([...keys, ...option.service_keys])];
    }
  }
  return keys;
}

function filterFor(text, intent, resolver = resolveServiceSearchQuery, getDefinition = getCanonicalServiceDefinition) {
  const explicitKeys = explicitKeysFor(intent, text);
  const textKeys = resolver(text, { limit: 15, minScore: 0.34 }).service_keys;
  return {
    explicitKeys,
    textKeys,
    before: [...new Set([...explicitKeys, ...textKeys])],
    ...filterTextServiceKeysForConfirmedNeed({ intent, explicitKeys, textKeys, text, getDefinition }),
  };
}

// Formulari realiste, fara date de pacient, cate una sau mai multe pentru fiecare nevoie.
const CORPUS = [
  ['vreau sa fac un control la ochi, nu am mai fost de mult', 'control_vedere'],
  ['vreau un control oftalmologic pentru mama mea de 70 de ani', 'control_vedere'],
  ['control de vedere pentru copil de 3 ani', 'control_copil'],
  ['fiica mea nu vede la tabla la scoala', 'control_copil'],
  ['am nevoie de ochelari noi, am reteta de la medic', 'ochelari_lentile'],
  ['vreau lentile progresive', 'ochelari_lentile'],
  ['caut ochelari de soare cu dioptrii', 'ochelari_lentile'],
  ['vreau sa incerc lentile de contact, port ochelari acum', 'lentile_contact'],
  ['vreau sa-mi cumpar lentile de contact lunare', 'lentile_contact'],
  ['port lentile de contact si vreau altele', 'lentile_contact'],
  ['lentile colorate', 'lentile_contact'],
  ['mi s-a rupt bratul la ochelari, poate fi reparat?', 'reparatii_ochelari'],
  ['mi-a cazut un surub de la ochelari', 'reparatii_ochelari'],
  ['ochelarii imi aluneca de pe nas', 'reparatii_ochelari'],
  ['am ochiul rosu de doua zile', 'simptome_oftalmologice'],
  ['am tensiune oculara mare si as vrea un control', 'simptome_oftalmologice'],
  ['am cataracta si vreau sa ma operez', 'simptome_oftalmologice'],
  ['am nevoie de OCT', 'investigatii'],
  ['vreau sa-mi masor tensiunea oculara', 'investigatii'],
];

// Singurele formulari din corpus la care nivelul nevoii se schimba: cumpararea de lentile de
// contact nu mai devine nevoie medicala specializata doar pentru ca textul spune "lentile".
const EXPECTED_NEED_LEVEL_CHANGES = new Set([
  'vreau sa-mi cumpar lentile de contact lunare',
  'port lentile de contact si vreau altele',
  'lentile colorate',
]);

check('shared and base44/shared copies are identical', () => {
  assert.equal(
    source('shared/confirmedNeedServiceKeys.js'),
    source('base44/shared/confirmedNeedServiceKeys.js'),
  );
});

check('every confirmed patient need has a family of existing service groups', () => {
  for (const intent of Object.keys(INTENTS).filter((key) => key !== 'unknown')) {
    assert.ok(CONFIRMED_NEED_SERVICE_GROUPS[intent], `lipseste familia pentru ${intent}`);
  }
  for (const [intent, groups] of Object.entries(CONFIRMED_NEED_SERVICE_GROUPS)) {
    for (const group of groups) {
      assert.ok(SERVICE_GROUPS[group], `${intent}: grup necunoscut ${group}`);
    }
  }
});

check('without a confirmed need the result is the old union', () => {
  const union = { explicitKeys: ['eyeglasses_repair'], textKeys: ['sunglasses', 'eyeglasses_repair'] };
  for (const intent of ['', 'unknown', 'nu_exista']) {
    const result = filterTextServiceKeysForConfirmedNeed({ intent, ...union, getDefinition: getCanonicalServiceDefinition });
    assert.deepEqual(result.serviceKeys, ['eyeglasses_repair', 'sunglasses']);
    assert.equal(result.applied, false);
  }
  const noExplicit = filterTextServiceKeysForConfirmedNeed({
    intent: 'investigatii',
    explicitKeys: [],
    textKeys: ['oct', 'sunglasses'],
    getDefinition: getCanonicalServiceDefinition,
  });
  assert.deepEqual(noExplicit.serviceKeys, ['oct', 'sunglasses']);
  assert.equal(noExplicit.applied, false);
  const noRegistry = filterTextServiceKeysForConfirmedNeed({ intent: 'reparatii_ochelari', ...union });
  assert.deepEqual(noRegistry.serviceKeys, ['eyeglasses_repair', 'sunglasses']);
});

check('a repair keeps only workshop keys', () => {
  const result = filterFor('mi s-a rupt bratul la ochelari, poate fi reparat?', 'reparatii_ochelari');
  assert.ok(result.serviceKeys.includes('frame_repair'), result.serviceKeys.join(', '));
  for (const key of ['sunglasses', 'frames', 'eyeglasses', 'accessories', 'safety_glasses']) {
    assert.ok(!result.serviceKeys.includes(key), `${key} a ramas la reparatie`);
    assert.ok(result.textKeys.includes(key), `${key} nu mai vine din text; testul trebuie revazut`);
  }
  for (const key of result.serviceKeys.filter((item) => !result.explicitKeys.includes(item))) {
    assert.equal(getCanonicalServiceDefinition(key)?.group, 'technical_activities', key);
  }
});

check('buying contact lenses stays a general need', () => {
  const result = filterFor('vreau sa-mi cumpar lentile de contact lunare', 'lentile_contact');
  assert.equal(needLevel(result.before), 'specialized_medical');
  assert.equal(needLevel(result.serviceKeys), 'general');
  assert.ok(result.serviceKeys.includes('contact_lenses'));
  assert.ok(!result.serviceKeys.includes('contact_lens_fitting'));
});

check('a first contact lens fitting keeps the specialised keys', () => {
  const result = filterFor('vreau sa incerc lentile de contact, port ochelari acum', 'lentile_contact');
  assert.equal(needLevel(result.explicitKeys), 'specialized_medical', result.explicitKeys.join(', '));
  assert.ok(result.serviceKeys.includes('contact_lens_fitting'), result.serviceKeys.join(', '));
  assert.ok(!result.serviceKeys.includes('prescription_lenses'));
});

check('a medical need keeps its medical keys', () => {
  const result = filterFor('vreau un control oftalmologic pentru mama mea de 70 de ani', 'control_vedere');
  assert.equal(needLevel(result.serviceKeys), 'specialized_medical');
  assert.deepEqual(result.droppedTextKeys, []);
});

check('keratoconus keeps specialist lens fitting and medical keys', () => {
  const result = filterFor('am keratoconus si vreau lentile de contact', 'lentile_contact');
  for (const key of ['specialty_contact_lens_fitting', 'cornea_consultation', 'corneal_topography']) {
    assert.ok(result.serviceKeys.includes(key), `${key} lipseste: ${result.serviceKeys.join(', ')}`);
  }
  assert.equal(needLevel(result.serviceKeys), 'specialized_medical');
  const withoutMention = filterTextServiceKeysForConfirmedNeed({
    intent: 'lentile_contact',
    explicitKeys: result.explicitKeys,
    textKeys: result.textKeys,
    getDefinition: getCanonicalServiceDefinition,
  });
  assert.ok(!withoutMention.serviceKeys.includes('specialty_contact_lens_fitting'), 'fara keratocon, lentilele raman nevoie comerciala');
  const romanianSpelling = filterTextServiceKeysForConfirmedNeed({
    intent: 'lentile_contact',
    explicitKeys: ['lentile_contact'],
    textKeys: ['specialty_contact_lens_fitting', 'cornea_consultation'],
    text: 'am cheratocon',
    getDefinition: getCanonicalServiceDefinition,
  });
  assert.deepEqual(romanianSpelling.droppedTextKeys, []);
});

check('keratoconus does not change glasses or repairs', () => {
  for (const intent of ['ochelari_lentile', 'reparatii_ochelari']) {
    const result = filterTextServiceKeysForConfirmedNeed({
      intent,
      explicitKeys: INTENTS[intent].service_keys,
      textKeys: ['cornea_consultation', 'specialty_contact_lens_fitting'],
      text: 'am keratocon',
      getDefinition: getCanonicalServiceDefinition,
    });
    assert.deepEqual(result.droppedTextKeys, ['cornea_consultation', 'specialty_contact_lens_fitting'], intent);
  }
});

check('keratoconus with contact lenses is sent to a specialist', () => {
  const guidance = buildPatientVisitGuidance({ intent: 'lentile_contact', answers: [], text: 'am keratoconus si vreau lentile de contact' });
  assert.match(guidance.where, /lentile de contact speciale/);
  assert.ok(guidance.prepare.some((tip) => /lentile de contact/.test(tip)), guidance.prepare.join(' | '));
  const regular = buildPatientVisitGuidance({ intent: 'lentile_contact', answers: [], text: 'vreau lentile de contact lunare' });
  assert.match(regular.where, /optic/);
});

check('a diabetic eye check keeps the fundus exam', () => {
  const result = filterFor('am diabet si vreau sa-mi verific ochii', 'control_vedere');
  for (const key of ['diabetic_retinopathy', 'fundus_exam']) {
    assert.ok(result.serviceKeys.includes(key), `${key} lipseste: ${result.serviceKeys.join(', ')}`);
  }
  const glasses = filterFor('am diabet si vreau ochelari noi', 'ochelari_lentile');
  assert.ok(glasses.textKeys.includes('diabetic_retinopathy'), 'textul trebuie sa aduca retinopatia diabetica');
  assert.ok(!glasses.serviceKeys.includes('diabetic_retinopathy'), glasses.serviceKeys.join(', '));
});

check('corpus invariants', () => {
  for (const [text, intent] of CORPUS) {
    const result = filterFor(text, intent);
    for (const key of result.explicitKeys) {
      assert.ok(result.serviceKeys.includes(key), `${text}: cheia explicita ${key} a disparut`);
    }
    for (const key of result.serviceKeys) {
      assert.ok(result.before.includes(key), `${text}: cheie noua ${key}`);
    }
    const family = CONFIRMED_NEED_SERVICE_GROUPS[intent];
    for (const key of result.serviceKeys.filter((item) => !result.explicitKeys.includes(item))) {
      const definition = getCanonicalServiceDefinition(key);
      const sameAsExplicit = result.explicitKeys.some((item) => getCanonicalServiceDefinition(item)?.key === definition?.key);
      assert.ok(sameAsExplicit || family.includes(definition?.group), `${text}: ${key} (${definition?.group}) in afara familiei`);
    }
    const changed = needLevel(result.before) !== needLevel(result.serviceKeys);
    assert.equal(changed, EXPECTED_NEED_LEVEL_CHANGES.has(text), `${text}: ${needLevel(result.before)} -> ${needLevel(result.serviceKeys)}`);
  }
});

check('browser and server apply the rule on the confirmed intent', () => {
  const client = source('src/lib/providerSemanticSearch.js');
  assert.match(client, /import \{ filterTextServiceKeysForConfirmedNeed \} from "\.\.\/\.\.\/shared\/confirmedNeedServiceKeys\.js";/);
  assert.match(client, /import \{ getCanonicalServiceDefinition \} from "@\/lib\/canonicalServiceCatalog";/);
  const clientCall = client.slice(client.indexOf('export async function matchProvidersWithSemanticFallback'));
  assert.match(clientCall, /intent: payload\.intent,\s+explicitKeys,\s+textKeys: localResolution\.service_keys,\s+text: searchText,\s+getDefinition: getCanonicalServiceDefinition,/);

  const entry = source('base44/functions/matchProvidersSemantic/entry.ts');
  assert.match(entry, /import \{ filterTextServiceKeysForConfirmedNeed \} from '\.\.\/\.\.\/shared\/confirmedNeedServiceKeys\.js';/);
  assert.match(entry, /const requestedKeys = filterTextServiceKeysForConfirmedNeed\(\{\s+intent: clean\(payload\.intent\),\s+explicitKeys,\s+textKeys: semantic\.service_keys,\s+text: searchText,\s+getDefinition: getCanonicalServiceDefinition,\s+\}\)\.serviceKeys;/);
  assert.ok(
    entry.indexOf('const requestedKeys = filterTextServiceKeysForConfirmedNeed') < entry.indexOf("if (payload.mode === 'question_only')"),
    'filtrul trebuie aplicat inainte de ramurile question_only / interpret_only',
  );
});

// Serverul foloseste registrul din bundle-ul local; regula trebuie sa dea acelasi rezultat.
const bundle = await import(pathToFileURL(path.join(root, 'base44/functions/matchProvidersSemantic/sharedDependencies.js')).href);
check('the server bundle registry gives the same repair result', () => {
  const result = filterFor(
    'mi s-a rupt bratul la ochelari, poate fi reparat?',
    'reparatii_ochelari',
    bundle.resolveServiceSearchQuery,
    bundle.getCanonicalServiceDefinition,
  );
  for (const key of ['sunglasses', 'frames', 'eyeglasses']) {
    assert.ok(!result.serviceKeys.includes(key), `${key} a ramas pe server`);
  }
  for (const key of result.serviceKeys.filter((item) => !result.explicitKeys.includes(item))) {
    assert.equal(bundle.getCanonicalServiceDefinition(key)?.group, 'technical_activities', key);
  }
});

check('the server bundle registry keeps keratoconus lens fitting', () => {
  const result = filterFor(
    'am keratoconus si vreau lentile de contact',
    'lentile_contact',
    bundle.resolveServiceSearchQuery,
    bundle.getCanonicalServiceDefinition,
  );
  assert.ok(result.serviceKeys.includes('specialty_contact_lens_fitting'), result.serviceKeys.join(', '));
});

console.log(`Confirmed need service keys verified: ${checks} checks, ${CORPUS.length} phrasings.`);
