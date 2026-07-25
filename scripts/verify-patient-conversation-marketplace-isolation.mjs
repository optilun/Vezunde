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
  ]),
  'base44/functions/matchProviders/entry.ts': Object.freeze([
    '5dcbdff68ab17dc489b48baee8283db1d234da51',
  ]),
  'base44/functions/matchProvidersSemantic/sharedDependencies.js': Object.freeze([
    '134166b15ecce5cd52b32f3d3dca05b27ae14e81',
  ]),
});

const MATCH_PROVIDERS_SEMANTIC_APPROVED_BASE_BLOBS = Object.freeze({
  main: Object.freeze([
    '0516abee9d11b4ff38ad62045b6dfc0931415545',
  ]),
  pr265_question_selection: Object.freeze([
    'dd9d9938939e2434398da9a31bafc8d3fb6b646f',
    '6cca8f15072f0f5f9e652ce8414f2da0d851f161',
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
assert(backendSafetyAdapterSource.includes("from './patientEyeSafetyPolicy.js';"));
assert(backendSafetyAdapterSource.includes('assessPatientEyeSafety'));
assert(!backendSafetyAdapterSource.includes('const BLOCKING_PATTERNS'));

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
