import fs from 'node:fs';

const path = 'scripts/apply-pr266-post-evaluation-patch.mjs';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

const repairedTarget = `for (const relativePath of [
  'shared/patientConversationEvaluation.js',
]) {`;
const targetPattern = /for \(const relativePath of \[\r?\n\s*'shared\/patientConversationEvaluation\.js',\r?\n\s*'base44\/shared\/patientConversationEvaluation\.js',\r?\n\s*\]\) \{/;

if (!source.includes(repairedTarget)) {
  const next = source.replace(targetPattern, repairedTarget);
  if (next === source || !next.includes(repairedTarget)) {
    throw new Error('Expected evaluator target list was not found in the PR266 applicator.');
  }
  source = next;
  changed = true;
}

const payloadRepairMarker = 'PR266_RUNTIME_PAYLOAD_FINALIZER_REPAIR';
if (!source.includes(payloadRepairMarker)) {
  const insertion = `
  // PR266_RUNTIME_PAYLOAD_FINALIZER_REPAIR: tolerate CRLF checkouts and preserve
  // the original request payload for every operational finalizer.
  next = next.replace(
    /(\\.\\.\\.evaluationCorrelation\\(runtimePayload\\),\\r?\\n\\s*\\}), controller\\);/,
    '$1, controller, runtimePayload);',
  );
  next = next.replace(
    /(skippedWithoutUserMessage\\(runtimePayload, Date\\.now\\(\\) - startedAt\\),\\r?\\n\\s*controller,)(\\r?\\n\\s*\\);)/,
    '$1\\n      runtimePayload,$2',
  );
  next = next.replace(
    /(groundedEnvelope,\\r?\\n\\s*controller,)(\\r?\\n\\s*\\);)/,
    '$1\\n      runtimePayload,$2',
  );
  next = next.replace(
    /(durationMs: Date\\.now\\(\\) - startedAt,\\r?\\n\\s*\\}\\),\\r?\\n\\s*controller,)(\\r?\\n\\s*\\);)/,
    '$1\\n      runtimePayload,$2',
  );
`;
  const markerPattern = /(\r?\n\s*const runtimePayloadFinalizers = \()/;
  const next = source.replace(markerPattern, `${insertion}$1`);
  if (next === source || !next.includes(payloadRepairMarker)) {
    throw new Error('Runtime payload finalizer insertion point was not found.');
  }
  source = next;
  changed = true;
}

if (changed) {
  fs.writeFileSync(path, source);
  console.log('Repaired PR266 evaluator target and runtime finalizer transformations.');
} else {
  console.log('PR266 post-evaluation applicator is already repaired.');
}
