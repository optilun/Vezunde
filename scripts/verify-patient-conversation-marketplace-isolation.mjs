import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('./verify-patient-conversation-pr265-composition.mjs');
await import('./verify-patient-conversation-prior-state-locality.mjs');

const APPROVED_BYTE_STABLE_BLOBS = Object.freeze({
  'src/lib/providerSemanticSearch.js': Object.freeze([
    'c925bfd80a556aa1ed30dd4eed22a80fe80bc1ee',
    '240474eb3bba41f56f058ba83359ff33c77e757d',
  ]),
  'shared/providerRecommendation.js': Object.freeze([
    'cb05c9b755d78b2432c80f336e99cd82bfab5ba0',
    // 2026-09-01: recommendationBucketForProfile primeste needLevel. Pentru nevoi
    // 'specialized_medical' doar profilurile 'verified' mai intra in bucket-ul
    // 'confirmed'; pentru restul nevoilor comportamentul ramane identic (verified sau
    // claimed -> confirmed). Motivul: eligibilitatea specialized_medical din cautare
    // era mai permisiva decat cea din distribuirea lead-urilor, deci pacientul vedea
    // ca "confirmate" locatii care nu puteau primi cererea. Scorul si ordonarea in
    // interiorul unui bucket NU s-au atins. Aprobat explicit de owner.
    'e493500dad42b5f14ec560838f8bb0fdfdc5abdb',
    // 2026-09-02: doar diacritice pe eticheta vizibila pacientului
    // ('Profil de locatie verificat de VIASEE' -> 'Profil de locație...').
    // Nicio schimbare de logica, scor sau bucket.
    '903e7e857a87ab5db484cd08245d60d9d5216bd6',
  ]),
  'base44/functions/matchProviders/entry.ts': Object.freeze([
    '5dcbdff68ab17dc489b48baee8283db1d234da51',
    // 2026-08-05: fallback structural (profiluri din director fara servicii declarate
    // apar ca ultim nivel, etichetate). Aprobat explicit de owner.
    '384ce3e3190b4ae223d906574d8d7b976799c5dd',
    // 2026-09-01: in fallback-ul structural, structural_capability nu mai este filtru
    // binar ci criteriu de ordonare (capabilityRank). Inainte, o cautare non-medicala
    // excludea complet cabinetele si clinicile de oftalmologie, chiar cand nu exista
    // alta locatie in zona. Acum apar, dar dupa opticile din aceeasi zona. Restul
    // scoringului si selectia Top 3 raman neschimbate. Aprobat explicit de owner.
    '81590aa399a56a964d60e20644feee4f53208f68',
  ]),
  'base44/functions/matchProvidersSemantic/sharedDependencies.js': Object.freeze([
    '134166b15ecce5cd52b32f3d3dca05b27ae14e81',
    // 2026-08-06: sinonime extinse (miopie/presbiopie), reclasificare optometrie
    // (specialized_medical -> technical), catalog cu performed_by si raspunsuri
    // traduse pentru interpretarea LLM. Toate aprobate explicit de owner.
    'e5d784a3a961249ef15cdea4abc13179e6a5334c',
    // 2026-08-06: serviciile in afara locatiei separate pe tipuri reale (domiciliu,
    // sediul companiei, documente HG 1028, optica mobila, screening scoli), in locul
    // celor doua chei vechi combinate. Doar catalog si sinonime de cautare;
    // shared/providerRecommendation.js ramane neschimbat (vezi blob-ul de mai sus).
    '310e66c8633d966022449c03ab6b308b4853dc88',
    // 2026-09-01: copia impachetata a lui shared/providerRecommendation.js, aliniata cu
    // blob-ul aprobat de mai sus (recommendationBucketForProfile cu needLevel).
    '673e4261b168b7c27db29b5dc4eee1f7d801b78e',
    // 2026-09-02: aliniat cu shared/providerRecommendation.js - diacritice pe eticheta
    // vizibila pacientului. Nicio schimbare de logica.
    '21e373e458dfbf81503fe4ab1e9cf3dbba147d58',
  ]),
});

