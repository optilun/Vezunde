// Aplicarea serviciilor venite din cercetare pe o locatie existenta.
//
// 2026-09-03, audit flow intrebari/recomandari. Directorul avea 500+ locatii publicate
// si 26 de randuri LocationService, toate pe o singura locatie. Potrivirea se face
// exclusiv pe chei de serviciu, deci practic nicio cautare nu avea ce potrivi, iar
// aproape orice rezultat venea din fallback-ul structural.
//
// Modulul de cercetare facea aproape tot drumul si arunca rezultatul: serviciile aprobate
// de admin, cu dovada, erau serializate intr-un sir de text pus in `source_notes`.
// Verificarea de mai jos acopera veriga adaugata si, mai important, ce NU are voie sa
// faca: sa scrie ceva fara dovada aprobata de un om.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RESEARCH_SERVICE_APPLY_CONTRACT_VERSION,
  RESEARCH_SERVICE_BATCH_CHUNK_SIZE,
  RESEARCH_SERVICE_BATCH_CONTRACT_VERSION,
  RESEARCH_SERVICE_CONFIRMATION_LEVEL,
  computeServiceMatchingAllowed,
  isPublicHttpUrl,
  isResearchServiceRowRollbackSafe,
  locationServiceRow,
  normalizeResearchServicePairs,
  planResearchServiceApplication,
  researchServiceApplyConfirmation,
  researchServiceBatchConfirmation,
  researchServiceBatchRollbackConfirmation,
  researchServiceRowNote,
  summarizeResearchServiceBatchPlan,
} from '../shared/researchServiceApplyPlan.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
let scenarioCount = 0;

function scenario(name, verify) {
  scenarioCount += 1;
  try {
    verify();
  } catch (error) {
    error.message = `[${name}] ${error.message}`;
    throw error;
  }
}

const SOURCE_URL = 'https://exemplu-optica.ro/servicii';
const alwaysMatching = () => true;

function decision(overrides = {}) {
  return {
    decision: 'approve',
    by: 'admin@viasee.ro',
    at: '2026-09-01T10:00:00.000Z',
    source_ref: SOURCE_URL,
    snippet: 'Efectuam consultatii optometrice si determinarea dioptriilor.',
    ...overrides,
  };
}

scenario('serviciul aprobat cu dovada devine publicly_listed si intra in potrivire', () => {
  const result = planResearchServiceApplication({
    approvedFields: { 'service:optometry_consultation': 'optometry_consultation' },
    reviewDecisions: { 'service:optometry_consultation': decision() },
    matchingAllowedFor: alwaysMatching,
  });
  assert.equal(result.planned.length, 1);
  assert.equal(result.blocked.length, 0);
  assert.equal(result.skipped.length, 0);
  const row = result.planned[0];
  assert.equal(row.service_key, 'optometry_consultation');
  assert.equal(row.confirmation_level, 'publicly_listed');
  assert.equal(row.confirmation_level, RESEARCH_SERVICE_CONFIRMATION_LEVEL);
  assert.equal(row.matching_allowed, true);
  assert.equal(row.service_source_url, SOURCE_URL);
  assert.equal(row.service_confirmed_at, '2026-09-01T10:00:00.000Z');
  assert.match(row.snippet, /consultatii optometrice/);
});

scenario('fara decizie de aprobare nu se scrie nimic', () => {
  const result = planResearchServiceApplication({
    approvedFields: { 'service:oct': 'oct' },
    reviewDecisions: {},
    matchingAllowedFor: alwaysMatching,
  });
  assert.equal(result.planned.length, 0);
  assert.equal(result.blocked.length, 1);
  assert.match(result.blocked[0].reason, /dovada/);
});

scenario('decizia de respingere nu produce niciodata un serviciu', () => {
  const result = planResearchServiceApplication({
    approvedFields: { 'service:oct': 'oct' },
    reviewDecisions: { 'service:oct': decision({ decision: 'reject' }) },
    matchingAllowedFor: alwaysMatching,
  });
  assert.equal(result.planned.length, 0);
  assert.equal(result.blocked.length, 1);
});

scenario('aprobarea fara snippet sau fara source_ref este blocata', () => {
  for (const missing of [{ snippet: '' }, { source_ref: '' }, { snippet: '   ' }]) {
    const result = planResearchServiceApplication({
      approvedFields: { 'service:oct': 'oct' },
      reviewDecisions: { 'service:oct': decision(missing) },
      matchingAllowedFor: alwaysMatching,
    });
    assert.equal(result.planned.length, 0, JSON.stringify(missing));
    assert.equal(result.blocked.length, 1);
  }
});

