import process from 'node:process';
import { spawnSync } from 'node:child_process';
import {
  loadPatientConversationFixtures,
} from './patient-conversation-fixture-loader.mjs';

function fixturePathsFromArgs(argv) {
  const fixturePaths = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--case') {
      throw new Error('Comanda full-suite nu accepta --case; selecteaza automat toate cazurile.');
    }
    if (arg === '--fixtures') {
      const fixturePath = argv[index + 1];
      if (!fixturePath) throw new Error('--fixtures necesita o cale.');
      fixturePaths.push(fixturePath);
      index += 1;
    }
  }
  return fixturePaths;
}

const forwardedArguments = process.argv.slice(2);
const fixturePaths = fixturePathsFromArgs(forwardedArguments);
const suite = loadPatientConversationFixtures(
  fixturePaths.length > 0 ? fixturePaths : undefined,
);
const caseArguments = suite.cases.flatMap((fixture) => ['--case', fixture.id]);
const result = spawnSync(process.execPath, [
  'scripts/prepare-patient-conversation-shadow-run.mjs',
  ...forwardedArguments,
  ...caseArguments,
], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exitCode = Number.isInteger(result.status) ? result.status : 1;
