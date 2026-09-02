// Semnalul "este pentru copil" pe tot lantul: chestionar -> service_keys -> potrivire -> lead.
//
// 2026-09-01. Inainte de aceasta verificare existau doua gauri tacute:
//  - raspunsul "pentru copilul meu" ajungea in service_keys DOAR pe fluxul de control de
//    rutina, prin schimbarea intentiei in `control_copil`. Pe fluxul de simptome (un copil
//    cu ochiul rosu) nu se intampla nimic: cererea pleca cu exact aceleasi chei ca a unui
//    adult, iar `children_eye_exam` nu era accesibila din niciun drum al chestionarului.
//  - optiunea `other_adult` (cine cauta pentru un parinte sau partener) era o optiune reala
//    in chestionar, dar lista alba din persistenta o transforma tacut in null.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../shared/canonicalServiceRegistryExtended.js';
import { PATIENT_GUIDANCE_QUESTION_CATALOG } from '../shared/patientGuidanceQuestionCatalog.js';
import { getCanonicalServiceDefinition, normalizeServiceKey } from '../shared/canonicalServiceRegistry.js';
import { getServicePrerequisiteDefinition } from '../shared/servicePrerequisiteEngine.js';

const CHILD_SERVICE_KEY = 'children_eye_exam';

// --- 1. Chestionarul poarta semnalul, in ambele copii ale librariei partajate ------------
const sharedCatalogSource = await readFile(new URL('../shared/patientGuidanceQuestionCatalog.js', import.meta.url), 'utf8');
const base44CatalogSource = await readFile(new URL('../base44/shared/patientGuidanceQuestionCatalog.js', import.meta.url), 'utf8');
assert.equal(sharedCatalogSource, base44CatalogSource, 'copiile catalogului trebuie sa fie identice');

const forWhom = PATIENT_GUIDANCE_QUESTION_CATALOG.for_whom;
const childOption = forWhom.options.find((option) => option.key === 'child');
assert.ok(childOption, 'optiunea "pentru copil" trebuie sa existe');
assert.deepEqual(childOption.service_keys, [CHILD_SERVICE_KEY]);
assert.ok(forWhom.options.some((option) => option.key === 'other_adult'));

// Cheia trebuie sa fie una reala din registrul canonic, nu una inventata.
assert.ok(getCanonicalServiceDefinition(CHILD_SERVICE_KEY), `${CHILD_SERVICE_KEY} trebuie sa existe in registru`);
assert.equal(normalizeServiceKey(CHILD_SERVICE_KEY).canonicalKey, CHILD_SERVICE_KEY, 'cheia nu are voie sa fie rescrisa la canonicalizare');

// --- 2. Adaugarea cheii nu poate restrange rezultatele -----------------------------------
// Potrivirea pe servicii e aditiva (requestedSet.has, OR peste chei), deci o cheie in plus
// nu elimina locatii. Doua lucruri ar putea totusi sa strice asta: un service_need_level mai
// mare (ar schimba bucket-ul de recomandare) sau o prerechizita mai stricta.
const reference = 'ophthalmology_consultation';
assert.equal(
  getCanonicalServiceDefinition(CHILD_SERVICE_KEY).service_need_level,
  getCanonicalServiceDefinition(reference).service_need_level,
  'cheia pentru copii trebuie sa aiba acelasi nivel de nevoie ca un consult oftalmologic',
);
const childPrerequisites = getServicePrerequisiteDefinition(CHILD_SERVICE_KEY);
const referencePrerequisites = getServicePrerequisiteDefinition(reference);
assert.deepEqual(
  [...(childPrerequisites?.required_professional_types || [])].sort(),
  [...(referencePrerequisites?.required_professional_types || [])].sort(),
  'cheia pentru copii nu are voie sa ceara alt tip de profesionist decat consultul oftalmologic',
);
// Si trebuie sa fie aplicabila cel putin acelorasi tipuri de profil - altfel semnalul ar
// restrange, in loc sa largeasca, lista locatiilor care pot raspunde.
for (const profileType of referencePrerequisites.applicable_profile_types) {
  assert.ok(
    childPrerequisites.applicable_profile_types.includes(profileType),
    `${profileType} raspunde la consult oftalmologic dar nu si la consult pentru copii`,
  );
}

