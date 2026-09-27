// Datele de contact cerute la fiecare cautare, inainte de rezultate.
//
// 2026-09-27, cererea owner-ului: "la fiecare cautare sa ceara date: email, nr de telefon, nume,
// varsta. Chiar daca nu continua, macar sa ii luam datele." Deciziile owner-ului: pasul se poate
// sari, obligatorii sunt numele si emailul sau telefonul, varsta e optionala. Verificarile de aici
// blocheaza regulile de confidentialitate:
//  - validarea e aceeasi in browser si pe server (modul comun, copii identice);
//  - datele se salveaza doar la "Continua", cu acordul bifat (nebifat implicit), niciodata in timp
//    ce pacientul scrie; "Sari peste" nu trimite nimic;
//  - entitatea e accesibila doar adminilor si se scrie doar din createPatientRequest;
//  - datele nu ajung la modelul AI, in potrivire sau in cererea catre locatii;
//  - suprafata Base44 ramane la 49 de functii fizice.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PATIENT_SEARCH_CONTACT_CONSENT_VERSION,
  PATIENT_SEARCH_CONTACT_MIN_SELF_AGE,
  PATIENT_SEARCH_CONTACT_MODE,
  PatientSearchContactValidationError,
  sanitizePatientSearchContact,
  searchContactAgeRefersTo,
} from '../shared/patientSearchContact.js';
import { createPatientIntakeSnapshot, patientIntakeStateFromSnapshot } from '../src/lib/patientIntakeSession.js';

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

const CONSENT = { processing: true, version: PATIENT_SEARCH_CONTACT_CONSENT_VERSION };
const valid = (overrides = {}) => ({
  contact: { name: 'Ana Pop', email: 'ana@example.ro', phone: '', age: '' },
  search: { intent: 'control_vedere', for_whom: 'adult', search_key: 'patient-intake-v1:free_text:abc' },
  consent: CONSENT,
  ...overrides,
});
function rejects(input, field) {
  assert.throws(() => sanitizePatientSearchContact(input), (error) => (
    error instanceof PatientSearchContactValidationError && error.field === field
  ), `trebuia respins pe campul ${field}`);
}

// --- 1. Modulul comun -------------------------------------------------------------------------
check('shared module is identical in browser and server copies', () => {
  assert.equal(source('shared/patientSearchContact.js'), source('base44/shared/patientSearchContact.js'));
});

check('name and email or phone are required, age is optional', () => {
  const saved = sanitizePatientSearchContact(valid({ contact: { name: '  Ana   Pop ', email: ' ANA@Example.RO ' } }));
  assert.equal(saved.contact.contact_name, 'Ana Pop');
  assert.equal(saved.contact.contact_email, 'ana@example.ro');
  assert.equal(saved.contact.age_years, null, 'varsta lipsa ramane goala');
  assert.equal(saved.contact.age_refers_to, '');
  assert.equal(sanitizePatientSearchContact(valid({ contact: { name: 'Ana', phone: '0722 123 456' } })).contact.contact_phone, '0722 123 456');
  rejects(valid({ contact: { name: 'A', email: 'ana@example.ro' } }), 'name');
  rejects(valid({ contact: { name: 'Ana' } }), 'contact');
  rejects(valid({ contact: { name: 'Ana', email: 'ana@' } }), 'email');
  rejects(valid({ contact: { name: 'Ana', phone: '123' } }), 'phone');
  rejects(valid({ contact: { name: 'Ana', phone: '1234567890123456' } }), 'phone');
});

check('age: whose it is, range and the 16-year rule', () => {
  assert.equal(searchContactAgeRefersTo('adult'), 'contact');
  assert.equal(searchContactAgeRefersTo(''), 'contact');
  assert.equal(searchContactAgeRefersTo('other_adult'), 'patient');
  assert.equal(searchContactAgeRefersTo('copil'), null, 'la copii varsta e deja intrebata in chestionar');
  assert.equal(searchContactAgeRefersTo('child'), null);
  const adult = sanitizePatientSearchContact(valid({ contact: { name: 'Ana', email: 'ana@example.ro', age: '34' } }));
  assert.equal(adult.contact.age_years, 34);
  assert.equal(adult.contact.age_refers_to, 'contact');
  const other = sanitizePatientSearchContact(valid({
    contact: { name: 'Ana', email: 'ana@example.ro', age: 78 },
    search: { for_whom: 'other_adult' },
  }));
  assert.equal(other.contact.age_years, 78);
  assert.equal(other.contact.age_refers_to, 'patient');
  const child = sanitizePatientSearchContact(valid({
    contact: { name: 'Ana', email: 'ana@example.ro', age: 7 },
    search: { for_whom: 'child' },
  }));
  assert.equal(child.contact.age_years, null, 'varsta nu se salveaza la cautarile pentru copii');
  assert.equal(child.search.for_whom, 'copil');
  rejects(valid({ contact: { name: 'Ana', email: 'ana@example.ro', age: 'treizeci' } }), 'age');
  rejects(valid({ contact: { name: 'Ana', email: 'ana@example.ro', age: 0 } }), 'age');
  rejects(valid({ contact: { name: 'Ana', email: 'ana@example.ro', age: 150 } }), 'age');
  rejects(valid({ contact: { name: 'Ana', email: 'ana@example.ro', age: PATIENT_SEARCH_CONTACT_MIN_SELF_AGE - 1 } }), 'age');
  assert.equal(
    sanitizePatientSearchContact(valid({ contact: { name: 'Ana', email: 'ana@example.ro', age: PATIENT_SEARCH_CONTACT_MIN_SELF_AGE } })).contact.age_years,
    PATIENT_SEARCH_CONTACT_MIN_SELF_AGE,
  );
});

