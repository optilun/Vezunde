import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'viasee-shadow-harness-'));
const fixturesPath = path.join(tempDirectory, 'fixtures.json');
const responsePath = path.join(tempDirectory, 'response.json');
const capturePath = path.join(tempDirectory, 'capture.json');

try {
  fs.writeFileSync(fixturesPath, JSON.stringify({
    fixture_version: 'test-fixtures-v1',
    cases: [{
      id: 'control-001',
      conversation: [{ role: 'user', content: 'Am nevoie de un control.' }],
      runtime_context: { known_locality: { city: 'Timisoara' } },
    }],
  }));

  fs.writeFileSync(responsePath, JSON.stringify({
    status: 'completed',
    evaluation_case_id: 'control-001',
    interpretation: {
      primary_intent: 'control_vedere',
      next_action: 'search_providers',
    },
    contract_version: 'viasee-patient-conversation-agent-v1',
  }));

  const run = spawnSync(process.execPath, [
    'scripts/prepare-patient-conversation-shadow-run.mjs',
    '--fixtures', fixturesPath,
    '--output', capturePath,
    '--case', 'control-001',
    '--case', 'control-001',
    '--response', responsePath,
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
  assert.deepEqual(capture.model_run.selected_case_ids, ['control-001']);
  assert.equal(capture.outputs['control-001'].status, 'completed');
  assert.equal(capture.outputs['control-001'].evaluation_case_id, 'control-001');
  assert.equal(capture.outputs['control-001'].contract_version, 'viasee-patient-conversation-agent-v1');
  assert.equal(capture.outputs['control-001'].interpretation.primary_intent, 'control_vedere');
  assert(capture.model_run.completed_at);

  const printed = JSON.parse(run.stdout);
  assert.deepEqual(printed.selected_cases, ['control-001']);
  assert.deepEqual(printed.pending_cases, []);
  assert.equal(printed.requests.length, 1);
  assert.equal(printed.requests[0].request.mode, 'patient_conversation_shadow');
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}

console.log('Patient conversation shadow capture harness verified.');