scenario('cheile din afara catalogului canonic sunt blocate, nu scrise', () => {
  const result = planResearchServiceApplication({
    approvedFields: { 'service:consultatie_inventata': 'consultatie_inventata' },
    reviewDecisions: { 'service:consultatie_inventata': decision() },
    matchingAllowedFor: alwaysMatching,
  });
  assert.equal(result.planned.length, 0);
  assert.equal(result.blocked.length, 1);
  assert.match(result.blocked[0].reason, /catalogului canonic/);
});

scenario('fara URL public serviciul nu poate fi listat public', () => {
  const result = planResearchServiceApplication({
    approvedFields: { 'service:oct': 'oct' },
    reviewDecisions: { 'service:oct': decision({ source_ref: 'sursa' }) },
    fallbackSourceUrl: '',
    matchingAllowedFor: alwaysMatching,
  });
  assert.equal(result.planned.length, 0);
  assert.equal(result.blocked.length, 1);
  assert.match(result.blocked[0].reason, /URL public/);
});

scenario('cand dovada nu are URL, se foloseste URL-ul sursei de cercetare', () => {
  const result = planResearchServiceApplication({
    approvedFields: { 'service:oct': 'oct' },
    reviewDecisions: { 'service:oct': decision({ source_ref: 'sursa:123' }) },
    fallbackSourceUrl: SOURCE_URL,
    matchingAllowedFor: alwaysMatching,
  });
  assert.equal(result.planned.length, 1);
  assert.equal(result.planned[0].service_source_url, SOURCE_URL);
});

scenario('serviciile deja existente pe locatie sunt sarite, nu duplicate', () => {
  const result = planResearchServiceApplication({
    approvedFields: {
      'service:oct': 'oct',
      'service:optometry_consultation': 'optometry_consultation',
    },
    reviewDecisions: {
      'service:oct': decision(),
      'service:optometry_consultation': decision(),
    },
    existingServiceKeys: ['oct'],
    matchingAllowedFor: alwaysMatching,
  });
  assert.deepEqual(result.planned.map((row) => row.service_key), ['optometry_consultation']);
  assert.deepEqual(result.skipped.map((row) => row.service_key), ['oct']);
});

scenario('rularea repetata este idempotenta: a doua oara nu mai planifica nimic', () => {
  const approvedFields = { 'service:oct': 'oct' };
  const reviewDecisions = { 'service:oct': decision() };
  const first = planResearchServiceApplication({ approvedFields, reviewDecisions, matchingAllowedFor: alwaysMatching });
  assert.equal(first.planned.length, 1);
  const second = planResearchServiceApplication({
    approvedFields,
    reviewDecisions,
    existingServiceKeys: first.planned.map((row) => row.service_key),
    matchingAllowedFor: alwaysMatching,
  });
  assert.equal(second.planned.length, 0);
  assert.equal(second.skipped.length, 1);
});

scenario('campurile care nu sunt servicii nu sunt atinse', () => {
  const result = planResearchServiceApplication({
    approvedFields: {
      'organization.name': 'Optica Exemplu',
      'location.address': 'Str. Exemplu 1',
      locality: '54975',
      'specialization:glaucom': 'glaucom',
      'service:oct': 'oct',
    },
    reviewDecisions: {
      'organization.name': decision(),
      'location.address': decision(),
      'specialization:glaucom': decision(),
      'service:oct': decision(),
    },
    matchingAllowedFor: alwaysMatching,
  });
  assert.deepEqual(result.planned.map((row) => row.service_key), ['oct']);
  assert.equal(result.blocked.length, 0);
  assert.equal(result.skipped.length, 0);
});

scenario('planul are ordine stabila, deci token-ul de confirmare este reproductibil', () => {
  const build = (fields) => planResearchServiceApplication({
    approvedFields: Object.fromEntries(fields.map((key) => [`service:${key}`, key])),
    reviewDecisions: Object.fromEntries(fields.map((key) => [`service:${key}`, decision()])),
    matchingAllowedFor: alwaysMatching,
  }).planned.map((row) => row.service_key);
  assert.deepEqual(
    build(['oct', 'optometry_consultation', 'frames']),
    build(['frames', 'oct', 'optometry_consultation']),
  );
});

scenario('token-ul de confirmare depinde de draft si de numarul de randuri', () => {
  assert.equal(researchServiceApplyConfirmation('abcdef0123456789', 3), 'SERVICII abcdef01 3');
  assert.notEqual(
    researchServiceApplyConfirmation('abcdef0123456789', 3),
    researchServiceApplyConfirmation('abcdef0123456789', 4),
  );
});