check('consent is required, with the current version', () => {
  rejects(valid({ consent: undefined }), 'consent');
  rejects(valid({ consent: { processing: false, version: PATIENT_SEARCH_CONTACT_CONSENT_VERSION } }), 'consent');
  rejects(valid({ consent: { processing: true, version: 'patient-search-contact-v0' } }), 'consent');
});

check('only the search summary is kept, never free text or health answers', () => {
  const saved = sanitizePatientSearchContact(valid({
    search: {
      intent: 'simptome_oftalmologice',
      intent_label: 'O problemă la ochi',
      city: 'Cluj-Napoca',
      original_message: 'vad incetosat de o saptamana',
      answers: [{ question_key: 'anamneza_afectiuni', answer_value: 'glaucom' }],
    },
  }));
  assert.deepEqual(Object.keys(saved.search).sort(), [
    'city', 'county', 'for_whom', 'intent', 'intent_label', 'locality_siruta_code', 'search_key', 'timing_key',
  ]);
  assert.deepEqual(Object.keys(saved.contact).sort(), ['age_refers_to', 'age_years', 'contact_email', 'contact_name', 'contact_phone']);
});

// --- 2. Entitatea si serverul -----------------------------------------------------------------
check('entity is admin-only for every operation', () => {
  const schema = JSON.parse(source('base44/entities/PatientSearchContact.jsonc'));
  assert.equal(schema.name, 'PatientSearchContact');
  for (const operation of ['create', 'read', 'update', 'delete']) {
    assert.equal(schema.rls[operation].user_condition.role, 'admin', operation);
  }
  for (const field of ['contact_name', 'contact_email', 'contact_phone', 'age_years', 'processing_consent_version', 'retention_until', 'linked_request_id']) {
    assert.ok(schema.properties[field], `lipseste campul ${field}`);
  }
  assert.ok(schema.required.includes('processing_consent'));
  assert.equal(schema.properties.original_message, undefined, 'mesajul liber nu se salveaza aici');
});

check('server saves through createPatientRequest, before the request contract', () => {
  const entry = source('base44/functions/createPatientRequest/entry.ts');
  const modeBranch = entry.indexOf('input?.mode === PATIENT_SEARCH_CONTACT_MODE');
  assert.ok(modeBranch > 0, 'ramura save_search_contact lipseste');
  assert.ok(modeBranch < entry.indexOf('sanitizePatientRequestSubmission(input)'), 'ramura vine inaintea validarii cererii');
  assert.match(entry, /from '\.\.\/\.\.\/shared\/patientSearchContact\.js'/);
  const saveFunction = entry.slice(entry.indexOf('async function saveSearchContact('), entry.indexOf('async function linkSearchContactToRequest('));
  assert.match(saveFunction, /sanitizePatientSearchContact\(input\)/, 'serverul valideaza singur datele');
  assert.match(saveFunction, /PatientSearchContact\.create/);
  assert.match(saveFunction, /MAX_SEARCH_CONTACTS_PER_CONTACT_PER_HOUR/, 'limita pe ora impotriva abuzului');
  assert.match(saveFunction, /contact_identity_hash/);
  assert.match(saveFunction, /retention_until/);
  assert.doesNotMatch(saveFunction, /PatientRequest\.create|ProviderLead|RequestMatch|InvokeLLM/, 'nu creeaza cereri, leaduri sau apeluri AI');
  assert.match(entry, /linkSearchContactToRequest\(svc, contactIdentityHash, requestRecord\.id, now\)\.catch\(\(\) => null\)/, 'legarea de cerere nu poate strica salvarea cererii');
  assert.match(entry, /error instanceof PatientSearchContactValidationError/);
  assert.equal(PATIENT_SEARCH_CONTACT_MODE, 'save_search_contact');
});

check('physical Base44 function count stays at 49', () => {
  const functionsRoot = path.join(root, 'base44/functions');
  const physical = readdirSync(functionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(functionsRoot, entry.name, 'entry.ts')));
  assert.equal(physical.length, 49);
});

