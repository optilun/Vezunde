// Aprobarea unei cereri marcate duplicat ca locatie distincta (2026-10-02).
//
// Inainte, o cerere de locatie noua marcata "duplicat puternic" nu crea nimic si adminul o putea
// doar respinge; furnizorul trebuia sa o propuna din nou dupa ce adminul crea manual locatia.
// Acum adminul o poate aproba ca locatie distincta: motiv obligatoriu, duplicatele aparute dupa
// trimitere opresc aprobarea pana sunt confirmate, iar locatia se creeaza din datele trimise, ca
// ciorna nepublicata si neverificata, cu aceeasi forma ca la trimitere (shared/newLocationProposal.js).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DISTINCT_APPROVAL_NOTE_MIN_LENGTH,
  missingProposalFields,
  newDuplicateCandidates,
  newLocationRecord,
  newOrganizationRecord,
  proposedLocationSnapshot,
} from '../base44/shared/newLocationProposal.js';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

// ---------- 1. Datele locatiei: o singura forma ----------
const geo = { siruta_code: '54975', name: 'Cluj-Napoca', county_name: 'Cluj', county_code: 'CJ', uat_code: '54975', uat_name: 'Cluj-Napoca' };
const proposal = proposedLocationSnapshot({
  name: ' Optica Noua ', provider_type: 'optica_medicala', provider_profile_type: 'independent_optical_store',
  address: 'Str. Exemplu 1', phone_public: '0700000000', public_email: '', place_id: 'abc', lat: 46.7, lng: 23.6,
}, geo);
assert.equal(proposal.name, 'Optica Noua');
assert.equal(proposal.locality_siruta_code, '54975');
assert.equal(proposal.locality_name, 'Cluj-Napoca');
assert.equal(proposal.place_id, 'abc', 'place_id se pastreaza ca locatia sa poata fi creata si la aprobare');
assert.equal(proposal.lat, 46.7);
assert.deepEqual(missingProposalFields(proposal), []);
assert.deepEqual(missingProposalFields({ ...proposal, address: '' }), ['address']);
assert.deepEqual(missingProposalFields({ ...proposal, phone_public: '', public_email: '' }), ['phone_public_or_public_email']);

const record = newLocationRecord({ proposed: proposal, geo, organizationId: 'org1', nowIso: '2026-10-02T00:00:00.000Z' });
assert.equal(record.organization_id, 'org1');
assert.equal(record.status, 'in_verificare');
assert.equal(record.public_visibility_status, 'draft', 'nu se publica');
assert.equal(record.profile_control_status, 'directory');
assert.equal(record.verification_state, 'in_verification');
assert.equal(record.is_verified, false, 'nu se verifica automat');
assert.equal(record.county_code, 'CJ', 'geografia vine din SIRUTA');
assert.equal(record.data_source, 'google_place_reference');
assert.equal(newLocationRecord({ proposed: { ...proposal, place_id: '' }, geo }).data_source, 'manual');
assert.deepEqual(newOrganizationRecord({ name: ' Org ', providerProfileType: 'independent_optical_store' }), {
  name: 'Org', status: 'activa', organization_type: 'independent_optical_store',
});

// ---------- 2. Duplicatele aparute dupa trimitere ----------
const candidate = (location_id, severity = 'strong_duplicate') => ({ location_id, severity });
assert.deepEqual(newDuplicateCandidates({
  snapshotCandidates: [candidate('known')],
  currentCandidates: [candidate('known'), candidate('fresh'), candidate('far', 'likely_distinct'), candidate('retired'), candidate('ack', 'possible_duplicate')],
  retiredLocationIds: ['retired'],
  acknowledgedIds: ['ack'],
}).map((item) => item.location_id), ['fresh'], 'doar duplicatele noi, active si neconfirmate opresc aprobarea');
assert.equal(DISTINCT_APPROVAL_NOTE_MIN_LENGTH, 15);

// ---------- 3. Trimiterea foloseste aceleasi date ----------
const submit = await read('base44/functions/submitProviderClaim/entry.ts');
assert.match(submit, /from '\.\.\/\.\.\/shared\/newLocationProposal\.js'/);
assert.match(submit, /proposed_location: proposedLocationSnapshot\(/);
assert.match(submit, /ProviderOrganization\.create\(\s*newOrganizationRecord\(/);
assert.match(submit, /ProviderLocation\.create\(newLocationRecord\(/);
assert.doesNotMatch(submit, /const locData = \{/, 'nu mai exista o a doua copie a datelor locatiei');

// ---------- 4. Aprobarea ca locatie distincta (backend) ----------
const review = await read('base44/functions/directoryOps/adminProviderClaimReview.ts');
const materialize = review.slice(review.indexOf('async function materializeDistinctProposal('), review.indexOf('// 2026-10-01. Accesul primit dintr-o revendicare'));
assert.match(materialize, /claim\.mode !== 'new_location_duplicate_review'/, 'doar cererile marcate duplicat');
assert.match(materialize, /note\.length < DISTINCT_APPROVAL_NOTE_MIN_LENGTH/, 'motiv obligatoriu');
assert.match(materialize, /context: 'admin_create'/, 'duplicatele se verifica din nou la aprobare');
assert.match(materialize, /code: 'new_duplicate_candidates'/);
assert.match(materialize, /isRetiredLocationProposal\(location\)/, 'propunerile respinse nu mai opresc aprobarea');
assert.match(materialize, /newLocationRecord\(\{ proposed, geo, organizationId: organization\.id, nowIso \}\)/);
assert.match(materialize, /mode: 'new_location',\s*organization_id: organization\.id,\s*location_id: location\.id/);
assert.match(materialize, /distinct_review: distinctReview/, 'decizia ramane in cerere');
assert.match(materialize, /'approve_duplicate_review_as_distinct'/, 'audit pe cerere');
assert.match(materialize, /auditCreatedEntity\(svc, user, 'ProviderLocation', location, note\)/, 'audit pe locatie');
assert.match(materialize, /auditCreatedEntity\(svc, user, 'ProviderOrganization', organization, note\)/, 'audit pe organizatie');
assert.doesNotMatch(materialize, /public_visibility_status: 'approved'|status: 'publicata'|is_verified: true/, 'nu publica si nu verifica');
const handleStart = review.indexOf('export async function handle(');
const handle = review.slice(handleStart);
assert.match(handle, /if \(p\.action === 'approve_distinct'\) \{[\s\S]*claim = result\.claim;[\s\S]*\} else if \(p\.action !== 'approve'\)/, 'dupa creare, cererea trece pe calea normala de aprobare');
assert.match(handle, /claim\.mode === 'new_location_duplicate_review'\) \{\s*return Response\.json\(\{ error: 'Cererea de clarificare duplicat nu poate fi aprobata direct' \}/, 'butonul Aproba simplu ramane blocat pentru duplicate');

// ---------- 5. Panoul admin ----------
const ui = await read('src/components/admin/directory/DirOpsClaims.jsx');
assert.match(ui, /type: "approve_distinct"/);
assert.match(ui, /Aprobă ca locație distinctă/);
assert.match(ui, /noteOptional=\{action\.type === "approve"\}/, 'nota e obligatorie la aprobarea ca locatie distincta');
assert.match(ui, /acknowledged_candidate_ids: action\.acknowledgedIds/);
assert.match(ui, /data\?\.code === "new_duplicate_candidates"/);
assert.match(ui, /Am verificat: sunt locații diferite de cea propusă\./);
assert.doesNotMatch(ui, /creeaz-o prin fluxul canonic/, 'textul vechi (creare manuala) a disparut');

console.log('verify-duplicate-distinct-approval: OK');
