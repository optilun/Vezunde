import './verify-patient-conversation-runtime-evidence.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'viasee-terminal-failure-gate-'));
const fixturesPath = path.join(tempDirectory, 'fixtures.json');
const capturePath = path.join(tempDirectory, 'capture.json');
const reportPath = path.join(tempDirectory, 'report.json');

function unavailableEnvelope(attempt) {
  return {
    status: 'unavailable',
    reason: 'conversation_model_unavailable',
    evaluation_case_id: 'confirmed-001',
    evaluation_attempt: attempt,
    interpretation: null,
    runtime_metadata: {
      model: null,
      model_policy: 'base44_automatic',
      model_override: null,
      prompt_version: 'viasee-patient-conversation-prompt-v1.3',
      model_invoked: true,
      duration_ms: 50 + attempt,
      input_limits: {
        max_turns: 20,
        max_characters: 8000,
      },
    },
  };
}

try {
  fs.writeFileSync(fixturesPath, JSON.stringify({
    fixture_version: 'terminal-failure-fixtures-v1',
    cases: [
      {
        id: 'confirmed-001',
        category: 'confirmed_emergency',
        expected: {
          primary_intent: 'simptome_oftalmologice',
          care_paths_any: ['emergency_interruption'],
          service_keys_any: ['emergency_ophthalmology'],
          next_action: 'show_emergency_guidance',
          urgency: 'confirmed',
          must_ask: false,
          must_not: ['generic_112_primary_action'],
        },
      },
    ],
  }));

  fs.writeFileSync(capturePath, JSON.stringify({
    fixture_version: 'terminal-failure-capture-v1',
    model_run: {
      default_repeat_count: 1,
      critical_repeat_count: 3,
    },
    outputs: {
      'confirmed-001': {
        expected_attempts: 3,
        critical: true,
        attempts: {
          '1': unavailableEnvelope(1),
          '2': unavailableEnvelope(2),
          '3': unavailableEnvelope(3),
        },
      },
    },
  }));

  const run = spawnSync(process.execPath, [
    'scripts/evaluate-patient-conversation-results.mjs',
    fixturesPath,
    capturePath,
    reportPath,
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });

  assert.equal(run.status, 1, run.stderr || run.stdout);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.acceptance.passed, false);
  assert.equal(report.acceptance.observed.completed_attempt_rate.valid, true);
  assert.equal(report.acceptance.observed.completed_attempt_rate.applicable_cases, 3);
  assert.equal(report.acceptance.observed.completed_attempt_rate.passed_cases, 0);
  assert.equal(report.acceptance.observed.completed_attempt_rate.rate, 0);
  assert.equal(report.runtime.identity_valid, true);
  assert.equal(report.runtime.expected_model, null);
  assert.equal(report.runtime.expected_model_policy, 'base44_automatic');
  assert.equal(report.runtime.expected_prompt_version, 'viasee-patient-conversation-prompt-v1.3');
  assert.equal(report.runtime.status_counts.unavailable, 3);
  assert.equal(report.runtime.duration_ms.measured_attempts, 3);
  assert.deepEqual(report.missing_output_attempt_ids, []);
  assert.deepEqual(report.pending_output_attempt_ids, []);
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}

console.log('Patient conversation terminal model failures remain visible under the Automatic model policy.');