// --- 3. Ecranul si fluxul ---------------------------------------------------------------------
const screen = source('src/components/intake2/PatientSearchContact.jsx');
const card = source('src/components/intake2/ConversationalCard.jsx');

check('screen: consent unchecked by default, saves only on submit, skip saves nothing', () => {
  assert.match(screen, /const \[consent, setConsent\] = useState\(false\)/);
  assert.equal(screen.match(/savePatientSearchContact\(/g)?.length, 1, 'un singur apel de salvare');
  const submit = screen.slice(screen.indexOf('const submit = async'), screen.indexOf('const invalidProps'));
  assert.match(submit, /savePatientSearchContact\(/, 'salvarea e doar in submit');
  assert.ok(submit.indexOf('sanitizePatientSearchContact(payload)') < submit.indexOf('savePatientSearchContact('), 'validare inainte de trimitere');
  assert.doesNotMatch(screen, /onBlur|onChange=\{[^}]*save/i, 'nimic nu se trimite in timp ce pacientul scrie');
  assert.match(screen, /onDone\?\.\(\{ status: "skipped", contactId: "" \}\)/);
  assert.match(screen, />\s*Sari peste\s*</);
  assert.match(screen, /Sunt de acord ca VIASEE să păstreze aceste date/);
  assert.match(screen, /href="\/confidentialitate"/);
  assert.match(screen, /<InfoHint items=\{CONTACT_INFO\}/);
  assert.match(screen, /Nu le trimitem locațiilor/);
  assert.match(screen, /autoComplete="name"/);
  assert.match(screen, /autoComplete="tel"/);
  assert.match(screen, /autoComplete="email"/);
});

check('flow: anamnesis, then contact, then review', () => {
  const effect = card.slice(card.indexOf('// Chestionarul s-a incheiat.'));
  const anamnesis = effect.indexOf('patientNeedsAnamnesis');
  const contact = effect.indexOf('if (!state.contactStep)');
  const draft = effect.indexOf('buildPatientRequestDraft');
  assert.ok(anamnesis >= 0 && contact > anamnesis && draft > contact, 'ordinea: anamneza, contact, verificare');
  assert.match(card, /phase === "contact"/);
  assert.match(card, /<PatientSearchContact/);
  assert.match(card, /contactStep: status === "saved" \? "saved" : "skipped"/);
  assert.match(card, /trackPatientSearchEvent\("patient_search_contact_resolved"/);
  const analytics = card.slice(card.indexOf('trackPatientSearchEvent("patient_search_contact_resolved"'));
  assert.doesNotMatch(analytics.slice(0, analytics.indexOf('});')), /email|phone|name|age/, 'fara date personale in analytics');
});

check('contact data never reaches matching, the AI or the request draft', () => {
  const matchingEffect = card.slice(card.indexOf('const matchPayload = {'), card.indexOf('const res = await matchProvidersWithSemanticFallback'));
  assert.doesNotMatch(matchingEffect, /contact|email|phone/i);
  assert.doesNotMatch(source('src/lib/patientRequestDraft.js'), /contactStep|contact_email|contact_phone/);
  assert.doesNotMatch(source('base44/functions/matchProvidersSemantic/entry.ts'), /PatientSearchContact|save_search_contact/);
});

check('the step is remembered across restores, the data is not', () => {
  const snapshot = createPatientIntakeSnapshot({
    entrySignature: 'patient-intake-v1:guided:test',
    state: { intent: 'control_vedere', answers: [], contactStep: 'saved', contactEmail: 'ana@example.ro' },
    phase: 'contact',
  });
  assert.equal(snapshot.contactStep, 'saved');
  assert.equal(snapshot.contactEmail, undefined, 'datele de contact nu intra in sesiunea chestionarului');
  assert.equal(snapshot.phase, 'questions', 'la revenire, fluxul reia de la chestionar');
  assert.equal(patientIntakeStateFromSnapshot(snapshot).contactStep, 'saved');
  assert.equal(patientIntakeStateFromSnapshot({ contactStep: 'altceva' }).contactStep, null);
});

check('the request form starts with the data left at the contact step', () => {
  const submission = source('src/components/intake2/PatientRequestSubmission.jsx');
  assert.match(submission, /readRememberedPatientContact\(\)/);
  const client = source('src/lib/patientSearchContact.js');
  assert.match(client, /sessionStorage/, 'memorat doar in fila curenta');
  assert.doesNotMatch(client, /localStorage/, 'nu ramane in browser dupa inchiderea filei');
  assert.match(client, /functions\.invoke\("createPatientRequest"/);
  assert.match(client, /mode: PATIENT_SEARCH_CONTACT_MODE/);
});

console.log(`Patient search contact checks passed: ${checks}.`);