// --- 3. Clientul nu mai sterge cheia adusa de optiune ------------------------------------
const card = await readFile(new URL('../src/components/intake2/ConversationalCard.jsx', import.meta.url), 'utf8');
const forWhomBranch = card.slice(card.indexOf('question.key === "for_whom"'));
const branchBody = forWhomBranch.slice(0, forWhomBranch.indexOf('\n      }'));
assert.doesNotMatch(
  branchBody,
  /next\.serviceKeys = \[\.\.\.INTENTS/,
  'ramura pentru copil suprascria lista de servicii si pierdea cheia adusa de optiune',
);
assert.match(branchBody, /resolveOptionServiceKeys\(INTENTS\.control_copil\.service_keys, option\)/);

// --- 3b. Traseul de rezerva poarta acelasi semnal ----------------------------------------
// ConversationalCard are doua surse de intrebari: catalogul aprobat si registrul vechi din
// src/lib/intentRegistry.js, folosit cand selectia de intrebari esueaza. Fara cheie acolo,
// cautarea ar fi derivat semnalul server-side din raspunsuri, dar lead-ul livrat
// furnizorului ar fi ramas fara el.
const intentRegistry = await readFile(new URL('../src/lib/intentRegistry.js', import.meta.url), 'utf8');
const legacyChildOptions = intentRegistry.match(/\{ key: "copil",[^}]*\}/g) || [];
assert.ok(legacyChildOptions.length >= 2, 'registrul vechi trebuie sa aiba optiunile pentru copil');
for (const option of legacyChildOptions) {
  assert.match(
    option,
    /service_keys: \["children_eye_exam"\]/,
    `optiunea legacy pentru copil nu poarta semnalul pediatric: ${option}`,
  );
}

// Ramura generica next_intent refacea lista de servicii si stergea cheile aduse de optiune,
// deci un raspuns care schimba intentia SI poarta un semnal propriu isi pierdea semnalul.
const nextIntentBranch = card.slice(card.indexOf('if (option.next_intent'));
assert.match(
  nextIntentBranch.slice(0, nextIntentBranch.indexOf('\n      }')),
  /resolveOptionServiceKeys\(INTENTS\[option\.next_intent\]\.service_keys, option\)/,
);

// --- 4. Serverul deriva cheile din aceleasi optiuni --------------------------------------
const semanticEntry = await readFile(new URL('../base44/functions/matchProvidersSemantic/entry.ts', import.meta.url), 'utf8');
assert.match(semanticEntry, /function confirmedServiceKeysFromAnswers/);
assert.match(semanticEntry, /option\?\.service_keys \|\| \[\]/);

// --- 5. Persistenta pastreaza raspunsul, inclusiv other_adult ----------------------------
const persistence = await readFile(new URL('../shared/patientRequestPersistence.js', import.meta.url), 'utf8');
const base44Persistence = await readFile(new URL('../base44/shared/patientRequestPersistence.js', import.meta.url), 'utf8');
assert.equal(persistence, base44Persistence);
assert.match(persistence, /\['adult', 'copil', 'other_adult'\]\.includes\(draft\.for_whom\)/);

for (const entityPath of ['../base44/entities/PatientRequest.jsonc', '../base44/entities/Request.jsonc']) {
  const schema = JSON.parse(await readFile(new URL(entityPath, import.meta.url), 'utf8'));
  assert.ok(
    schema.properties.for_whom.enum.includes('other_adult'),
    `${entityPath}: enumul for_whom trebuie sa accepte other_adult, altfel scrierea esueaza`,
  );
}

// --- 6. Furnizorul vede eticheta corecta -------------------------------------------------
const leadPanel = await readFile(new URL('../src/components/workspace/provider/leads/LeadDetailPanel.jsx', import.meta.url), 'utf8');
assert.match(leadPanel, /other_adult: "Pentru altcineva"/);
assert.doesNotMatch(
  leadPanel,
  /lead\.for_whom === "copil" \? "Pentru copil" : "Pentru adult"/,
  'eticheta binara afisa "Pentru adult" pentru orice valoare care nu era "copil"',
);

console.log('Patient child signal checks passed: chestionar -> service_keys -> potrivire -> lead.');
