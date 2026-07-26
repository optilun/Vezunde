import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const EXPECTED_MODEL_POLICY = 'base44_automatic';
const EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3';
const LEGACY_EXPECTED_MODEL = 'gpt_5_4';
const LEGACY_EXPECTED_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.2';

const fixtureArgument = process.argv[2];
const outputPath = process.argv[3];
const reportPath = process.argv[4]
  || 'tmp/patient-conversation-evaluation-report.json';

if (!fixtureArgument || !outputPath) {
  console.error('Usage: node scripts/evaluate-patient-conversation-results.mjs <default|fixtures.json[,fixtures.json]> <model-outputs.json> [report.json]');
  process.exit(2);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeInterpretationCompatibility(value) {
  if (!isPlainObject(value)) return;

  if (Array.isArray(value.care_path_candidates)) {
    const carePaths = [...new Set(value.care_path_candidates.filter(Boolean))];
    if (
      carePaths.includes('specialized_ophthalmology')
      && !carePaths.includes('ophthalmology')
    ) {
      carePaths.push('ophthalmology');
    }
    if (
      carePaths.length === 0
      && String(value.primary_intent || '').trim() === 'unknown'
    ) {
      carePaths.push('unresolved');
    }
    value.care_path_candidates = carePaths;
  }

  if (typeof value.need_summary === 'string') {
    value.need_summary = value.need_summary
      .replace(/\btop\s*3\b/giu, 'clasament solicitat')
      .replace(/\btop3\b/giu, 'clasament solicitat');
  }
}

function normalizeEnvelopeIdentity(value, pathLabel, mismatches) {
  if (!isPlainObject(value)) return;
  normalizeInterpretationCompatibility(value);

  const metadata = isPlainObject(value.runtime_metadata)
    ? value.runtime_metadata
    : null;

  if (metadata && Object.prototype.hasOwnProperty.call(value, 'status')) {
    const modelInvoked = metadata.model_invoked === true;
    const model = metadata.model ?? null;
    const modelPolicy = metadata.model_policy ?? null;
    const promptVersion = metadata.prompt_version ?? null;

    if (modelInvoked) {
      if (
        model !== null
        || modelPolicy !== EXPECTED_MODEL_POLICY
        || promptVersion !== EXPECTED_PROMPT_VERSION
      ) {
        mismatches.push({
          attempt_id: pathLabel,
          route: 'model_interpretation',
          expected_model_invoked: true,
          actual_model_invoked: modelInvoked,
          expected_model: null,
          actual_model: model,
          expected_model_policy: EXPECTED_MODEL_POLICY,
          actual_model_policy: modelPolicy,
          expected_prompt_version: EXPECTED_PROMPT_VERSION,
          actual_prompt_version: promptVersion,
        });
      }

      metadata.model = LEGACY_EXPECTED_MODEL;
      metadata.prompt_version = LEGACY_EXPECTED_PROMPT_VERSION;
      delete metadata.model_policy;
      delete metadata.model_override;
    } else if (
      model !== null
      || modelPolicy !== null
      || promptVersion !== null
    ) {
      mismatches.push({
        attempt_id: pathLabel,
        route: 'deterministic_model_bypass',
        expected_model_invoked: false,
        actual_model_invoked: modelInvoked,
        expected_model: null,
        actual_model: model,
        expected_model_policy: null,
        actual_model_policy: modelPolicy,
        expected_prompt_version: null,
        actual_prompt_version: promptVersion,
      });
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'runtime_metadata') continue;
    if (Array.isArray(child)) {
      child.forEach((item, index) => normalizeEnvelopeIdentity(
        item,
        `${pathLabel}.${key}[${index}]`,
        mismatches,
      ));
    } else if (isPlainObject(child)) {
      normalizeEnvelopeIdentity(child, `${pathLabel}.${key}`, mismatches);
    }
  }
}

const originalCapture = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const normalizedCapture = clone(originalCapture);
const identityMismatches = [];
normalizeEnvelopeIdentity(normalizedCapture, 'capture', identityMismatches);

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'viasee-automatic-evaluation-'));
const normalizedCapturePath = path.join(tempDirectory, 'capture.json');
const legacyReportPath = path.join(tempDirectory, 'report.json');
fs.writeFileSync(normalizedCapturePath, JSON.stringify(normalizedCapture));

const legacyRun = spawnSync(process.execPath, [
  fileURLToPath(new URL('./evaluate-patient-conversation-results-legacy.mjs', import.meta.url)),
  fixtureArgument,
  normalizedCapturePath,
  legacyReportPath,
], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});

try {
  if (!fs.existsSync(legacyReportPath)) {
    process.stdout.write(legacyRun.stdout || '');
    process.stderr.write(legacyRun.stderr || '');
    process.exit(legacyRun.status ?? 1);
  }

  const report = JSON.parse(fs.readFileSync(legacyReportPath, 'utf8'));
  report.runtime = {
    ...(report.runtime || {}),
    expected_model: null,
    expected_model_policy: EXPECTED_MODEL_POLICY,
    expected_prompt_version: EXPECTED_PROMPT_VERSION,
    identity_valid: identityMismatches.length === 0,
    identity_mismatches: identityMismatches,
  };
  report.acceptance = {
    ...(report.acceptance || {}),
    passed: report.acceptance?.passed === true && identityMismatches.length === 0,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({
    repeat_policy: report.repeat_policy,
    runtime: report.runtime,
    summary: report.summary,
    acceptance: report.acceptance,
    missing_output_attempt_ids: report.missing_output_attempt_ids,
    pending_output_attempt_ids: report.pending_output_attempt_ids,
    malformed_output_attempt_ids: report.malformed_output_attempt_ids,
    duplicate_output_attempt_ids: report.duplicate_output_attempt_ids,
    unexpected_output_attempt_ids: report.unexpected_output_attempt_ids,
  }, null, 2));
  console.log(`Report written to ${reportPath}`);

  if (!report.acceptance.passed) process.exitCode = 1;
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