const MATCH_PROVIDERS_SEMANTIC_APPROVED_BASE_BLOBS = Object.freeze({
  main: Object.freeze([
    '0516abee9d11b4ff38ad62045b6dfc0931415545',
  ]),
  pr265_question_selection: Object.freeze([
    'dd9d9938939e2434398da9a31bafc8d3fb6b646f',
    '6cca8f15072f0f5f9e652ce8414f2da0d851f161',
    '791ddcbf516a4abc20514de43274f3ac7ceea31f',
    // 2026-08-06: fallback structural (praguri + acceptarea profilurilor revendicate
    // fara servicii), extindere nationala (query_scope 'national', doar profiluri
    // confirmate) si diagnostic pentru esecul silentios al InvokeLLM.
    // Verificat linie cu linie: NU s-au atins scoringul, ordonarea sau selectia Top 3.
    // shared/providerRecommendation.js ramane neschimbat (vezi blob-ul de mai sus).
    'bd2665d67ff7d0833f0285ca64c81dae7368c6f9',
    // 2026-09-01: aceeasi schimbare ca in matchProviders/entry.ts - in fallback-ul
    // structural, structural_capability devine criteriu de ordonare (capabilityRank)
    // in loc de filtru binar, ca sa nu mai dispara complet cabinetele si clinicile de
    // oftalmologie dintr-o cautare non-medicala. Verificat linie cu linie: scoringul,
    // ordonarea principala si selectia Top 3 raman neschimbate.
    '3f378c61c812033b7afdedb1efa6bd81c833664f',
    // 2026-09-02: doar copie vizibila pacientului, cu diacritice - motivul rutarii
    // ('Potrivire din localitatea selectata.' etc.), notitele si titlurile de grup ale
    // fallbackului structural. Verificat linie cu linie: nicio schimbare de scor,
    // ordonare sau selectie Top 3.
    '131b71686c8158a4b30b0aa25ad279b9e7b91f05',
  ]),
});

function gitBlobSha(content) {
  const normalized = String(content).replace(/\r\n/g, '\n');
  const bytes = Buffer.byteLength(normalized);
  return crypto.createHash('sha1')
    .update(`blob ${bytes}\0`)
    .update(normalized)
    .digest('hex');
}

function assertApprovedBlob(filePath, source, approvedBlobs) {
  const actualBlob = gitBlobSha(source);
  assert(
    approvedBlobs.includes(actualBlob),
    `${filePath} changed outside the approved main/PR #265 integration seams. Actual blob: ${actualBlob}`,
  );
  return actualBlob;
}

const observedStableBlobs = {};
for (const [filePath, approvedBlobs] of Object.entries(APPROVED_BYTE_STABLE_BLOBS)) {
  const source = fs.readFileSync(new URL(`../${filePath}`, import.meta.url), 'utf8');
  observedStableBlobs[filePath] = assertApprovedBlob(filePath, source, approvedBlobs);
}

const semanticEntryPath = new URL(
  '../base44/functions/matchProvidersSemantic/entry.ts',
  import.meta.url,
);
const semanticEntrySource = fs.readFileSync(semanticEntryPath, 'utf8');
assert(semanticEntrySource.includes(
  "import { runPatientConversationAgentShadow } from './patientConversationAgentShadow.ts';",
));
assert(semanticEntrySource.includes(
  "const PATIENT_CONVERSATION_SHADOW_MODE = 'patient_conversation_shadow';",
));
assert(semanticEntrySource.includes(
  'return await handlePatientConversationShadowMode(base44, payload);',
));

const modeBranchIndex = semanticEntrySource.indexOf(
  'if (payload.mode === PATIENT_CONVERSATION_SHADOW_MODE)',
);
const serviceRoleIndex = semanticEntrySource.indexOf('const svc = base44.asServiceRole;');
const searchTextIndex = semanticEntrySource.indexOf('const searchText = clean(');
assert(modeBranchIndex >= 0);
assert(serviceRoleIndex > modeBranchIndex);
assert(searchTextIndex > serviceRoleIndex);

