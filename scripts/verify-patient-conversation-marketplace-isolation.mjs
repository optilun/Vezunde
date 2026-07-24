import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const BYTE_STABLE_FILES = Object.freeze({
  'src/lib/providerSemanticSearch.js': 'c925bfd80a556aa1ed30dd4eed22a80fe80bc1ee',
  'shared/providerRecommendation.js': 'cb05c9b755d78b2432c80f336e99cd82bfab5ba0',
  'base44/functions/matchProviders/entry.ts': '5dcbdff68ab17dc489b48baee8283db1d234da51',
  'base44/functions/matchProvidersSemantic/sharedDependencies.js': '134166b15ecce5cd52b32f3d3dca05b27ae14e81',
});

const MATCH_PROVIDERS_SEMANTIC_MAIN_BLOB = '0516abee9d11b4ff38ad62045b6dfc0931415545';

function gitBlobSha(content) {
  const bytes = Buffer.byteLength(content);
  return crypto.createHash('sha1')
    .update(`blob ${bytes}\0`)
    .update(content)
    .digest('hex');
}

for (const [filePath, expectedBlob] of Object.entries(BYTE_STABLE_FILES)) {
  const source = fs.readFileSync(new URL(`../${filePath}`, import.meta.url), 'utf8');
  assert.equal(
    gitBlobSha(source),
    expectedBlob,
    `${filePath} changed relative to the approved main baseline.`,
  );
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
  let normalized = source;
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
assert.equal(
  gitBlobSha(normalPathReconstruction),
  MATCH_PROVIDERS_SEMANTIC_MAIN_BLOB,
  'Normal matchProvidersSemantic route changed outside the approved admin-only shadow seam.',
);

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

console.log('Patient conversation marketplace isolation verified against approved main Git blobs.');