scenario('matching_allowed vine de la apelant, nu este presupus', () => {
  const result = planResearchServiceApplication({
    approvedFields: { 'service:oct': 'oct' },
    reviewDecisions: { 'service:oct': decision() },
    matchingAllowedFor: () => false,
  });
  assert.equal(result.planned[0].matching_allowed, false);

  const withoutCallback = planResearchServiceApplication({
    approvedFields: { 'service:oct': 'oct' },
    reviewDecisions: { 'service:oct': decision() },
  });
  assert.equal(withoutCallback.planned[0].matching_allowed, false);
});

scenario('validarea de URL respinge ce nu este http(s)', () => {
  for (const value of ['https://exemplu.ro', 'http://exemplu.ro/x']) assert.equal(isPublicHttpUrl(value), true, value);
  for (const value of ['', 'sursa', 'sursa:12', 'ftp://exemplu.ro', 'file:///etc/passwd', 'javascript:alert(1)']) {
    assert.equal(isPublicHttpUrl(value), false, value);
  }
});

// ---- invariante de runtime ---------------------------------------------------

const dirOps = source('base44/functions/directoryOps/directoryOps.ts');
const aiResearchOps = source('base44/functions/directoryOps/aiResearchOps.ts');
const batchOps = source('base44/functions/directoryOps/researchServiceBatchOps.ts');

scenario('actiunea exista si este implicit dry run', () => {
  assert.match(dirOps, /if \(action === 'apply_research_services'\)/);
  assert.match(dirOps, /if \(p\.dry_run !== false\) \{/);
  assert.match(dirOps, /researchServiceApplyConfirmation\(draftId, planned\.length\)/);
  assert.match(dirOps, /Confirmare invalida\. Scrie exact/);
});

scenario('nu se scrie peste profilurile care nu mai sunt in regim directory', () => {
  assert.match(dirOps, /profile_control_status \|\| 'directory'\) !== 'directory'/);
});