const shadowModeSlice = semanticEntrySource.slice(modeBranchIndex, serviceRoleIndex);
for (const forbiddenNormalMatchingAuthority of [
  'assignRecommendationBuckets',
  'buildRecommendationScore',
  'buildRecommendationExplanations',
  'loadPublicLocationsForLocality',
  'ProviderLocation',
  'asServiceRole',
]) {
  assert(
    !shadowModeSlice.includes(forbiddenNormalMatchingAuthority),
    `Shadow mode leaked normal matching authority: ${forbiddenNormalMatchingAuthority}`,
  );
}

function stripApprovedShadowSeam(source) {
  let normalized = String(source).replace(/\r\n/g, '\n');
  normalized = normalized.replace(
    "import { runPatientConversationAgentShadow } from './patientConversationAgentShadow.ts';\n",
    '',
  );
  normalized = normalized.replace(
    "const PATIENT_CONVERSATION_SHADOW_MODE = 'patient_conversation_shadow';\n\n",
    '',
  );

  const handlerStart = normalized.indexOf('async function handlePatientConversationShadowMode');
  const serveStart = normalized.indexOf('Deno.serve', handlerStart);
  assert(handlerStart >= 0 && serveStart > handlerStart);
  normalized = normalized.slice(0, handlerStart) + normalized.slice(serveStart);

  normalized = normalized.replace(
    '    if (payload.mode === PATIENT_CONVERSATION_SHADOW_MODE) {\n'
      + '      return await handlePatientConversationShadowMode(base44, payload);\n'
      + '    }\n\n',
    '',
  );
  normalized = normalized.replace(
    '    const base44 = createClientFromRequest(request);\n'
      + '    const payload = await request.json().catch(() => ({}));\n\n'
      + '    const svc = base44.asServiceRole;\n',
    '    const base44 = createClientFromRequest(request);\n'
      + '    const svc = base44.asServiceRole;\n'
      + '    const payload = await request.json().catch(() => ({}));\n',
  );
  return normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
}

assert.match(semanticEntrySource, /error: 'Cererea nu a putut fi procesata\.'/);
assert.match(semanticEntrySource, /headers: \{ 'Cache-Control': 'no-store' \}/);
const normalPathReconstruction = stripApprovedShadowSeam(semanticEntrySource);
const reconstructedSemanticEntryBlob = gitBlobSha(normalPathReconstruction);
const approvedCompositionEntry = Object.entries(MATCH_PROVIDERS_SEMANTIC_APPROVED_BASE_BLOBS)
  .find(([, blobs]) => blobs.includes(reconstructedSemanticEntryBlob))?.[0] || null;
assert(
  approvedCompositionEntry,
  `Normal matchProvidersSemantic route changed outside the approved admin shadow or PR #265 question-only seams. Actual reconstructed blob: ${reconstructedSemanticEntryBlob}`,
);

const providerSemanticBlob = observedStableBlobs['src/lib/providerSemanticSearch.js'];
const providerSemanticComposition = providerSemanticBlob === '240474eb3bba41f56f058ba83359ff33c77e757d'
  ? 'pr265_question_selection'
  : 'main';
assert.equal(
  providerSemanticComposition,
  approvedCompositionEntry,
  'Frontend question-selection seam and backend question-only seam are not from the same approved composition baseline.',
);

const backendSafetyAdapterSource = fs.readFileSync(
  new URL('../base44/shared/patientSafety.js', import.meta.url),
  'utf8',
);
assert(!backendSafetyAdapterSource.includes('patientEyeSafetyPolicy'));
assert(!backendSafetyAdapterSource.includes('assessPatientEyeSafety'));
assert(backendSafetyAdapterSource.includes('const BLOCKING_FLAGS'));

const durablePolicyName = 'patientConversationDurableStatePolicy';
for (const runtimePath of [
  '../base44/functions/matchProvidersSemantic/entry.ts',
  '../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts',
  '../base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts',
  '../src/lib/providerSemanticSearch.js',
]) {
  const source = fs.readFileSync(new URL(runtimePath, import.meta.url), 'utf8');
  assert(
    !source.includes(durablePolicyName),
    `Inactive durable state leaked into runtime: ${runtimePath}`,
  );
}

console.log(
  `Patient conversation marketplace isolation verified against approved ${approvedCompositionEntry} Git blobs.`,
);
