import assert from 'node:assert/strict';
import fs from 'node:fs';

function readRequiredFile(filePath) {
  assert(filePath, 'A required typecheck evidence path is missing.');
  assert(fs.existsSync(filePath), `Typecheck evidence is missing: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function readExitCode(filePath) {
  const value = Number.parseInt(readRequiredFile(filePath).trim(), 10);
  assert(Number.isInteger(value) && value >= 0, `Invalid typecheck exit code: ${filePath}`);
  return value;
}

function normalizeDiagnosticFile(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  for (const marker of ['src/', 'base44/', 'shared/', 'scripts/', 'node_modules/']) {
    const index = normalized.indexOf(marker);
    if (index >= 0) return normalized.slice(index);
  }
  return normalized;
}

function parseTypecheckDiagnostics(log) {
  const diagnostics = new Map();
  for (const line of String(log || '').split(/\r?\n/)) {
    const match = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.+)$/);
    if (!match) continue;
    const file = normalizeDiagnosticFile(match[1]);
    const message = match[3].replace(/\s+/g, ' ').trim();
    const key = `${file}|${match[2]}|${message}`;
    const current = diagnostics.get(key) || {
      file,
      code: match[2],
      message,
      count: 0,
    };
    current.count += 1;
    diagnostics.set(key, current);
  }
  return diagnostics;
}

function diagnosticCount(diagnostics) {
  return [...diagnostics.values()].reduce((sum, diagnostic) => sum + diagnostic.count, 0);
}

const [candidateLogPath, baselineLogPath, candidateExitPath, baselineExitPath] = process.argv.slice(2);
assert(
  candidateLogPath && baselineLogPath && candidateExitPath && baselineExitPath,
  'Usage: node scripts/verify-typecheck-baseline-delta.mjs <candidate-log> <baseline-log> <candidate-exit> <baseline-exit>',
);

const candidateExit = readExitCode(candidateExitPath);
const baselineExit = readExitCode(baselineExitPath);
const candidateDiagnostics = parseTypecheckDiagnostics(readRequiredFile(candidateLogPath));
const baselineDiagnostics = parseTypecheckDiagnostics(readRequiredFile(baselineLogPath));
const candidateErrorCount = diagnosticCount(candidateDiagnostics);
const baselineErrorCount = diagnosticCount(baselineDiagnostics);

if (candidateExit !== 0 && candidateErrorCount === 0) {
  throw new Error('Candidate full typecheck failed without parseable TypeScript diagnostics.');
}
if (baselineExit !== 0 && baselineErrorCount === 0) {
  throw new Error('Main baseline full typecheck failed without parseable TypeScript diagnostics.');
}

const additions = [];
for (const [key, diagnostic] of candidateDiagnostics.entries()) {
  const baselineCount = baselineDiagnostics.get(key)?.count || 0;
  if (diagnostic.count <= baselineCount) continue;
  additions.push({
    file: diagnostic.file,
    code: diagnostic.code,
    message: diagnostic.message,
    count: diagnostic.count - baselineCount,
  });
}
additions.sort((left, right) => (
  left.file.localeCompare(right.file)
  || left.code.localeCompare(right.code)
  || left.message.localeCompare(right.message)
));

if (additions.length > 0) {
  const error = new Error(
    `Full typecheck introduced ${additions.reduce((sum, item) => sum + item.count, 0)} diagnostic(s) relative to main.`,
  );
  error.code = 'FULL_TYPECHECK_BASELINE_REGRESSION';
  error.additions = additions;
  console.error(JSON.stringify({
    status: 'regression',
    candidate_exit: candidateExit,
    baseline_exit: baselineExit,
    candidate_error_count: candidateErrorCount,
    baseline_error_count: baselineErrorCount,
    additions,
  }, null, 2));
  throw error;
}

console.log(JSON.stringify({
  status: candidateExit === 0 ? 'clean' : 'baseline_debt_no_new_errors',
  candidate_exit: candidateExit,
  baseline_exit: baselineExit,
  candidate_error_count: candidateErrorCount,
  baseline_error_count: baselineErrorCount,
  new_error_count: 0,
}));