scenario('fiecare serviciu scris primeste dovada si audit', () => {
  const start = dirOps.indexOf("if (action === 'apply_research_services')");
  const end = dirOps.indexOf("// ---------- SET SERVICE CONFIRMATION LEVEL ----------", start);
  const block = dirOps.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /svc\.entities\.ProviderEvidence\.create\(\{/);
  assert.match(block, /entity_type: 'LocationService'/);
  assert.match(block, /action_type: 'apply_research_service'/);
  assert.match(block, /action_type: 'apply_research_services_batch'/);
});

scenario('constructorul de rand are o singura definitie, in shared', () => {
  // 2026-09-03, etapa 2: locationServiceRow si computeServiceMatchingAllowed au fost mutate
  // in shared cand a aparut si modulul de loturi. Trei consumatori, o singura definitie.
  const plan = source('shared/researchServiceApplyPlan.js');
  assert.equal((plan.match(/export function locationServiceRow\(/g) || []).length, 1);
  assert.equal((plan.match(/export function computeServiceMatchingAllowed\(/g) || []).length, 1);
  for (const consumer of [dirOps, batchOps]) {
    assert.doesNotMatch(consumer, /^function locationServiceRow\(/m);
    assert.doesNotMatch(consumer, /^function computeServiceMatchingAllowed\(/m);
    assert.match(consumer, /from '\.\.\/\.\.\/shared\/researchServiceApplyPlan\.js'/);
  }
  assert.equal((dirOps.match(/LocationService\.create\(locationServiceRow\(\{/g) || []).length, 2);
  assert.equal((batchOps.match(/LocationService\.create\(locationServiceRow\(\{/g) || []).length, 1);
});

scenario('aiResearchOps ramane fara scrieri de entitati de furnizor', () => {
  for (const entity of ['ProviderLocation', 'ProviderOrganization', 'LocationService', 'ProviderEvidence']) {
    assert.doesNotMatch(
      aiResearchOps,
      new RegExp(`entities\\.${entity}\\.(create|update|delete)`),
      `aiResearchOps nu are voie sa scrie ${entity}`,
    );
  }
  assert.match(aiResearchOps, /const NO_PROVIDER_WRITES = true;/);
});

scenario('importul de director tot nu poate crea servicii', () => {
  const autoImport = source('base44/functions/directoryOps/directoryAutoImportOps.ts');
  assert.match(autoImport, /creates_services: false/);
  assert.match(autoImport, /unsafe_batch_flag/);
});

scenario('copia din base44/shared ramane identica', () => {
  assert.equal(
    source('shared/researchServiceApplyPlan.js'),
    source('base44/shared/researchServiceApplyPlan.js'),
  );
});

// ---- etapa 2: loturi ---------------------------------------------------------

scenario('perechile sunt unice si au ordine stabila', () => {
  const pairs = normalizeResearchServicePairs([
    { draft_id: 'd2', location_id: 'l2' },
    { draft_id: 'd1', location_id: 'l1' },
    { draft_id: 'd2', location_id: 'l2' },
    { draft_id: '', location_id: 'l3' },
    { draft_id: 'd3', location_id: '' },
    null,
  ]);
  assert.deepEqual(pairs, [
    { draft_id: 'd1', location_id: 'l1' },
    { draft_id: 'd2', location_id: 'l2' },
  ]);
  assert.deepEqual(
    normalizeResearchServicePairs([{ draft_id: 'b', location_id: 'z' }, { draft_id: 'a', location_id: 'a' }]),
    normalizeResearchServicePairs([{ draft_id: 'a', location_id: 'a' }, { draft_id: 'b', location_id: 'z' }]),
  );
});

scenario('acelasi draft poate fi aplicat pe doua locatii diferite', () => {
  const pairs = normalizeResearchServicePairs([
    { draft_id: 'd1', location_id: 'l1' },
    { draft_id: 'd1', location_id: 'l2' },
  ]);
  assert.equal(pairs.length, 2);
});

scenario('rezumatul de lot aduna corect si numara perechile in eroare', () => {
  const summary = summarizeResearchServiceBatchPlan([
    { planned: [1, 2, 3], skipped: [1], blocked: [] },
    { planned: [], skipped: [], blocked: [1, 2] },
    { planned: [], skipped: [], blocked: [], error: 'Locatia nu exista' },
  ]);
  assert.deepEqual(summary, {
    pair_count: 3,
    planned_count: 3,
    skipped_count: 1,
    blocked_count: 2,
    failed_pair_count: 1,
  });
  assert.deepEqual(summarizeResearchServiceBatchPlan(null), {
    pair_count: 0, planned_count: 0, skipped_count: 0, blocked_count: 0, failed_pair_count: 0,
  });
});

scenario('token-urile de lot separa aplicarea de retragere', () => {
  assert.equal(researchServiceBatchConfirmation('RSB-abc', 12), 'SERVICII-LOT RSB-abc 12');
  assert.equal(researchServiceBatchRollbackConfirmation('RSB-abc', 12), 'ROLLBACK-SERVICII RSB-abc 12');
  assert.notEqual(
    researchServiceBatchConfirmation('RSB-abc', 12),
    researchServiceBatchRollbackConfirmation('RSB-abc', 12),
  );
  assert.notEqual(
    researchServiceBatchConfirmation('RSB-abc', 12),
    researchServiceBatchConfirmation('RSB-abc', 13),
  );
});

scenario('rollback-ul retrage doar randurile neatinse dupa scriere', () => {
  const note = researchServiceRowNote('D1', 'Efectuam OCT.');
  assert.equal(isResearchServiceRowRollbackSafe({ confirmation_level: 'publicly_listed', notes: note }, 'D1'), true);
  // confirmat de furnizor intre timp - nu se sterge
  assert.equal(isResearchServiceRowRollbackSafe({ confirmation_level: 'provider_confirmed', notes: note }, 'D1'), false);
  // verificat de VIASEE intre timp - nu se sterge
  assert.equal(isResearchServiceRowRollbackSafe({ confirmation_level: 'vezunde_verified', notes: note }, 'D1'), false);
  // nota rescrisa, deci randul a fost editat - nu se sterge
  assert.equal(isResearchServiceRowRollbackSafe({ confirmation_level: 'publicly_listed', notes: 'altceva' }, 'D1'), false);
  // alt draft decat cel care l-a scris - nu se sterge
  assert.equal(isResearchServiceRowRollbackSafe({ confirmation_level: 'publicly_listed', notes: note }, 'D2'), false);
  assert.equal(isResearchServiceRowRollbackSafe(null, 'D1'), false);
});

scenario('nota randului identifica draftul care l-a scris', () => {
  const note = researchServiceRowNote('D1', 'Efectuam OCT.');
  assert.match(note, /^Cercetare AI Copilot, draft D1\./);
  assert.match(note, /Efectuam OCT\./);
});

scenario('matching_allowed refuza locatiile inactive sau suspendate', () => {
  const active = { active_status: 'activa', profile_control_status: 'directory' };
  assert.equal(computeServiceMatchingAllowed('publicly_listed', 'optometry_consultation', active), true);
  assert.equal(computeServiceMatchingAllowed('not_confirmed', 'optometry_consultation', active), false);
  assert.equal(computeServiceMatchingAllowed('publicly_listed', 'optometry_consultation', { ...active, active_status: 'inactiva' }), false);
  assert.equal(computeServiceMatchingAllowed('publicly_listed', 'optometry_consultation', { ...active, profile_control_status: 'suspended' }), false);
  assert.equal(computeServiceMatchingAllowed('publicly_listed', 'serviciu_inexistent', active), false);
  assert.equal(computeServiceMatchingAllowed('publicly_listed', 'optometry_consultation', null), false);
});

scenario('randul construit are exact campurile asteptate', () => {
  const normalized = { canonicalKey: 'oct', definition: { service_need_level: 'specialized_medical', requires_review: true } };
  const row = locationServiceRow({
    locationId: 'L1',
    normalized,
    level: 'publicly_listed',
    matchingAllowed: true,
    sourceUrl: SOURCE_URL,
    confirmedAt: '2026-09-01T10:00:00.000Z',
    notes: 'nota',
  });
  assert.equal(row.location_id, 'L1');
  assert.equal(row.service_key, 'oct');
  assert.equal(row.confirmation_level, 'publicly_listed');
  assert.equal(row.matching_allowed, true);
  assert.equal(row.is_advanced_service, true);
  assert.equal(row.migration_review_required, false);
  assert.equal(row.is_active, true);
});

scenario('modulul de loturi cere token si nu poate rula un plan schimbat', () => {
  assert.match(batchOps, /if \(action === 'run'\)/);
  assert.match(batchOps, /Confirmare invalida - replanifica lotul/);
  assert.match(batchOps, /Planul nu mai corespunde perechilor - replanifica lotul/);
  assert.match(batchOps, /Lotul este deja in executie/);
  // orice modificare a perechilor invalideaza planul si aprobarea
  assert.match(batchOps, /approval_token_hash: '',/);
});

scenario('executia avanseaza pe cursor, cu lock si heartbeat', () => {
  assert.match(batchOps, /RESEARCH_SERVICE_BATCH_CHUNK_SIZE/);
  assert.match(batchOps, /execution_cursor: cursor/);
  assert.match(batchOps, /execution_lock_token: lockToken/);
  assert.match(batchOps, /last_heartbeat_at: nowIso\(\)/);
  assert.ok(RESEARCH_SERVICE_BATCH_CHUNK_SIZE >= 1);
});

scenario('rollback-ul cere token propriu si pastreaza randurile modificate', () => {
  assert.match(batchOps, /if \(action === 'rollback'\)/);
  assert.match(batchOps, /researchServiceBatchRollbackConfirmation\(batch\.batch_key, appliedServiceIds\.length\)/);
  assert.match(batchOps, /isResearchServiceRowRollbackSafe\(row, draftByServiceId\[serviceId\]\)/);
  assert.match(batchOps, /a fost modificat dupa scriere/);
  assert.match(batchOps, /action_type: 'rollback_research_service'/);
});

scenario('lotul nu atinge locatiile care nu mai sunt in regim directory', () => {
  assert.match(batchOps, /profile_control_status \|\| 'directory'\) !== 'directory'/);
});

scenario('lotul planifica prin acelasi planificator ca aplicarea pe o locatie', () => {
  assert.match(batchOps, /planResearchServiceApplication\(\{/);
  assert.doesNotMatch(batchOps, /service:/);
});

scenario('functia logica este rutata in ambele locuri', () => {
  const routing = source('base44/shared/directoryFunctionRouting.js');
  const router = source('base44/functions/directoryOps/router.ts');
  assert.match(routing, /researchServiceBatchOps: DIRECTORY_FUNCTION_ENDPOINT/);
  assert.match(router, /researchServiceBatchOps: researchServiceBatchOpsHandle/);
  assert.match(router, /from '\.\/researchServiceBatchOps\.ts'/);
});

scenario('entitatea de lot exista si este admin-only', () => {
  const entity = source('base44/entities/ResearchServiceApplyBatch.jsonc');
  assert.match(entity, /"name": "ResearchServiceApplyBatch"/);
  assert.match(entity, /"applied_service_ids"/);
  assert.match(entity, /"approval_token_hash"/);
  assert.match(entity, /"execution_cursor"/);
  assert.match(entity, /"rolled_back"/);
  assert.match(entity, /"role": "admin"/);
});

assert.ok(scenarioCount >= 30);
console.log(JSON.stringify({
  contract: RESEARCH_SERVICE_APPLY_CONTRACT_VERSION,
  batch_contract: RESEARCH_SERVICE_BATCH_CONTRACT_VERSION,
  scenarios: scenarioCount,
}));
