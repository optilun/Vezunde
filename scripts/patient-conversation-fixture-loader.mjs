import fs from 'node:fs';

export const DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS = Object.freeze([
  'tests/fixtures/patient-conversation-agent-evaluations.json',
  'tests/fixtures/patient-conversation-agent-adversarial-evaluations.json',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function normalizePatientConversationFixturePaths(value) {
  if (Array.isArray(value)) {
    const paths = value.flatMap((item) => String(item || '').split(','))
      .map((item) => item.trim())
      .filter(Boolean);
    return paths.length > 0 ? [...new Set(paths)] : [...DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS];
  }
  if (typeof value === 'string' && value.trim()) {
    return normalizePatientConversationFixturePaths([value]);
  }
  return [...DEFAULT_PATIENT_CONVERSATION_FIXTURE_PATHS];
}

export function loadPatientConversationFixtures(pathsInput) {
  const fixturePaths = normalizePatientConversationFixturePaths(pathsInput);
  const payloads = fixturePaths.map((fixturePath) => ({
    fixture_path: fixturePath,
    payload: readJson(fixturePath),
  }));
  const cases = payloads.flatMap(({ payload }) => (
    Array.isArray(payload?.cases) ? payload.cases : []
  ));
  const duplicateCaseIds = [...new Set(cases
    .map((fixture) => fixture?.id)
    .filter((caseId, index, all) => caseId && all.indexOf(caseId) !== index))];
  if (duplicateCaseIds.length > 0) {
    throw new Error(`Duplicate patient conversation fixture IDs: ${duplicateCaseIds.join(', ')}`);
  }

  return {
    fixture_paths: fixturePaths,
    fixture_versions: payloads.map(({ payload, fixture_path }) => ({
      fixture_path,
      fixture_version: payload?.fixture_version || null,
      contract_version: payload?.contract_version || null,
    })),
    cases,
  };
}
