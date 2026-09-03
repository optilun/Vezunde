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
  RESEARCH_SERVICE_CONFIRMATION_LEVEL,
  isPublicHttpUrl,
  planResearchServiceApplication,
  researchServiceApplyConfirmation,
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

scenario('add_service si actiunea noua impart acelasi constructor de rand', () => {
  assert.equal((dirOps.match(/LocationService\.create\(locationServiceRow\(\{/g) || []).length, 2);
  assert.equal((dirOps.match(/svc\.entities\.LocationService\.create\(/g) || []).length, 2);
  assert.equal((dirOps.match(/function locationServiceRow\(/g) || []).length, 1);
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

assert.ok(scenarioCount >= 18);
console.log(JSON.stringify({
  contract: RESEARCH_SERVICE_APPLY_CONTRACT_VERSION,
  scenarios: scenarioCount,
}));
